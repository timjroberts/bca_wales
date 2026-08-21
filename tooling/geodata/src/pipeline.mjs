import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
  copyFile,
  cp,
  mkdir,
  readFile,
  stat,
  writeFile
} from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline as streamPipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import {
  canonicalJson,
  describeFile,
  isoNow,
  readJson,
  repositoryRoot,
  resolveInside,
  sha256File,
  sha256Text,
  uniqueBy,
  validateDocument,
  writeCanonical
} from "./runtime.mjs";

const defaultLockPath = path.join(repositoryRoot, "config/publication/toolchain.lock.json");

function valueAt(object, dottedPath) {
  return dottedPath.split(".").reduce((value, key) => value?.[key], object);
}

function assertSemanticContracts(registry, recipe) {
  if (registry.registry_id !== recipe.registry_id) {
    throw new Error(`Recipe registry ${recipe.registry_id} does not match ${registry.registry_id}`);
  }

  const sources = new Map(registry.sources.map((source) => [source.dataset_id, source]));
  uniqueBy(registry.sources, "dataset_id", "source registry");
  const inputIds = uniqueBy(recipe.inputs, "input_id", "recipe inputs");
  const intermediateIds = uniqueBy(recipe.intermediates, "artifact_id", "recipe intermediates");
  const outputIds = uniqueBy(recipe.outputs, "asset_id", "recipe outputs");
  const datasetIds = uniqueBy(recipe.datasets, "dataset_id", "recipe datasets");
  const allArtifacts = new Set([...inputIds, ...intermediateIds, ...outputIds]);

  if (registry.area_of_interest?.core_dataset_id) {
    const coreSource = sources.get(registry.area_of_interest.core_dataset_id);
    if (!coreSource) throw new Error(`Registry AOI references unknown source: ${registry.area_of_interest.core_dataset_id}`);
    if (coreSource.acquisition.sha256 !== registry.area_of_interest.core_sha256 ||
        coreSource.acquisition.version !== registry.area_of_interest.core_version) {
      throw new Error("Registry AOI version/checksum does not match its canonical source contract");
    }
  }

  if (recipe.spatial_contract) {
    const spatial = recipe.spatial_contract;
    if (!inputIds.has(spatial.core_input_id)) {
      throw new Error(`Spatial contract core input is unknown: ${spatial.core_input_id}`);
    }
    const coreInput = recipe.inputs.find((input) => input.input_id === spatial.core_input_id);
    if (coreInput.expected_sha256 !== spatial.core_sha256) {
      throw new Error("Spatial contract core checksum must match the pinned recipe input checksum");
    }
    for (const inputId of spatial.aoi_dependent_input_ids) {
      if (!inputIds.has(inputId)) throw new Error(`Spatial contract references unknown input: ${inputId}`);
    }
    for (const datasetId of spatial.aoi_dependent_dataset_ids) {
      if (!datasetIds.has(datasetId)) throw new Error(`Spatial contract references unknown dataset: ${datasetId}`);
    }
    const producerInputs = new Map();
    for (const step of recipe.steps) {
      for (const outputId of step.outputs) producerInputs.set(outputId, step.inputs);
    }
    const dependsOnCore = (artifactId, seen = new Set()) => {
      if (artifactId === spatial.core_input_id) return true;
      if (seen.has(artifactId)) return false;
      seen.add(artifactId);
      return (producerInputs.get(artifactId) ?? []).some((inputId) => dependsOnCore(inputId, new Set(seen)));
    };
    for (const datasetId of spatial.aoi_dependent_dataset_ids) {
      const datasetOutputs = recipe.outputs.filter((output) => output.dataset_id === datasetId);
      if (datasetOutputs.length === 0) throw new Error(`${datasetId}: spatial contract dataset has no outputs`);
      for (const output of datasetOutputs) {
        if (!dependsOnCore(output.asset_id)) {
          throw new Error(`${output.asset_id}: AOI-dependent output does not derive from ${spatial.core_input_id}`);
        }
      }
    }
  }
  uniqueBy(recipe.quality_gates ?? [], "gate_id", "quality gates");
  for (const gate of recipe.quality_gates ?? []) {
    if (!allArtifacts.has(gate.report_artifact_id)) {
      throw new Error(`${gate.gate_id}: unknown quality report artifact ${gate.report_artifact_id}`);
    }
  }

  for (const input of recipe.inputs) {
    if (!sources.has(input.dataset_id)) throw new Error(`Unknown source dataset: ${input.dataset_id}`);
    resolveInside("/release", input.destination);
  }
  for (const intermediate of recipe.intermediates) resolveInside("/release", intermediate.path);
  for (const output of recipe.outputs) {
    if (!datasetIds.has(output.dataset_id)) throw new Error(`Unknown release dataset: ${output.dataset_id}`);
    resolveInside("/release", output.path);
    if (typeof output.qa.maximum_bytes === "number" && output.qa.maximum_bytes < output.qa.minimum_bytes) {
      throw new Error(`${output.asset_id}: maximum bytes cannot be below minimum bytes`);
    }
    if (output.qa.expected_band_descriptions && output.qa.expected_band_count &&
        output.qa.expected_band_descriptions.length !== output.qa.expected_band_count) {
      throw new Error(`${output.asset_id}: expected band descriptions must match expected band count`);
    }
  }
  for (const dataset of recipe.datasets) {
    for (const sourceId of dataset.source_dataset_ids) {
      if (!sources.has(sourceId)) throw new Error(`${dataset.dataset_id}: unknown source ${sourceId}`);
    }
    const accessible = recipe.outputs.some(
      (output) =>
        output.dataset_id === dataset.dataset_id &&
        (output.profile === "accessible_csv" || output.profile === "accessible_json")
    );
    if (!accessible) throw new Error(`${dataset.dataset_id}: an accessible non-map output is required`);
  }
  for (const step of recipe.steps) {
    for (const id of [...step.inputs, ...step.outputs]) {
      if (!allArtifacts.has(id)) throw new Error(`${step.step_id}: unknown artifact ${id}`);
    }
    if (step.argv.some((argument) => argument.includes("\0"))) {
      throw new Error(`${step.step_id}: arguments may not contain NUL bytes`);
    }
  }
}

export async function loadContracts({ registryPath, recipePath }) {
  const [registry, recipe] = await Promise.all([
    readJson(registryPath),
    readJson(recipePath)
  ]);
  await Promise.all([
    validateDocument("registry", registry, registryPath),
    validateDocument("recipe", recipe, recipePath)
  ]);
  assertSemanticContracts(registry, recipe);
  return { registry, recipe };
}

function sourceUrl(input, source) {
  if (!input.source.startsWith("registry:")) return input.source;
  const value = valueAt(source, input.source.slice("registry:".length));
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${input.input_id}: registry source path is missing: ${input.source}`);
  }
  return value;
}

async function streamHttp(url, destination, maximumBytes, fetchImpl) {
  const response = await fetchImpl(url, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`${url}: HTTP ${response.status}`);
  const resolved = new URL(response.url);
  if (resolved.protocol !== "https:") throw new Error(`${url}: acquisition must resolve to HTTPS`);
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new Error(`${url}: declared size ${declaredLength} exceeds ${maximumBytes}`);
  }

  let bytes = 0;
  const hash = createHash("sha256");
  const counter = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > maximumBytes) {
        callback(new Error(`${url}: response exceeds ${maximumBytes} bytes`));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    }
  });
  await streamPipeline(Readable.fromWeb(response.body), counter, createWriteStream(destination, { flags: "wx" }));
  return {
    resolvedUrl: response.url,
    bytes,
    sha256: hash.digest("hex"),
    response: {
      status: response.status,
      content_type: response.headers.get("content-type"),
      etag: response.headers.get("etag"),
      last_modified: response.headers.get("last-modified")
    }
  };
}

export async function resolveAcquisitionTarget(url, fetchImpl = globalThis.fetch) {
  if (!url.startsWith("planetary:")) return { fetchUrl: url, recordUrl: url };
  const recordUrl = url.slice("planetary:".length);
  const parsed = new URL(recordUrl);
  if (parsed.protocol !== "https:" || parsed.hostname !== "landsateuwest.blob.core.windows.net") {
    throw new Error(`${recordUrl}: Planetary Computer assets must use the reviewed Landsat mirror host`);
  }
  const signer = new URL("https://planetarycomputer.microsoft.com/api/sas/v1/sign");
  signer.searchParams.set("href", recordUrl);
  const response = await fetchImpl(signer, { redirect: "follow" });
  if (!response.ok) throw new Error(`${signer}: HTTP ${response.status}`);
  const document = await response.json();
  const fetchUrl = new URL(document.href);
  if (fetchUrl.protocol !== "https:" || fetchUrl.hostname !== parsed.hostname || fetchUrl.pathname !== parsed.pathname) {
    throw new Error(`${recordUrl}: Planetary Computer signer returned an unexpected asset`);
  }
  return { fetchUrl: fetchUrl.href, recordUrl };
}

async function copyLocal(url, destination, maximumBytes) {
  const source = url.startsWith("file:") ? new URL(url) : path.resolve(url);
  const sourcePath = source instanceof URL ? source : source;
  const details = await stat(sourcePath);
  if (!details.isFile() || details.size < 1) throw new Error(`${url}: input is not a non-empty file`);
  if (details.size > maximumBytes) throw new Error(`${url}: size ${details.size} exceeds ${maximumBytes}`);
  await copyFile(sourcePath, destination, 0);
  return {
    resolvedUrl: url,
    bytes: details.size,
    sha256: await sha256File(destination),
    response: { status: null, content_type: null, etag: null, last_modified: null }
  };
}

function mediaTypeCompatible(expected, actual) {
  if (!actual) return true;
  const normalised = actual.split(";", 1)[0].trim().toLowerCase();
  const wanted = expected.split(";", 1)[0].trim().toLowerCase();
  if (normalised === wanted) return true;
  if (wanted === "application/geo+json" && normalised === "application/json") return true;
  if (normalised === "application/octet-stream" && [
    "application/vnd.openstreetmap.data+pbf",
    "image/tiff",
    "image/tiff; application=geotiff; profile=cloud-optimized"
  ].includes(expected.toLowerCase())) return true;
  return false;
}

async function validateAcquiredSource(source, input, file, response) {
  const events = [];
  if (!mediaTypeCompatible(input.media_type, response.content_type)) {
    events.push({
      severity: "hard_fail",
      code: "SOURCE_MEDIA_TYPE_CHANGED",
      message: `${input.input_id}: expected ${input.media_type}, received ${response.content_type}.`
    });
  }
  if (input.media_type === "application/geo+json") {
    try {
      const document = JSON.parse(await readFile(file, "utf8"));
      if (document.type !== "FeatureCollection" || !Array.isArray(document.features)) {
        throw new Error("document is not a FeatureCollection");
      }
      const expectedFeatures = source.acquisition.expected_features;
      if (typeof expectedFeatures === "number" && document.features.length !== expectedFeatures) {
        events.push({
          severity: "hard_fail",
          code: "SOURCE_FEATURE_COUNT_CHANGED",
          message: `${input.input_id}: expected ${expectedFeatures} features, received ${document.features.length}.`
        });
      }
      const missing = checkRequiredFields(document.features, source.schema.required_fields);
      if (missing.length > 0) {
        events.push({
          severity: "hard_fail",
          code: "SOURCE_SCHEMA_CHANGED",
          message: `${input.input_id}: required source fields are missing: ${missing.join(", ")}.`
        });
      }
      if (typeof source.schema.geometry === "string" && source.schema.geometry !== "STAC Item geometry") {
        const unexpected = document.features.find((feature) =>
          feature.geometry !== null && feature.geometry?.type !== source.schema.geometry
        );
        if (unexpected) {
          events.push({
            severity: "hard_fail",
            code: "SOURCE_GEOMETRY_CHANGED",
            message: `${input.input_id}: expected ${source.schema.geometry} geometry, received ${unexpected.geometry?.type ?? "unknown"}.`
          });
        }
      }
    } catch (error) {
      events.push({
        severity: "hard_fail",
        code: "SOURCE_GEOJSON_INVALID",
        message: `${input.input_id}: ${error.message}.`
      });
    }
  } else if (input.media_type.startsWith("image/tiff")) {
    const buffer = Buffer.alloc(4);
    const handle = await import("node:fs/promises").then(({ open }) => open(file, "r"));
    try { await handle.read(buffer, 0, 4, 0); } finally { await handle.close(); }
    const valid = buffer.equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) ||
      buffer.equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]));
    if (!valid) events.push({ severity: "hard_fail", code: "SOURCE_TIFF_INVALID", message: `${input.input_id}: TIFF signature is invalid.` });
  } else if (input.media_type === "application/zip") {
    const buffer = Buffer.alloc(4);
    const handle = await import("node:fs/promises").then(({ open }) => open(file, "r"));
    try { await handle.read(buffer, 0, 4, 0); } finally { await handle.close(); }
    if (buffer.subarray(0, 2).toString("ascii") !== "PK") {
      events.push({ severity: "hard_fail", code: "SOURCE_ZIP_INVALID", message: `${input.input_id}: ZIP signature is invalid.` });
    }
  }
  return events;
}

export async function acquireRelease({
  registryPath,
  recipePath,
  workspaceRoot,
  codeCommit,
  clock,
  allowNetwork = false,
  fetchImpl = globalThis.fetch
}) {
  const { registry, recipe } = await loadContracts({ registryPath, recipePath });
  if (!/^[0-9a-f]{40}$/.test(codeCommit)) throw new Error("codeCommit must be a full 40-character commit");
  await mkdir(workspaceRoot, { recursive: true });
  const releaseRoot = path.join(workspaceRoot, recipe.release_id);
  await mkdir(releaseRoot);
  for (const directory of ["quarantine", "outputs", "private", "reports", "manifests", "snapshots"]) {
    await mkdir(path.join(releaseRoot, directory));
  }

  const registrySnapshot = path.join(releaseRoot, "snapshots/source-registry.json");
  const recipeSnapshot = path.join(releaseRoot, "snapshots/publication-recipe.json");
  await Promise.all([
    writeCanonical(registrySnapshot, registry, { exclusive: true }),
    writeCanonical(recipeSnapshot, recipe, { exclusive: true })
  ]);

  const sources = new Map(registry.sources.map((source) => [source.dataset_id, source]));
  const inputs = [];
  const qaEvents = [];
  const usedSourceIds = new Set(recipe.datasets.flatMap((dataset) => dataset.source_dataset_ids));
  const licenceSnapshots = [];
  for (const datasetId of usedSourceIds) {
    const terms = sources.get(datasetId).contract.licence_terms;
    if (!terms.snapshot_path || !terms.sha256) {
      qaEvents.push({
        severity: "hard_fail",
        code: "LICENCE_TERMS_SNAPSHOT_MISSING",
        message: `${datasetId}: reviewed licence terms snapshot and checksum are required.`
      });
      continue;
    }
    const sourceFile = resolveInside(path.dirname(registryPath), terms.snapshot_path);
    const extension = path.extname(sourceFile) || ".txt";
    const destination = path.join(releaseRoot, "snapshots/licences", `${datasetId}${extension}`);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(sourceFile, destination);
    const details = await stat(destination);
    const actualSha = await sha256File(destination);
    const checksumStatus = actualSha === terms.sha256 ? "matched" : "changed";
    if (checksumStatus === "changed") {
      qaEvents.push({
        severity: "hard_fail",
        code: "LICENCE_TERMS_CHECKSUM_CHANGED",
        message: `${datasetId}: reviewed licence terms snapshot checksum changed.`
      });
    }
    licenceSnapshots.push({
      dataset_id: datasetId,
      source_path: terms.snapshot_path,
      path: path.relative(releaseRoot, destination).split(path.sep).join("/"),
      byte_length: details.size,
      sha256: actualSha,
      checksum_status: checksumStatus
    });
  }
  for (const input of recipe.inputs) {
    const source = sources.get(input.dataset_id);
    const url = sourceUrl(input, source);
    const destination = resolveInside(releaseRoot, input.destination);
    await mkdir(path.dirname(destination), { recursive: true });
    const remote = /^(?:https:\/\/|planetary:https:\/\/)/.test(url);
    if (remote && !allowNetwork) {
      throw new Error(`${input.input_id}: remote acquisition requires explicit network approval`);
    }
    let acquired;
    if (remote) {
      const target = await resolveAcquisitionTarget(url, fetchImpl);
      acquired = await streamHttp(target.fetchUrl, destination, input.maximum_bytes, fetchImpl);
      acquired.resolvedUrl = target.recordUrl;
    } else {
      acquired = await copyLocal(url, destination, input.maximum_bytes);
    }
    const checksumStatus = input.expected_sha256 === null || input.expected_sha256 === undefined
      ? "unreviewed"
      : input.expected_sha256 === acquired.sha256
        ? "matched"
        : "changed";
    if (checksumStatus !== "matched") {
      qaEvents.push({
        severity: checksumStatus === "changed" ? "warning" : "information",
        code: checksumStatus === "changed" ? "SOURCE_CHECKSUM_CHANGED" : "SOURCE_CHECKSUM_RECORDED",
        message: `${input.input_id}: ${checksumStatus === "changed" ? "expected checksum changed" : "first checksum requires review"}.`
      });
    }
    qaEvents.push(...await validateAcquiredSource(source, input, destination, acquired.response));
    inputs.push({
      input_id: input.input_id,
      dataset_id: input.dataset_id,
      retrieved_at: isoNow(clock),
      resolved_url: acquired.resolvedUrl,
      response: acquired.response,
      path: path.relative(releaseRoot, destination).split(path.sep).join("/"),
      media_type: input.media_type,
      byte_length: acquired.bytes,
      sha256: acquired.sha256,
      expected_sha256: input.expected_sha256 ?? null,
      checksum_status: checksumStatus
    });
  }

  const manifest = {
    schema_version: "1.0.0",
    manifest_id: `acquisition-${recipe.release_id}`,
    release_id: recipe.release_id,
    registry_id: registry.registry_id,
    registry_sha256: await sha256File(registrySnapshot),
    recipe_sha256: await sha256File(recipeSnapshot),
    code_commit: codeCommit,
    created_at: isoNow(clock),
    checksum_algorithm: "sha256",
    inputs,
    licence_snapshots: licenceSnapshots,
    qa_events: qaEvents
  };
  await validateDocument("acquisition", manifest, "generated acquisition manifest");
  await writeCanonical(path.join(releaseRoot, "manifests/acquisition.json"), manifest, { exclusive: true });
  return { releaseRoot, manifest };
}

export async function reuseAcquisition({
  archiveRoot,
  registryPath,
  recipePath,
  workspaceRoot,
  codeCommit,
  clock
}) {
  const [{ registry, recipe }, archived] = await Promise.all([
    loadContracts({ registryPath, recipePath }),
    readJson(path.join(archiveRoot, "manifests/acquisition.json"))
  ]);
  await validateDocument("acquisition", archived, "retained acquisition manifest");
  if (!/^[0-9a-f]{40}$/.test(codeCommit)) throw new Error("codeCommit must be a full 40-character commit");
  if (archived.registry_id !== registry.registry_id) {
    throw new Error(`Retained inputs use registry ${archived.registry_id}, not ${registry.registry_id}`);
  }
  if (recipe.spatial_contract?.rebuild_aoi_dependent_inputs) {
    const archivedRecipe = await readJson(path.join(archiveRoot, "snapshots/publication-recipe.json"));
    if (canonicalJson(archivedRecipe.spatial_contract) !== canonicalJson(recipe.spatial_contract)) {
      throw new Error(
        `Spatial contract changed and requires a fresh matching acquisition of AOI-dependent inputs: ${recipe.spatial_contract.aoi_dependent_input_ids.join(", ")}`
      );
    }
  }

  await mkdir(workspaceRoot, { recursive: true });
  const releaseRoot = path.join(workspaceRoot, recipe.release_id);
  await mkdir(releaseRoot);
  for (const directory of ["quarantine", "outputs", "private", "reports", "manifests", "snapshots"]) {
    await mkdir(path.join(releaseRoot, directory));
  }

  const registrySnapshot = path.join(releaseRoot, "snapshots/source-registry.json");
  const recipeSnapshot = path.join(releaseRoot, "snapshots/publication-recipe.json");
  await Promise.all([
    writeCanonical(registrySnapshot, registry, { exclusive: true }),
    writeCanonical(recipeSnapshot, recipe, { exclusive: true })
  ]);

  const sources = new Map(registry.sources.map((source) => [source.dataset_id, source]));
  const archivedInputs = new Map(archived.inputs.map((input) => [input.input_id, input]));
  const inputs = [];
  const qaEvents = [];
  for (const input of recipe.inputs) {
    const retained = archivedInputs.get(input.input_id);
    if (!retained) throw new Error(`${input.input_id}: retained input is absent`);
    if (retained.dataset_id !== input.dataset_id || retained.media_type !== input.media_type) {
      throw new Error(`${input.input_id}: retained input contract changed`);
    }
    if (!input.expected_sha256 || input.expected_sha256 !== retained.sha256) {
      throw new Error(`${input.input_id}: retained bytes do not match the reviewed recipe checksum`);
    }
    const sourceFile = resolveInside(archiveRoot, retained.path);
    const sourceDetails = await stat(sourceFile);
    if (!sourceDetails.isFile() || sourceDetails.size !== retained.byte_length || sourceDetails.size > input.maximum_bytes) {
      throw new Error(`${input.input_id}: retained input size is invalid`);
    }
    if (await sha256File(sourceFile) !== retained.sha256) {
      throw new Error(`${input.input_id}: retained input checksum no longer matches its archive`);
    }
    const destination = resolveInside(releaseRoot, input.destination);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(sourceFile, destination);
    qaEvents.push(...await validateAcquiredSource(
      sources.get(input.dataset_id), input, destination, retained.response
    ));
    inputs.push({
      ...retained,
      path: path.relative(releaseRoot, destination).split(path.sep).join("/"),
      expected_sha256: input.expected_sha256,
      checksum_status: "matched"
    });
  }

  const usedSourceIds = new Set(recipe.datasets.flatMap((dataset) => dataset.source_dataset_ids));
  const licenceSnapshots = [];
  for (const datasetId of usedSourceIds) {
    const terms = sources.get(datasetId).contract.licence_terms;
    if (!terms.snapshot_path || !terms.sha256) {
      throw new Error(`${datasetId}: reviewed licence terms snapshot and checksum are required`);
    }
    const sourceFile = resolveInside(path.dirname(registryPath), terms.snapshot_path);
    const extension = path.extname(sourceFile) || ".txt";
    const destination = path.join(releaseRoot, "snapshots/licences", `${datasetId}${extension}`);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(sourceFile, destination);
    const details = await stat(destination);
    const actualSha = await sha256File(destination);
    if (actualSha !== terms.sha256) throw new Error(`${datasetId}: reviewed licence terms snapshot checksum changed`);
    licenceSnapshots.push({
      dataset_id: datasetId,
      source_path: terms.snapshot_path,
      path: path.relative(releaseRoot, destination).split(path.sep).join("/"),
      byte_length: details.size,
      sha256: actualSha,
      checksum_status: "matched"
    });
  }

  qaEvents.push({
    severity: "information",
    code: recipe.spatial_contract?.rebuild_aoi_dependent_inputs
      ? "MATCHED_SPATIAL_ACQUISITION_RETAINED"
      : "RETAINED_INPUTS_REUSED",
    message: `${inputs.length} exact, checksum-verified provider inputs were retained from ${archived.release_id}; original retrieval metadata is preserved${recipe.spatial_contract?.rebuild_aoi_dependent_inputs ? " and the complete spatial contract is unchanged" : ""}.`
  });
  const manifest = {
    schema_version: "1.0.0",
    manifest_id: `acquisition-${recipe.release_id}`,
    release_id: recipe.release_id,
    registry_id: registry.registry_id,
    registry_sha256: await sha256File(registrySnapshot),
    recipe_sha256: await sha256File(recipeSnapshot),
    code_commit: codeCommit,
    created_at: isoNow(clock),
    checksum_algorithm: "sha256",
    inputs,
    licence_snapshots: licenceSnapshots,
    qa_events: qaEvents
  };
  await validateDocument("acquisition", manifest, "generated retained acquisition manifest");
  await writeCanonical(path.join(releaseRoot, "manifests/acquisition.json"), manifest, { exclusive: true });
  return { releaseRoot, manifest };
}

function runProcess(command, argv, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argv, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}: ${stderr.trim()}`));
    });
  });
}

function containerRunner(lock, releaseRoot) {
  return async (tool, argv) => {
    const userArgs = typeof process.getuid === "function"
      ? ["--user", `${process.getuid()}:${process.getgid()}`]
      : [];
    return runProcess("docker", [
      "run", "--rm", "--network=none",
      ...userArgs,
      "--volume", `${releaseRoot}:/work`,
      "--volume", `${repositoryRoot}:/repo:ro`,
      "--workdir", "/work",
      lock.container_image,
      tool,
      ...argv
    ]);
  };
}

function artifactPathMap(recipe, releaseRoot) {
  return new Map([
    ...recipe.inputs.map((item) => [item.input_id, resolveInside(releaseRoot, item.destination)]),
    ...recipe.intermediates.map((item) => [item.artifact_id, resolveInside(releaseRoot, item.path)]),
    ...recipe.outputs.map((item) => [item.asset_id, resolveInside(releaseRoot, item.path)])
  ]);
}

function containerPath(file, releaseRoot) {
  return `/work/${path.relative(releaseRoot, file).split(path.sep).join("/")}`;
}

function resolveArg(argument, paths, releaseRoot) {
  const match = /^\{artifact:([^}]+)\}$/.exec(argument);
  if (!match) return argument;
  const file = paths.get(match[1]);
  if (!file) throw new Error(`Unknown artifact placeholder: ${argument}`);
  return containerPath(file, releaseRoot);
}

function toolVersion(lock, tool) {
  if (["ogr2ogr", "gdal_translate", "gdalwarp", "gdaldem"].includes(tool)) return lock.tools.gdal;
  if (tool === "python3") return lock.tools.python;
  return lock.tools[tool] ?? "repository-pinned";
}

async function verifyToolchain(lock, runner) {
  const probes = [
    ["gdal", "gdalinfo", ["--version"]],
    ["tippecanoe", "tippecanoe", ["--version"]],
    ["pmtiles", "pmtiles", ["version"]],
    ["python", "python3", ["--version"]]
  ];
  const verification = [];
  for (const [lockName, tool, argv] of probes) {
    const expected = lock.tools[lockName];
    const result = await runner(tool, argv);
    const reported = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    if (!reported.includes(expected)) {
      throw new Error(`${tool}: expected pinned version ${expected}, reported ${reported || "nothing"}`);
    }
    verification.push({ tool, expected, reported });
  }
  return verification;
}

function checkRequiredFields(features, fields) {
  const missing = [];
  for (const field of fields ?? []) {
    if (!features.every((feature) => Object.hasOwn(feature.properties ?? {}, field))) missing.push(field);
  }
  return missing;
}

function csvHeader(line) {
  const cells = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) {
      cells.push(value);
      value = "";
    } else value += character;
  }
  cells.push(value);
  return cells;
}

export async function inspectOutput(output, file, runner, releaseRoot) {
  const artifact = await describeFile(output.asset_id, file, releaseRoot);
  const hardFailures = [];
  const warnings = [];
  const details = {};
  if (artifact.bytes < output.qa.minimum_bytes) {
    hardFailures.push(`${output.asset_id}: ${artifact.bytes} bytes is below ${output.qa.minimum_bytes}`);
  }
  if (typeof output.qa.maximum_bytes === "number" && artifact.bytes > output.qa.maximum_bytes) {
    hardFailures.push(`${output.asset_id}: ${artifact.bytes} bytes exceeds ${output.qa.maximum_bytes}`);
  }

  if (output.profile === "geojson") {
    const document = JSON.parse(await readFile(file, "utf8"));
    if (document.type !== "FeatureCollection" || !Array.isArray(document.features)) {
      hardFailures.push(`${output.asset_id}: not a GeoJSON FeatureCollection`);
    } else {
      details.feature_count = document.features.length;
      if (document.features.length < (output.qa.minimum_features ?? 0)) {
        hardFailures.push(`${output.asset_id}: too few features`);
      }
      const missing = checkRequiredFields(document.features, output.qa.required_fields);
      if (missing.length > 0) hardFailures.push(`${output.asset_id}: missing fields ${missing.join(", ")}`);
    }
  } else if (output.profile === "accessible_csv") {
    const content = await readFile(file, "utf8");
    const lines = content.trimEnd().split(/\r?\n/);
    const header = csvHeader(lines[0] ?? "");
    details.row_count = Math.max(0, lines.length - 1);
    const missing = (output.qa.required_fields ?? []).filter((field) => !header.includes(field));
    if (missing.length > 0) hardFailures.push(`${output.asset_id}: missing CSV columns ${missing.join(", ")}`);
    if (details.row_count < (output.qa.minimum_rows ?? 0)) hardFailures.push(`${output.asset_id}: too few CSV rows`);
  } else if (output.profile === "accessible_json") {
    const document = JSON.parse(await readFile(file, "utf8"));
    details.row_count = Array.isArray(document) ? document.length : 1;
    if (details.row_count < (output.qa.minimum_rows ?? 0)) hardFailures.push(`${output.asset_id}: too few JSON records`);
    const records = Array.isArray(document) ? document : [document];
    const missing = (output.qa.required_fields ?? []).filter((field) =>
      records.some((record) => valueAt(record, field) === undefined)
    );
    if (missing.length > 0) hardFailures.push(`${output.asset_id}: missing JSON fields ${missing.join(", ")}`);
  } else if (output.profile === "vector_pmtiles" || output.profile === "raster_pmtiles") {
    const header = Buffer.alloc(8);
    const handle = await import("node:fs/promises").then(({ open }) => open(file, "r"));
    try { await handle.read(header, 0, 8, 0); } finally { await handle.close(); }
    if (header.subarray(0, 7).toString("ascii") !== "PMTiles" || header[7] !== 3) {
      hardFailures.push(`${output.asset_id}: not a PMTiles v3 archive`);
    } else {
      try {
        await runner("pmtiles", ["verify", containerPath(file, releaseRoot)]);
      } catch (error) {
        hardFailures.push(`${output.asset_id}: ${error.message}`);
      }
    }
  } else if (output.profile === "cog") {
    const header = Buffer.alloc(4);
    const handle = await import("node:fs/promises").then(({ open }) => open(file, "r"));
    try { await handle.read(header, 0, 4, 0); } finally { await handle.close(); }
    const little = header.equals(Buffer.from([0x49, 0x49, 0x2a, 0x00]));
    const big = header.equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]));
    if (!little && !big) hardFailures.push(`${output.asset_id}: not a TIFF file`);
    else {
      try {
        const result = await runner("gdalinfo", ["-json", containerPath(file, releaseRoot)]);
        const info = JSON.parse(result.stdout);
        if (info.metadata?.IMAGE_STRUCTURE?.LAYOUT !== "COG") {
          hardFailures.push(`${output.asset_id}: GDAL does not report COG layout`);
        }
        if (typeof output.qa.expected_band_count === "number" && info.bands?.length !== output.qa.expected_band_count) {
          hardFailures.push(`${output.asset_id}: expected ${output.qa.expected_band_count} bands, received ${info.bands?.length ?? 0}`);
        }
        if (output.qa.expected_band_descriptions) {
          const actual = (info.bands ?? []).map((band) => band.description ?? "");
          if (JSON.stringify(actual) !== JSON.stringify(output.qa.expected_band_descriptions)) {
            hardFailures.push(`${output.asset_id}: band descriptions do not match the recipe contract`);
          }
        }
        if (typeof output.qa.expected_resolution_m === "number") {
          const actual = [Math.abs(info.geoTransform?.[1] ?? NaN), Math.abs(info.geoTransform?.[5] ?? NaN)];
          const tolerance = output.qa.resolution_tolerance_m ?? 0.01;
          if (actual.some((value) => !Number.isFinite(value) || Math.abs(value - output.qa.expected_resolution_m) > tolerance)) {
            hardFailures.push(`${output.asset_id}: pixel resolution ${actual.join(" x ")} m does not match ${output.qa.expected_resolution_m} m`);
          }
        }
        if (output.qa.expected_crs) {
          const expectedCode = Number(output.qa.expected_crs.slice("EPSG:".length));
          const identifier = info.coordinateSystem?.id;
          if (identifier?.authority !== "EPSG" || Number(identifier.code) !== expectedCode) {
            hardFailures.push(`${output.asset_id}: CRS does not match ${output.qa.expected_crs}`);
          }
        }
      } catch (error) {
        hardFailures.push(`${output.asset_id}: ${error.message}`);
      }
    }
  }

  return { artifact: { ...artifact, ...details }, hardFailures, warnings };
}

function assertionPasses(actual, assertion) {
  if (assertion.operator === "eq") return actual === assertion.value;
  if (typeof actual !== "number" || typeof assertion.value !== "number") return false;
  if (assertion.operator === "gte") return actual >= assertion.value;
  if (assertion.operator === "lte") return actual <= assertion.value;
  return false;
}

async function qualityGateFailures(recipe, paths) {
  const failures = [];
  for (const gate of recipe.quality_gates ?? []) {
    let report;
    try {
      report = await readJson(paths.get(gate.report_artifact_id));
    } catch (error) {
      failures.push(`${gate.gate_id}: quality report could not be read: ${error.message}`);
      continue;
    }
    for (const assertion of gate.assertions) {
      const actual = valueAt(report, assertion.path);
      if (!assertionPasses(actual, assertion)) {
        failures.push(`${gate.gate_id}: ${assertion.message} (received ${JSON.stringify(actual)})`);
      }
    }
  }
  return failures;
}

async function licenceAndRegistryGate(registry, recipe, acquisition, releaseRoot) {
  const hardFailures = [];
  const warnings = [];
  const sources = new Map(registry.sources.map((source) => [source.dataset_id, source]));
  const acquiredTerms = new Map(acquisition.licence_snapshots.map((item) => [item.dataset_id, item]));
  if (registry.status !== "approved") hardFailures.push(`Registry status is ${registry.status}: ${registry.status_reason}`);
  for (const gap of registry.hard_gaps) hardFailures.push(`Registry hard gap ${gap.gap_id}`);
  const used = new Set(recipe.datasets.flatMap((dataset) => dataset.source_dataset_ids));
  for (const sourceId of used) {
    const source = sources.get(sourceId);
    if (!source.publication.startsWith("approved")) hardFailures.push(`${sourceId}: publication status is ${source.publication}`);
    if (!source.contract.licence_terms.snapshot_path || !source.contract.licence_terms.sha256) {
      hardFailures.push(`${sourceId}: reviewed licence terms snapshot and checksum are required`);
    } else {
      const snapshot = acquiredTerms.get(sourceId);
      if (!snapshot || snapshot.checksum_status !== "matched") {
        hardFailures.push(`${sourceId}: archived licence terms do not match the reviewed checksum`);
      } else if (await sha256File(resolveInside(releaseRoot, snapshot.path)) !== source.contract.licence_terms.sha256) {
        hardFailures.push(`${sourceId}: archived licence terms changed after acquisition`);
      }
    }
    if (!source.safety.startsWith("public_safe")) hardFailures.push(`${sourceId}: source is not public-safe`);
    if (source.contract.refresh.mode === "manual") warnings.push(`${sourceId}: manual release-authority promotion is required`);
  }
  return { hardFailures, warnings };
}

async function crossReleaseGate(recipe, outputs, releaseRoot) {
  const hardFailures = [];
  const warnings = [];
  const baselinePath = recipe.cross_release_qa.baseline_manifest;
  if (!baselinePath) {
    if (recipe.supersedes) hardFailures.push("A superseding release requires a cross-release baseline manifest");
    else warnings.push("First release has no cross-release baseline");
    return { hardFailures, warnings };
  }
  const baseline = await readJson(path.resolve(repositoryRoot, baselinePath));
  const baselineOutputs = new Map((baseline.outputs ?? baseline.assets ?? []).map(
    (output) => [output.id ?? output.asset_id, output]
  ));
  for (const output of outputs) {
    const previous = baselineOutputs.get(output.id);
    if (!previous) {
      warnings.push(`${output.id}: new asset has no baseline`);
      continue;
    }
    if (output.bytes > previous.bytes * recipe.cross_release_qa.maximum_asset_growth_ratio) {
      hardFailures.push(`${output.id}: size growth exceeds the approved ratio`);
    }
    if (typeof output.feature_count === "number" && typeof previous.feature_count === "number") {
      const divisor = Math.max(1, previous.feature_count);
      const change = Math.abs(output.feature_count - previous.feature_count) / divisor;
      if (change > recipe.cross_release_qa.maximum_feature_change_ratio) {
        hardFailures.push(`${output.id}: feature-count change exceeds the approved ratio`);
      }
    }
  }
  if (path.resolve(releaseRoot, baselinePath) === path.resolve(baselinePath)) {
    warnings.push("Baseline should remain outside the candidate release workspace");
  }
  return { hardFailures, warnings };
}

function qaChecks(hardFailures, warnings) {
  return [
    ...hardFailures.map((message, index) => ({ id: `hard-failure-${index + 1}`, result: "fail", message })),
    ...warnings.map((message, index) => ({ id: `warning-${index + 1}`, result: "warning", message })),
    ...(hardFailures.length === 0 ? [{ id: "hard-gate", result: "pass", message: "All non-waivable publication checks passed." }] : [])
  ];
}

function qaMarkdown(qa) {
  const lines = [
    "# Publication QA report",
    "",
    `Result: **${qa.result.toUpperCase()}**`,
    `Checked: ${qa.checked_at}`,
    "",
    "## Hard failures",
    "",
    ...(qa.hard_failures.length ? qa.hard_failures.map((item) => `- ${item}`) : ["- None"]),
    "",
    "## Warnings",
    "",
    ...(qa.warnings.length ? qa.warnings.map((item) => `- ${item}`) : ["- None"]),
    ""
  ];
  return lines.join("\n");
}

export async function buildRelease({
  releaseRoot,
  clock,
  lockPath = defaultLockPath,
  runner
}) {
  const registryPath = path.join(releaseRoot, "snapshots/source-registry.json");
  const recipePath = path.join(releaseRoot, "snapshots/publication-recipe.json");
  const acquisitionPath = path.join(releaseRoot, "manifests/acquisition.json");
  const [registry, recipe, acquisition, lock] = await Promise.all([
    readJson(registryPath),
    readJson(recipePath),
    readJson(acquisitionPath),
    readJson(lockPath)
  ]);
  await Promise.all([
    validateDocument("registry", registry, registryPath),
    validateDocument("recipe", recipe, recipePath),
    validateDocument("acquisition", acquisition, acquisitionPath)
  ]);
  assertSemanticContracts(registry, recipe);
  if (acquisition.release_id !== recipe.release_id) throw new Error("Acquisition and recipe release IDs differ");
  if (acquisition.registry_sha256 !== await sha256File(registryPath)) throw new Error("Registry snapshot checksum mismatch");
  if (acquisition.recipe_sha256 !== await sha256File(recipePath)) throw new Error("Recipe snapshot checksum mismatch");

  const paths = artifactPathMap(recipe, releaseRoot);
  const execute = runner ?? containerRunner(lock, releaseRoot);
  const toolVerification = await verifyToolchain(lock, execute);
  const inputManifest = new Map(acquisition.inputs.map((input) => [input.input_id, input]));
  for (const input of recipe.inputs) {
    const actual = await describeFile(input.input_id, paths.get(input.input_id), releaseRoot);
    if (actual.sha256 !== inputManifest.get(input.input_id)?.sha256) {
      throw new Error(`${input.input_id}: quarantined input checksum no longer matches acquisition manifest`);
    }
  }

  const stepRecords = [];
  for (const step of recipe.steps) {
    for (const outputId of step.outputs) {
      try {
        await stat(paths.get(outputId));
        throw new Error(`${step.step_id}: refuses to overwrite ${outputId}`);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      await mkdir(path.dirname(paths.get(outputId)), { recursive: true });
    }
    const argv = step.argv.map((argument) => resolveArg(argument, paths, releaseRoot));
    const startedAt = isoNow(clock);
    await execute(step.tool, argv);
    const finishedAt = isoNow(clock);
    const [inputs, outputs] = await Promise.all([
      Promise.all(step.inputs.map((id) => describeFile(id, paths.get(id), releaseRoot))),
      Promise.all(step.outputs.map((id) => describeFile(id, paths.get(id), releaseRoot)))
    ]);
    stepRecords.push({
      step_id: step.step_id,
      tool: step.tool,
      tool_version: toolVersion(lock, step.tool),
      argv,
      started_at: startedAt,
      finished_at: finishedAt,
      inputs,
      outputs
    });
  }

  const inspected = await Promise.all(
    recipe.outputs.map((output) => inspectOutput(output, paths.get(output.asset_id), execute, releaseRoot))
  );
  const outputs = inspected.map((item) => item.artifact);
  const registryGate = await licenceAndRegistryGate(registry, recipe, acquisition, releaseRoot);
  const crossRelease = await crossReleaseGate(recipe, outputs, releaseRoot);
  const contractFailures = await qualityGateFailures(recipe, paths);
  const acquisitionFailures = acquisition.qa_events
    .filter((event) => event.severity === "hard_fail")
    .map((event) => `${event.code}: ${event.message}`);
  const acquisitionWarnings = acquisition.qa_events
    .filter((event) => event.severity === "warning")
    .map((event) => `${event.code}: ${event.message}`);
  const hardFailures = [
    ...registryGate.hardFailures,
    ...acquisitionFailures,
    ...inspected.flatMap((item) => item.hardFailures),
    ...contractFailures,
    ...crossRelease.hardFailures
  ];
  const warnings = [
    ...registryGate.warnings,
    ...acquisitionWarnings,
    ...inspected.flatMap((item) => item.warnings),
    ...crossRelease.warnings
  ];
  const checkedAt = isoNow(clock);
  const qa = {
    result: hardFailures.length === 0 ? "pass" : "fail",
    checked_at: checkedAt,
    checks: qaChecks(hardFailures, warnings),
    hard_failures: hardFailures,
    warnings
  };

  const lineage = {
    schema_version: "1.0.0",
    release_id: recipe.release_id,
    created_at: checkedAt,
    toolchain: {
      lock_path: path.relative(repositoryRoot, lockPath).split(path.sep).join("/"),
      sha256: await sha256File(lockPath),
      container_image: lock.container_image,
      versions: lock.tools,
      verification: toolVerification
    },
    registry_snapshot: { path: "snapshots/source-registry.json", sha256: await sha256File(registryPath) },
    recipe_snapshot: { path: "snapshots/publication-recipe.json", sha256: await sha256File(recipePath) },
    acquisition_manifest: { path: "manifests/acquisition.json", sha256: await sha256File(acquisitionPath) },
    licence_snapshots: await Promise.all(acquisition.licence_snapshots.map((item) =>
      describeFile(item.dataset_id, resolveInside(releaseRoot, item.path), releaseRoot)
    )),
    steps: stepRecords,
    outputs,
    qa
  };
  await validateDocument("lineage", lineage, "generated lineage manifest");

  const retrievedAtBySource = new Map();
  for (const input of acquisition.inputs) {
    const current = retrievedAtBySource.get(input.dataset_id);
    if (!current || input.retrieved_at > current) retrievedAtBySource.set(input.dataset_id, input.retrieved_at);
  }
  const outputContracts = new Map(recipe.outputs.map((output) => [output.asset_id, output]));
  const candidate = {
    schema_version: "1.0.0",
    release_id: recipe.release_id,
    dataset_version: recipe.dataset_version,
    created_at: checkedAt,
    published_at: null,
    registry_commit: acquisition.code_commit,
    code_commit: acquisition.code_commit,
    supersedes: recipe.supersedes ?? null,
    superseded_by: null,
    promotion: { mode: "manual", identity: registry.release_authority },
    gate: {
      version: "launch-gate-1.0.0",
      result: qa.result,
      checked_at: checkedAt,
      checks: qa.checks,
      hard_failures: hardFailures,
      warnings
    },
    datasets: recipe.datasets.map((dataset) => ({
      dataset_id: dataset.dataset_id,
      evidence_version: dataset.evidence_version,
      title: dataset.title,
      provider: dataset.provider,
      licence: dataset.licence,
      attribution: dataset.attribution,
      classification: dataset.classification,
      observation_dates: dataset.observation_dates,
      retrieved_at: dataset.source_dataset_ids
        .map((id) => retrievedAtBySource.get(id))
        .filter(Boolean)
        .sort()
        .at(-1),
      published_at: null,
      method: dataset.method,
      uncertainty: dataset.uncertainty,
      limitations: dataset.limitations,
      lineage: dataset.source_dataset_ids.map((id) => `source:${id}`)
    })),
    assets: outputs
      .map((artifact) => ({ artifact, contract: outputContracts.get(artifact.id) }))
      .filter(({ contract }) => contract.visibility === "public")
      .map(({ artifact, contract }) => ({
        asset_id: artifact.id,
        dataset_id: contract.dataset_id,
        media_type: contract.media_type,
        url: `${recipe.public_asset_origin.replace(/\/$/, "")}/releases/${recipe.release_id}/assets/${path.basename(contract.path)}`,
        bytes: artifact.bytes,
        sha256: artifact.sha256
      }))
  };
  await validateDocument("release", candidate, "generated candidate release manifest");
  await Promise.all([
    writeCanonical(path.join(releaseRoot, "manifests/lineage.json"), lineage, { exclusive: true }),
    writeCanonical(path.join(releaseRoot, "manifests/candidate-release.json"), candidate, { exclusive: true }),
    writeCanonical(path.join(releaseRoot, "reports/qa.json"), qa, { exclusive: true }),
    writeFile(path.join(releaseRoot, "reports/qa.md"), qaMarkdown(qa), { encoding: "utf8", flag: "wx" })
  ]);
  return { lineage, candidate, qa };
}

export async function reproduceRelease({ archiveRoot, workspaceRoot, clock, runner }) {
  const expected = await readJson(path.join(archiveRoot, "manifests/lineage.json"));
  await validateDocument("lineage", expected, "archived lineage manifest");
  const releaseRoot = path.join(workspaceRoot, expected.release_id);
  await mkdir(workspaceRoot, { recursive: true });
  await mkdir(releaseRoot);
  for (const directory of ["snapshots", "quarantine", "manifests", "outputs", "private", "reports"]) {
    await mkdir(path.join(releaseRoot, directory));
  }
  await Promise.all([
    cp(path.join(archiveRoot, "snapshots"), path.join(releaseRoot, "snapshots"), { recursive: true, force: false }),
    cp(path.join(archiveRoot, "quarantine"), path.join(releaseRoot, "quarantine"), { recursive: true, force: false }),
    copyFile(path.join(archiveRoot, "manifests/acquisition.json"), path.join(releaseRoot, "manifests/acquisition.json"))
  ]);
  const rebuilt = await buildRelease({ releaseRoot, clock, runner });
  const expectedOutputs = new Map(expected.outputs.map((output) => [output.id, output.sha256]));
  const mismatches = rebuilt.lineage.outputs
    .filter((output) => expectedOutputs.get(output.id) !== output.sha256)
    .map((output) => output.id);
  if (mismatches.length > 0) throw new Error(`Reproduction checksum mismatch: ${mismatches.join(", ")}`);
  return { releaseRoot, outputs: rebuilt.lineage.outputs };
}

export async function verifyArchive(releaseRoot) {
  const lineage = await readJson(path.join(releaseRoot, "manifests/lineage.json"));
  await validateDocument("lineage", lineage, "archived lineage manifest");
  const checks = [lineage.registry_snapshot, lineage.recipe_snapshot, lineage.acquisition_manifest];
  for (const item of checks) {
    const actual = await sha256File(resolveInside(releaseRoot, item.path));
    if (actual !== item.sha256) throw new Error(`${item.path}: archived checksum mismatch`);
  }
  for (const snapshot of lineage.licence_snapshots) {
    const actual = await sha256File(resolveInside(releaseRoot, snapshot.path));
    if (actual !== snapshot.sha256) throw new Error(`${snapshot.id}: licence snapshot checksum mismatch`);
  }
  for (const output of lineage.outputs) {
    const actual = await sha256File(resolveInside(releaseRoot, output.path));
    if (actual !== output.sha256) throw new Error(`${output.id}: output checksum mismatch`);
  }
  return { release_id: lineage.release_id, verified_outputs: lineage.outputs.length };
}

export function manifestDigest(manifest) {
  return sha256Text(canonicalJson(manifest));
}
