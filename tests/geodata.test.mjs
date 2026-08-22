import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  acquireRelease,
  buildRelease,
  inspectOutput,
  loadContracts,
  reproduceRelease,
  resolveAcquisitionTarget,
  reuseAcquisition,
  verifyArchive
} from "../tooling/geodata/src/pipeline.mjs";
import {
  isMissingObjectError,
  publishRelease,
  restoreCurrentPointer,
  S3R2Store,
  stageRelease,
  withdrawRelease,
  WranglerR2Store
} from "../tooling/geodata/src/r2.mjs";
import { readJson } from "../tooling/geodata/src/runtime.mjs";

const repositoryRoot = path.resolve(new URL("../", import.meta.url).pathname);
const fixedDate = new Date("2026-08-13T10:00:00Z");
const clock = () => fixedDate;
const commit = "1".repeat(40);

test("Wrangler R2 stores accept only explicit supported jurisdictions", () => {
  assert.equal(new WranglerR2Store({ bucket: "test", jurisdiction: "eu" }).jurisdiction, "eu");
  assert.throws(
    () => new WranglerR2Store({ bucket: "test", jurisdiction: "unknown" }),
    /Unsupported R2 jurisdiction/
  );
});

test("S3 R2 stores remain bound to an explicit bucket and jurisdiction endpoint", () => {
  const store = new S3R2Store({
    bucket: "bca-wales-public-releases",
    accountId: "a".repeat(32),
    accessKeyId: "access-key",
    secretAccessKey: "secret-key",
    jurisdiction: "eu"
  });
  assert.equal(store.endpoint, `https://${"a".repeat(32)}.eu.r2.cloudflarestorage.com`);
  assert.equal(
    store.objectUrl("releases/release-test/assets/a-file.json"),
    `https://${"a".repeat(32)}.eu.r2.cloudflarestorage.com/bca-wales-public-releases/releases/release-test/assets/a-file.json`
  );
  assert.throws(() => store.objectUrl("../other-bucket/secret"), /Unsafe R2 object key/);
});

test("Wrangler's jurisdictional missing-key response is treated as an absent optional object", () => {
  assert.equal(isMissingObjectError(new Error("The specified key does not exist.")), true);
  assert.equal(isMissingObjectError(new Error("Access denied")), false);
});

test("Planetary Computer acquisition signs only the reviewed Landsat mirror and records no SAS query", async () => {
  const asset = "https://landsateuwest.blob.core.windows.net/landsat-c2/example.TIF";
  const target = await resolveAcquisitionTarget(`planetary:${asset}`, async (url) => {
    assert.equal(url.hostname, "planetarycomputer.microsoft.com");
    assert.equal(url.searchParams.get("href"), asset);
    return new Response(JSON.stringify({ href: `${asset}?sig=temporary` }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  });
  assert.equal(target.recordUrl, asset);
  assert.equal(target.fetchUrl, `${asset}?sig=temporary`);
});

test("binary mirror media types are validated by their file contracts instead of generic transport headers", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-octet-stream-test-"));
  context.after(() => rm(root, { recursive: true }));
  const source = path.join(root, "source.tif");
  await writeFile(source, Buffer.from([0x49, 0x49, 0x2a, 0x00, 0, 0, 0, 0]));
  const contracts = await fixture(root);
  const registry = await readJson(contracts.registryPath);
  registry.sources[0].acquisition.media_type = "image/tiff";
  registry.sources[0].schema = { geometry: "raster", nodata: "none" };
  registry.sources[0].contract.output_profiles = ["cog", "accessible_csv"];
  const recipe = await readJson(contracts.recipePath);
  recipe.inputs[0].media_type = "image/tiff";
  recipe.inputs[0].source = "https://example.invalid/source.tif";
  recipe.inputs[0].destination = "quarantine/source.tif";
  await Promise.all([
    writeFile(contracts.registryPath, JSON.stringify(registry)),
    writeFile(contracts.recipePath, JSON.stringify(recipe))
  ]);
  const acquired = await acquireRelease({
    ...contracts,
    workspaceRoot: path.join(root, "work"),
    codeCommit: commit,
    clock,
    allowNetwork: true,
    fetchImpl: async () => {
      const response = new Response(await readFile(source), {
        status: 200,
        headers: { "content-type": "application/octet-stream" }
      });
      Object.defineProperty(response, "url", { value: "https://example.invalid/source.tif" });
      return response;
    }
  });
  assert.equal(acquired.manifest.qa_events.some((event) => event.code === "SOURCE_MEDIA_TYPE_CHANGED"), false);
});

test("remote acquisition retries transient stream failures without retaining partial bytes", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-acquisition-retry-test-"));
  context.after(() => rm(root, { recursive: true }));
  const source = path.join(root, "source.tif");
  const sourceBytes = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0, 0, 0, 0]);
  await writeFile(source, sourceBytes);
  const contracts = await fixture(root);
  const registry = await readJson(contracts.registryPath);
  registry.sources[0].acquisition.media_type = "image/tiff";
  registry.sources[0].schema = { geometry: "raster", nodata: "none" };
  registry.sources[0].contract.output_profiles = ["cog", "accessible_csv"];
  const recipe = await readJson(contracts.recipePath);
  recipe.inputs[0].media_type = "image/tiff";
  recipe.inputs[0].source = "https://example.invalid/source.tif";
  recipe.inputs[0].destination = "quarantine/source.tif";
  recipe.inputs[0].expected_sha256 = createHash("sha256").update(sourceBytes).digest("hex");
  await Promise.all([
    writeFile(contracts.registryPath, JSON.stringify(registry)),
    writeFile(contracts.recipePath, JSON.stringify(recipe))
  ]);
  let attempts = 0;
  const acquired = await acquireRelease({
    ...contracts,
    workspaceRoot: path.join(root, "work"),
    codeCommit: commit,
    clock,
    allowNetwork: true,
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError("fetch failed");
      const response = new Response(await readFile(source), {
        status: 200,
        headers: { "content-type": "application/octet-stream" }
      });
      Object.defineProperty(response, "url", { value: "https://example.invalid/source.tif" });
      return response;
    }
  });
  assert.equal(attempts, 2);
  assert.equal(acquired.manifest.inputs[0].checksum_status, "matched");
  assert.equal(acquired.manifest.inputs[0].sha256, recipe.inputs[0].expected_sha256);
});

class MemoryStore {
  objects = new Map();

  async putFile(key, file) {
    this.objects.set(key, await readFile(file));
  }

  async getFile(key, destination) {
    const value = this.objects.get(key);
    if (!value) throw new Error("404 not found");
    await writeFile(destination, value, { flag: "wx" });
  }

  async getOptional(key, destination) {
    if (!this.objects.has(key)) return false;
    await this.getFile(key, destination);
    return true;
  }
}

async function fixture(root) {
  const termsContent = "Test licence terms snapshot.\n";
  const termsPath = path.join(root, "terms/test.txt");
  await mkdir(path.dirname(termsPath), { recursive: true });
  await writeFile(termsPath, termsContent);
  const termsSha = createHash("sha256").update(termsContent).digest("hex");
  const sourceFile = path.join(root, "source.geojson");
  await writeFile(sourceFile, JSON.stringify({
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { name: "Blorenge", code: "33WFL" },
      geometry: { type: "Point", coordinates: [-3.06, 51.79] }
    }]
  }));
  const registry = {
    schema_version: "1.0.0",
    registry_id: "test-registry",
    reviewed_at: "2026-08-13T09:00:00Z",
    release_authority: "timjroberts",
    status: "approved",
    status_reason: "Test contract is approved.",
    area_of_interest: {},
    hard_gaps: [],
    deferred_enhancements: [],
    sources: [{
      dataset_id: "source-one",
      title: "Source one",
      purpose: "Toolchain test",
      classification: "authoritative",
      provider: "Test provider",
      provider_dataset_id: "source-one",
      landing_url: "https://example.invalid/source",
      acquisition: { method: "local fixture", url: sourceFile, media_type: "application/geo+json" },
      upstream: { publication_date: "2026-08-13", refresh_policy: "manual" },
      licence: { id: "test", url: "https://example.invalid/terms", attribution: "Test attribution", reviewed_at: "2026-08-13" },
      schema: { geometry: "Point", required_fields: ["name", "code"] },
      transformation: "Copy the exact fixture.",
      known_gaps: [],
      safety: "public_safe",
      publication: "approved_candidate",
      contract: {
        owner: "timjroberts",
        temporal_role: "test observation",
        licence_terms: { snapshot_path: "terms/test.txt", sha256: termsSha },
        recipe: { id: "source-one", version: "1.0.0" },
        output_profiles: ["geojson", "accessible_csv"],
        refresh: { mode: "manual", maximum_age_days: 30, approved_change_bounds: {} },
        retention: "Retain published inputs.",
        withdrawal: "Withdraw the pointer."
      }
    }]
  };
  const recipe = {
    schema_version: "1.0.0",
    recipe_id: "test-recipe",
    recipe_version: "1.0.0",
    release_id: "release-test-001",
    dataset_version: "test-001",
    registry_id: "test-registry",
    public_asset_origin: "https://assets.example.invalid",
    supersedes: null,
    inputs: [{
      input_id: "source-one-input",
      dataset_id: "source-one",
      source: sourceFile,
      destination: "quarantine/source.geojson",
      media_type: "application/geo+json",
      maximum_bytes: 10000,
      expected_sha256: null
    }],
    intermediates: [],
    steps: [
      {
        step_id: "copy-geojson",
        tool: "ogr2ogr",
        argv: ["-f", "GeoJSON", "{artifact:public-geojson}", "{artifact:source-one-input}"],
        inputs: ["source-one-input"],
        outputs: ["public-geojson"]
      },
      {
        step_id: "make-csv",
        tool: "python3",
        argv: ["/repo/tooling/geodata/recipes/geojson_to_csv.py", "{artifact:public-geojson}", "{artifact:accessible-csv}", "name", "code"],
        inputs: ["public-geojson"],
        outputs: ["accessible-csv"]
      }
    ],
    outputs: [
      {
        asset_id: "public-geojson",
        dataset_id: "published-one",
        path: "outputs/public.geojson",
        profile: "geojson",
        media_type: "application/geo+json",
        visibility: "public",
        accessible_description: "Test geometry.",
        qa: { minimum_bytes: 20, minimum_features: 1, required_fields: ["name", "code"] }
      },
      {
        asset_id: "accessible-csv",
        dataset_id: "published-one",
        path: "outputs/public.csv",
        profile: "accessible_csv",
        media_type: "text/csv",
        visibility: "public",
        accessible_description: "Test non-map table.",
        qa: { minimum_bytes: 10, minimum_rows: 1, required_fields: ["name", "code"] }
      }
    ],
    datasets: [{
      dataset_id: "published-one",
      source_dataset_ids: ["source-one"],
      evidence_version: "test-001",
      title: "Published test",
      provider: "Test provider",
      licence: "Test terms",
      attribution: "Test attribution",
      classification: "authoritative",
      observation_dates: ["2026-08-13"],
      method: "Test-only copy.",
      uncertainty: "No real evidence.",
      limitations: ["Test only."]
    }],
    cross_release_qa: {
      baseline_manifest: null,
      maximum_asset_growth_ratio: 2,
      maximum_feature_change_ratio: 0
    }
  };
  const registryPath = path.join(root, "registry.json");
  const recipePath = path.join(root, "recipe.json");
  await Promise.all([
    writeFile(registryPath, JSON.stringify(registry)),
    writeFile(recipePath, JSON.stringify(recipe))
  ]);
  return { registryPath, recipePath };
}

function localRunner(releaseRoot) {
  const host = (containerPath) => path.join(releaseRoot, containerPath.replace(/^\/work\//, ""));
  return async (tool, argv) => {
    if (argv[0] === "--version" || (tool === "pmtiles" && argv[0] === "version")) {
      const versions = {
        gdalinfo: "GDAL 3.13.2",
        tippecanoe: "tippecanoe v2.62.2",
        pmtiles: "pmtiles 1.30.0",
        python3: "Python 3.14"
      };
      return { stdout: `${versions[tool]}\n`, stderr: "" };
    }
    if (tool === "ogr2ogr") await copyFile(host(argv[3]), host(argv[2]));
    else if (tool === "python3") {
      const document = JSON.parse(await readFile(host(argv[1]), "utf8"));
      const rows = document.features.map((feature) => `${feature.properties.name},${feature.properties.code}`);
      await writeFile(host(argv[2]), `name,code\n${rows.join("\n")}\n`);
    } else if (tool === "pmtiles") return { stdout: "archive valid\n", stderr: "" };
    else if (tool === "gdalinfo") return {
      stdout: JSON.stringify({
        metadata: { IMAGE_STRUCTURE: { LAYOUT: "COG" } },
        coordinateSystem: { wkt: "PROJCRS[...]" },
        stac: { "proj:epsg": 32630 },
        geoTransform: [0, 10, 0, 0, 0, -10],
        bands: [{ description: "delta_NDVI" }]
      }),
      stderr: ""
    };
    else throw new Error(`Unexpected tool ${tool}`);
    return { stdout: "", stderr: "" };
  };
}

test("the launch registry and example recipe satisfy the final contracts", async () => {
  const loaded = await loadContracts({
    registryPath: path.join(repositoryRoot, "data/launch/source-registry.json"),
    recipePath: path.join(repositoryRoot, "config/publication/recipe.example.json")
  });
  assert.equal(loaded.registry.schema_version, "1.0.0");
  assert.equal(loaded.recipe.outputs.some((output) => output.profile === "accessible_csv"), true);
});

test("the factual release-two recipe pins the expanded AOI and component contracts", async () => {
  const loaded = await loadContracts({
    registryPath: path.join(repositoryRoot, "data/launch/source-registry.json"),
    recipePath: path.join(repositoryRoot, "data/launch/publication-recipe-2026-08-21.json")
  });
  assert.equal(loaded.recipe.release_id, "release-blorenge-2026-08-21.8");
  assert.equal(loaded.recipe.recipe_version, "2.1.1");
  assert.equal(loaded.recipe.supersedes, "release-blorenge-2026-08-13.6");
  assert.equal(loaded.recipe.spatial_contract.core_version, "2026-08-21.1");
  assert.equal(loaded.recipe.inputs.filter((item) => item.input_id.startsWith("lidar-") && item.input_id !== "lidar-catalogue").length, 163);
  assert.equal(loaded.recipe.inputs.filter((item) => item.input_id.endsWith("-nir20")).length, 4);
  assert.deepEqual(
    loaded.recipe.inputs
      .filter((item) => item.input_id.startsWith("s2-post-primary-"))
      .map((item) => item.expected_sha256),
    [
      "105e0cf7af60e739fd63144453f61c8ba40258ce0ae69e9e197d648b69ee6e58",
      "6ae8cf08d918973a65ee39bf296f0bbc6d41b67518d0576013a4983e427a54e4",
      "afad123898fa827341c482c5c29ef9a2df5ec2a1bd80a81177b297643454bb76",
      "b72178273f1d58b94ddedfc176163bb6024bebad3210f67f9b279dd245053ee4",
      "881ea6eeb8053aa99fe7d2f8288f2b8e7c430488d808d015ac3f3a59f918e034",
      "c43552a40dc3e89b10727b70ea305c4d1b7913174336de9c51e1a82e5eabddf5"
    ]
  );
  assert.equal(loaded.recipe.outputs.find((item) => item.asset_id === "ndvi-cog").qa.maximum_bytes, 32 * 1024 * 1024);
  assert.equal(loaded.recipe.outputs.find((item) => item.asset_id === "ndmi-pmtiles").qa.maximum_bytes, 8 * 1024 * 1024);
  assert.equal(loaded.recipe.quality_gates[0].assertions.length, 7);
  const changeStep = loaded.recipe.steps.find((step) => step.step_id === "build-change-evidence-v2");
  assert.deepEqual(changeStep.argv.slice(changeStep.argv.indexOf("--post-primary") + 1, changeStep.argv.indexOf("--post-fill")), [
    "{artifact:s2-post-primary-red}",
    "{artifact:s2-post-primary-nir}",
    "{artifact:s2-post-primary-nir20}",
    "{artifact:s2-post-primary-swir1}",
    "{artifact:s2-post-primary-swir2}",
    "{artifact:s2-post-primary-scl}"
  ]);
  assert.equal(changeStep.argv.includes("--post-provenance-10m"), true);
  assert.equal(changeStep.argv.includes("--post-provenance-20m"), true);
  assert.deepEqual(changeStep.argv.slice(changeStep.argv.indexOf("--effis"), changeStep.argv.indexOf("--effis") + 4), [
    "--effis", "{artifact:effis-release-one}", "--current-effis", "{artifact:effis-bounded}"
  ]);
  const effisDataset = loaded.recipe.datasets.find((dataset) => dataset.dataset_id === "effis-event");
  assert.equal(effisDataset.classification, "historical");
  assert.match(effisDataset.method, /BCA-inferred re-key/);
  const provenanceOutputs = loaded.recipe.outputs.filter((output) => output.asset_id.startsWith("post-provenance-"));
  assert.deepEqual(provenanceOutputs.map((output) => output.qa.expected_resolution_m), [10, 20]);
  assert.equal(provenanceOutputs.every((output) => output.visibility === "public"), true);
});

test("acquisition, build, archive verification and reproduction preserve exact lineage", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-geodata-test-"));
  context.after(() => rm(root, { recursive: true }));
  const contracts = await fixture(root);
  const acquired = await acquireRelease({
    ...contracts,
    workspaceRoot: path.join(root, "work"),
    codeCommit: commit,
    clock
  });
  const built = await buildRelease({
    releaseRoot: acquired.releaseRoot,
    clock,
    runner: localRunner(acquired.releaseRoot)
  });
  assert.equal(built.qa.result, "pass");
  assert.deepEqual(built.qa.hard_failures, []);
  assert.equal(built.candidate.assets.length, 2);
  assert.deepEqual(await verifyArchive(acquired.releaseRoot), {
    release_id: "release-test-001",
    verified_outputs: 2
  });

  const reproduced = await reproduceRelease({
    archiveRoot: acquired.releaseRoot,
    workspaceRoot: path.join(root, "reproduced"),
    clock,
    runner: localRunner(path.join(root, "reproduced/release-test-001"))
  });
  assert.deepEqual(
    reproduced.outputs.map((output) => output.sha256),
    built.lineage.outputs.map((output) => output.sha256)
  );
});

test("reviewed retained inputs can seed a superseding recipe without a second network acquisition", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-retained-input-test-"));
  context.after(() => rm(root, { recursive: true }));
  const contracts = await fixture(root);
  const acquired = await acquireRelease({
    ...contracts,
    workspaceRoot: path.join(root, "work"),
    codeCommit: commit,
    clock
  });
  const recipe = await readJson(contracts.recipePath);
  recipe.release_id = "release-test-002";
  recipe.dataset_version = "2026-08-13.2";
  recipe.inputs[0].expected_sha256 = acquired.manifest.inputs[0].sha256;
  await writeFile(contracts.recipePath, JSON.stringify(recipe));

  const reused = await reuseAcquisition({
    archiveRoot: acquired.releaseRoot,
    ...contracts,
    workspaceRoot: path.join(root, "retained"),
    codeCommit: commit,
    clock
  });
  assert.equal(reused.manifest.release_id, "release-test-002");
  assert.equal(reused.manifest.inputs[0].retrieved_at, acquired.manifest.inputs[0].retrieved_at);
  assert.equal(reused.manifest.inputs[0].checksum_status, "matched");
  assert.equal(reused.manifest.qa_events.at(-1).code, "RETAINED_INPUTS_REUSED");
});

test("PMTiles v3 and COG output checks use package-aware verification", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-formats-test-"));
  context.after(() => rm(root, { recursive: true }));
  await mkdir(path.join(root, "outputs"));
  const pmtiles = path.join(root, "outputs/test.pmtiles");
  const cog = path.join(root, "outputs/test.tif");
  await writeFile(pmtiles, Buffer.concat([Buffer.from("PMTiles"), Buffer.from([3]), Buffer.alloc(32)]));
  await writeFile(cog, Buffer.concat([Buffer.from([0x49, 0x49, 0x2a, 0x00]), Buffer.alloc(32)]));
  const runner = localRunner(root);
  const pmtilesResult = await inspectOutput({
    asset_id: "tiles",
    profile: "raster_pmtiles",
    qa: { minimum_bytes: 8 }
  }, pmtiles, runner, root);
  const cogResult = await inspectOutput({
    asset_id: "analysis-cog",
    profile: "cog",
    qa: { minimum_bytes: 4 }
  }, cog, runner, root);
  assert.deepEqual(pmtilesResult.hardFailures, []);
  assert.deepEqual(cogResult.hardFailures, []);
});

test("COG and byte-ceiling contracts fail closed on analytical drift", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-raster-contract-test-"));
  context.after(() => rm(root, { recursive: true }));
  await mkdir(path.join(root, "outputs"));
  const cog = path.join(root, "outputs/component.tif");
  await writeFile(cog, Buffer.concat([Buffer.from([0x49, 0x49, 0x2a, 0x00]), Buffer.alloc(32)]));
  const result = await inspectOutput({
    asset_id: "ndvi-cog",
    profile: "cog",
    qa: {
      minimum_bytes: 4,
      maximum_bytes: 32,
      expected_crs: "EPSG:27700",
      expected_resolution_m: 20,
      expected_band_count: 2,
      expected_band_descriptions: ["delta_NDVI", "validity"]
    }
  }, cog, localRunner(root), root);
  assert.equal(result.hardFailures.some((failure) => failure.includes("exceeds 32")), true);
  assert.equal(result.hardFailures.some((failure) => failure.includes("expected 2 bands")), true);
  assert.equal(result.hardFailures.some((failure) => failure.includes("pixel resolution")), true);
  assert.equal(result.hardFailures.some((failure) => failure.includes("CRS does not match")), true);
});

test("recipe quality assertions are evaluated from recorded JSON artifacts", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-quality-gate-test-"));
  context.after(() => rm(root, { recursive: true }));
  const contracts = await fixture(root);
  const recipe = await readJson(contracts.recipePath);
  recipe.quality_gates = [{
    gate_id: "expanded-aoi-scene-qa",
    report_artifact_id: "public-geojson",
    assertions: [{
      path: "features.0.properties.name",
      operator: "eq",
      value: "A different core",
      message: "The expanded-AOI scene contract must pass before promotion"
    }]
  }];
  await writeFile(contracts.recipePath, JSON.stringify(recipe));
  const acquired = await acquireRelease({
    ...contracts,
    workspaceRoot: path.join(root, "work"),
    codeCommit: commit,
    clock
  });
  const built = await buildRelease({
    releaseRoot: acquired.releaseRoot,
    clock,
    runner: localRunner(acquired.releaseRoot)
  });
  assert.equal(built.qa.result, "fail");
  assert.equal(built.qa.hard_failures.some((failure) => failure.includes("expanded-aoi-scene-qa")), true);
});

test("spatial contracts pin the canonical core checksum and every AOI-dependent dataset", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-spatial-contract-test-"));
  context.after(() => rm(root, { recursive: true }));
  const contracts = await fixture(root);
  const recipe = await readJson(contracts.recipePath);
  const sourceBytes = await readFile(path.join(root, "source.geojson"));
  const sourceSha = createHash("sha256").update(sourceBytes).digest("hex");
  recipe.inputs[0].expected_sha256 = sourceSha;
  recipe.spatial_contract = {
    core_input_id: "source-one-input",
    core_label: "BCA-area of interest",
    core_version: "2026-08-21.1",
    core_sha256: sourceSha,
    buffer_distance_m: 2000,
    buffer_crs: "EPSG:27700",
    clip_mode: "exact",
    aoi_dependent_input_ids: ["source-one-input"],
    aoi_dependent_dataset_ids: ["published-one"],
    rebuild_aoi_dependent_inputs: true
  };
  await writeFile(contracts.recipePath, JSON.stringify(recipe));
  const loaded = await loadContracts(contracts);
  assert.equal(loaded.recipe.spatial_contract.buffer_distance_m, 2000);

  const acquired = await acquireRelease({
    ...contracts,
    workspaceRoot: path.join(root, "work"),
    codeCommit: commit,
    clock
  });
  const retained = await reuseAcquisition({
    archiveRoot: acquired.releaseRoot,
    ...contracts,
    workspaceRoot: path.join(root, "retained-same-spatial-contract"),
    codeCommit: commit,
    clock
  });
  assert.equal(retained.manifest.qa_events.at(-1).code, "MATCHED_SPATIAL_ACQUISITION_RETAINED");

  recipe.spatial_contract.buffer_distance_m = 2500;
  await writeFile(contracts.recipePath, JSON.stringify(recipe));
  await assert.rejects(reuseAcquisition({
    archiveRoot: acquired.releaseRoot,
    ...contracts,
    workspaceRoot: path.join(root, "retained"),
    codeCommit: commit,
    clock
  }), /requires a fresh matching acquisition of AOI-dependent inputs/);

  recipe.spatial_contract.buffer_distance_m = 2000;
  recipe.spatial_contract.core_sha256 = "0".repeat(64);
  await writeFile(contracts.recipePath, JSON.stringify(recipe));
  await assert.rejects(loadContracts(contracts), /core checksum must match/);
});

test("publication changes the current pointer only after verified immutable uploads", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-publish-test-"));
  context.after(() => rm(root, { recursive: true }));
  const contracts = await fixture(root);
  const acquired = await acquireRelease({
    ...contracts,
    workspaceRoot: path.join(root, "work"),
    codeCommit: commit,
    clock
  });
  await buildRelease({ releaseRoot: acquired.releaseRoot, clock, runner: localRunner(acquired.releaseRoot) });
  const store = new MemoryStore();
  const published = await publishRelease({
    releaseRoot: acquired.releaseRoot,
    store,
    identity: "timjroberts",
    mode: "manual",
    clock
  });
  assert.equal(published.pointer.status, "current");
  assert.equal(store.objects.has("releases/current.json"), true);
  assert.equal(store.objects.has("releases/release-test-001/manifest.json"), true);
  assert.equal(store.objects.has("releases/release-test-001/assets/public.geojson"), true);

  const withdrawn = await withdrawRelease({
    releaseRoot: acquired.releaseRoot,
    store,
    expectedReleaseId: "release-test-001",
    identity: "timjroberts",
    reason: "Controlled withdrawal rehearsal",
    clock
  });
  assert.equal(withdrawn.pointer.status, "withdrawn");
  assert.equal(store.objects.has("releases/release-test-001/assets/public.geojson"), true, "withdrawal preserves immutable assets");
  assert.equal(JSON.parse(store.objects.get("releases/current.json").toString()).status, "withdrawn");
});

test("staging publishes immutable release assets without changing the current pointer", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-stage-test-"));
  context.after(() => rm(root, { recursive: true }));
  const contracts = await fixture(root);
  const acquired = await acquireRelease({
    ...contracts,
    workspaceRoot: path.join(root, "work"),
    codeCommit: commit,
    clock
  });
  await buildRelease({ releaseRoot: acquired.releaseRoot, clock, runner: localRunner(acquired.releaseRoot) });
  const store = new MemoryStore();
  const staged = await stageRelease({
    releaseRoot: acquired.releaseRoot,
    store,
    identity: "timjroberts",
    clock
  });
  assert.equal(staged.release.published_at, fixedDate.toISOString());
  assert.equal(store.objects.has("releases/release-test-001/manifest.json"), true);
  assert.equal(store.objects.has("releases/release-test-001/assets/public.geojson"), true);
  assert.equal(store.objects.has("releases/current.json"), false);

  const published = await publishRelease({
    releaseRoot: acquired.releaseRoot,
    store,
    identity: "timjroberts",
    mode: "manual",
    clock
  });
  assert.equal(published.uploads.every((upload) => upload.uploaded === false), true);
  assert.equal(store.objects.has("releases/current.json"), true);
});

test("pointer restoration verifies retained immutable release objects before writing current", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-restore-pointer-test-"));
  context.after(() => rm(root, { recursive: true }));
  const contracts = await fixture(root);
  const acquired = await acquireRelease({
    ...contracts,
    workspaceRoot: path.join(root, "work"),
    codeCommit: commit,
    clock
  });
  await buildRelease({ releaseRoot: acquired.releaseRoot, clock, runner: localRunner(acquired.releaseRoot) });
  const store = new MemoryStore();
  const published = await publishRelease({
    releaseRoot: acquired.releaseRoot,
    store,
    identity: "timjroberts",
    mode: "manual",
    clock
  });
  store.objects.delete("releases/current.json");

  const restored = await restoreCurrentPointer({
    store,
    releaseId: "release-test-001",
    expectedManifestSha256: published.pointer.manifest_sha256,
    identity: "timjroberts",
    publicAssetOrigin: "https://assets.example.invalid"
  });
  assert.equal(restored.verifiedAssets, 2);
  assert.deepEqual(JSON.parse(store.objects.get("releases/current.json").toString()), published.pointer);
});

test("pointer restoration refuses a corrupt immutable asset and leaves current absent", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-restore-pointer-corrupt-test-"));
  context.after(() => rm(root, { recursive: true }));
  const contracts = await fixture(root);
  const acquired = await acquireRelease({
    ...contracts,
    workspaceRoot: path.join(root, "work"),
    codeCommit: commit,
    clock
  });
  await buildRelease({ releaseRoot: acquired.releaseRoot, clock, runner: localRunner(acquired.releaseRoot) });
  const store = new MemoryStore();
  const published = await publishRelease({
    releaseRoot: acquired.releaseRoot,
    store,
    identity: "timjroberts",
    mode: "manual",
    clock
  });
  store.objects.delete("releases/current.json");
  store.objects.set("releases/release-test-001/assets/public.geojson", Buffer.from("corrupt"));

  await assert.rejects(restoreCurrentPointer({
    store,
    releaseId: "release-test-001",
    expectedManifestSha256: published.pointer.manifest_sha256,
    identity: "timjroberts",
    publicAssetOrigin: "https://assets.example.invalid"
  }), /immutable asset does not match/);
  assert.equal(store.objects.has("releases/current.json"), false);
});

test("a failed gate cannot upload or promote anything", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-fail-closed-test-"));
  context.after(() => rm(root, { recursive: true }));
  const contracts = await fixture(root);
  const acquired = await acquireRelease({
    ...contracts,
    workspaceRoot: path.join(root, "work"),
    codeCommit: commit,
    clock
  });
  await buildRelease({ releaseRoot: acquired.releaseRoot, clock, runner: localRunner(acquired.releaseRoot) });
  const candidatePath = path.join(acquired.releaseRoot, "manifests/candidate-release.json");
  const candidate = await readJson(candidatePath);
  candidate.gate.result = "fail";
  candidate.gate.hard_failures = ["TEST_FAILURE"];
  await writeFile(candidatePath, JSON.stringify(candidate));
  const store = new MemoryStore();
  await assert.rejects(
    publishRelease({ releaseRoot: acquired.releaseRoot, store, identity: "timjroberts", clock }),
    /failing candidate/
  );
  assert.equal(store.objects.size, 0);
});

test("the pinned container executes a complete offline transformation", {
  skip: process.env.BCA_DOCKER_SMOKE !== "1"
}, async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-container-test-"));
  context.after(() => rm(root, { recursive: true }));
  const contracts = await fixture(root);
  const acquired = await acquireRelease({
    ...contracts,
    workspaceRoot: path.join(root, "work"),
    codeCommit: commit,
    clock
  });
  const built = await buildRelease({ releaseRoot: acquired.releaseRoot, clock });
  assert.equal(built.qa.result, "pass");
  assert.equal(built.lineage.toolchain.verification.length, 4);
  assert.equal(built.lineage.outputs.length, 2);
});
