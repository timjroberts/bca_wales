import { spawn } from "node:child_process";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  canonicalJson,
  isoNow,
  readJson,
  resolveInside,
  sha256File,
  validateDocument,
  writeCanonical
} from "./runtime.mjs";

function runWrangler(argv, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["--no-install", "wrangler", ...argv], {
      env,
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
      else reject(new Error(`wrangler exited ${code}: ${stderr.trim()}`));
    });
  });
}

function assertKey(key) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]+$/.test(key) || key.includes("..")) {
    throw new Error(`Unsafe R2 object key: ${key}`);
  }
}

export class WranglerR2Store {
  constructor({ bucket, env = process.env }) {
    if (!/^[a-z0-9][a-z0-9-]+$/.test(bucket)) throw new Error(`Unsafe R2 bucket name: ${bucket}`);
    this.bucket = bucket;
    this.env = env;
  }

  async putFile(key, file, contentType) {
    assertKey(key);
    await runWrangler([
      "r2", "object", "put", `${this.bucket}/${key}`,
      "--file", file,
      "--content-type", contentType,
      "--remote"
    ], this.env);
  }

  async getFile(key, destination) {
    assertKey(key);
    await runWrangler([
      "r2", "object", "get", `${this.bucket}/${key}`,
      "--file", destination,
      "--remote"
    ], this.env);
  }

  async getOptional(key, destination) {
    try {
      await this.getFile(key, destination);
      return true;
    } catch (error) {
      if (/404|not found|NoSuchKey/i.test(error.message)) return false;
      throw error;
    }
  }
}

async function remoteFile(store, key) {
  const directory = await mkdtemp(path.join(tmpdir(), "bca-r2-verify-"));
  const destination = path.join(directory, "object");
  const exists = await store.getOptional(key, destination);
  return {
    exists,
    destination,
    cleanup: () => rm(directory, { recursive: true })
  };
}

async function ensureImmutableUpload(store, key, localFile, contentType) {
  const localSha = await sha256File(localFile);
  const remote = await remoteFile(store, key);
  try {
    if (remote.exists) {
      const remoteSha = await sha256File(remote.destination);
      if (remoteSha !== localSha) throw new Error(`${key}: immutable remote object has different bytes`);
      return { key, sha256: localSha, uploaded: false };
    }
  } finally {
    await remote.cleanup();
  }

  await store.putFile(key, localFile, contentType);
  const verification = await remoteFile(store, key);
  try {
    if (!verification.exists || await sha256File(verification.destination) !== localSha) {
      throw new Error(`${key}: uploaded object failed checksum verification`);
    }
  } finally {
    await verification.cleanup();
  }
  return { key, sha256: localSha, uploaded: true };
}

async function readCurrent(store) {
  const remote = await remoteFile(store, "releases/current.json");
  try {
    if (!remote.exists) return null;
    const current = await readJson(remote.destination);
    await validateDocument("current", current, "remote current release pointer");
    return current;
  } finally {
    await remote.cleanup();
  }
}

async function writePointer(store, pointer) {
  await validateDocument("current", pointer, "current release pointer");
  const directory = await mkdtemp(path.join(tmpdir(), "bca-r2-pointer-"));
  const file = path.join(directory, "current.json");
  try {
    await writeFile(file, canonicalJson(pointer), { encoding: "utf8", flag: "wx" });
    await store.putFile("releases/current.json", file, "application/json");
    const verification = await remoteFile(store, "releases/current.json");
    try {
      if (!verification.exists || await sha256File(verification.destination) !== await sha256File(file)) {
        throw new Error("Current release pointer failed in-place verification");
      }
    } finally {
      await verification.cleanup();
    }
  } finally {
    await rm(directory, { recursive: true });
  }
}

export async function publishRelease({
  releaseRoot,
  store,
  identity,
  mode = "manual",
  clock
}) {
  const [candidate, recipe, registry, lineage] = await Promise.all([
    readJson(path.join(releaseRoot, "manifests/candidate-release.json")),
    readJson(path.join(releaseRoot, "snapshots/publication-recipe.json")),
    readJson(path.join(releaseRoot, "snapshots/source-registry.json")),
    readJson(path.join(releaseRoot, "manifests/lineage.json"))
  ]);
  await Promise.all([
    validateDocument("release", candidate, "candidate release manifest"),
    validateDocument("lineage", lineage, "lineage manifest")
  ]);
  if (candidate.gate.result !== "pass" || candidate.gate.hard_failures.length > 0) {
    throw new Error("A failing candidate cannot be published or promoted");
  }
  if (identity !== registry.release_authority) {
    throw new Error(`Only release authority ${registry.release_authority} may promote a release`);
  }
  if (mode !== "manual" && mode !== "automatic") throw new Error(`Unsupported promotion mode: ${mode}`);
  if (mode === "automatic") {
    if (candidate.gate.warnings.length > 0) throw new Error("Automatic promotion refuses candidates with warnings");
    const sources = new Map(registry.sources.map((source) => [source.dataset_id, source]));
    const used = new Set(recipe.datasets.flatMap((dataset) => dataset.source_dataset_ids));
    for (const sourceId of used) {
      if (sources.get(sourceId).contract.refresh.mode !== "routine_candidate") {
        throw new Error(`${sourceId}: registry contract requires manual promotion`);
      }
    }
  }

  const current = await readCurrent(store);
  if (current?.status === "current") {
    if (current.release_id !== candidate.release_id && candidate.supersedes !== current.release_id) {
      throw new Error(`Candidate supersedes ${candidate.supersedes ?? "nothing"}, but current is ${current.release_id}`);
    }
  } else if (candidate.supersedes !== null) {
    throw new Error(`Candidate expects ${candidate.supersedes}, but there is no current release`);
  }

  const releaseFile = path.join(releaseRoot, "manifests/release.json");
  let release;
  let publishedAt;
  try {
    release = await readJson(releaseFile);
    await validateDocument("release", release, "existing final release manifest");
    publishedAt = release.published_at;
    const expected = {
      ...candidate,
      published_at: publishedAt,
      promotion: { mode, identity },
      datasets: candidate.datasets.map((dataset) => ({ ...dataset, published_at: publishedAt }))
    };
    if (canonicalJson(release) !== canonicalJson(expected)) {
      throw new Error("Existing immutable release manifest differs from this promotion");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    publishedAt = isoNow(clock);
    release = {
      ...candidate,
      published_at: publishedAt,
      promotion: { mode, identity },
      datasets: candidate.datasets.map((dataset) => ({ ...dataset, published_at: publishedAt }))
    };
    await validateDocument("release", release, "final release manifest");
    await writeCanonical(releaseFile, release, { exclusive: true });
  }

  const outputContracts = new Map(recipe.outputs.map((output) => [output.asset_id, output]));
  const uploads = [];
  for (const asset of release.assets) {
    const contract = outputContracts.get(asset.asset_id);
    if (!contract || contract.visibility !== "public") throw new Error(`${asset.asset_id}: missing public output contract`);
    const localFile = resolveInside(releaseRoot, contract.path);
    const details = await stat(localFile);
    if (details.size !== asset.bytes || await sha256File(localFile) !== asset.sha256) {
      throw new Error(`${asset.asset_id}: local asset no longer matches the release manifest`);
    }
    uploads.push(await ensureImmutableUpload(
      store,
      `releases/${release.release_id}/assets/${path.basename(contract.path)}`,
      localFile,
      asset.media_type
    ));
  }
  const manifestUpload = await ensureImmutableUpload(
    store,
    `releases/${release.release_id}/manifest.json`,
    releaseFile,
    "application/json"
  );
  const pointer = {
    schema_version: "1.0.0",
    status: "current",
    release_id: release.release_id,
    manifest_url: `${recipe.public_asset_origin.replace(/\/$/, "")}/releases/${release.release_id}/manifest.json`,
    manifest_sha256: manifestUpload.sha256,
    published_at: publishedAt
  };
  await writePointer(store, pointer);
  return { release, pointer, uploads: [...uploads, manifestUpload] };
}

export async function withdrawRelease({
  releaseRoot,
  store,
  expectedReleaseId,
  identity,
  reason,
  clock,
  replacement = null
}) {
  if (!reason?.trim()) throw new Error("A withdrawal reason is required");
  const registry = await readJson(path.join(releaseRoot, "snapshots/source-registry.json"));
  if (identity !== registry.release_authority) {
    throw new Error(`Only release authority ${registry.release_authority} may withdraw a release`);
  }
  const current = await readCurrent(store);
  if (current?.status !== "current" || current.release_id !== expectedReleaseId) {
    throw new Error(`Refusing withdrawal: current release is ${current?.release_id ?? current?.status ?? "absent"}`);
  }
  if (replacement !== null) {
    await validateDocument("current", replacement, "replacement current pointer");
    if (replacement.status !== "current") throw new Error("A rollback replacement must select a current release");
    const expectedKey = `releases/${replacement.release_id}/manifest.json`;
    const remote = await remoteFile(store, expectedKey);
    try {
      if (!remote.exists) throw new Error(`Replacement manifest is absent: ${expectedKey}`);
      if (await sha256File(remote.destination) !== replacement.manifest_sha256) {
        throw new Error("Replacement manifest checksum does not match its pointer");
      }
      const manifest = await readJson(remote.destination);
      await validateDocument("release", manifest, "replacement release manifest");
      if (manifest.release_id !== replacement.release_id || manifest.gate.result !== "pass") {
        throw new Error("Replacement pointer does not identify a passing release manifest");
      }
    } finally {
      await remote.cleanup();
    }
  }
  const withdrawnAt = isoNow(clock);
  const record = {
    schema_version: "1.0.0",
    release_id: expectedReleaseId,
    withdrawn_at: withdrawnAt,
    identity,
    reason: reason.trim(),
    replacement
  };
  const suffix = withdrawnAt.replaceAll(":", "-");
  const localRecord = path.join(releaseRoot, `reports/withdrawal-${suffix}.json`);
  await writeCanonical(localRecord, record, { exclusive: true });
  await ensureImmutableUpload(
    store,
    `releases/${expectedReleaseId}/withdrawals/${suffix}.json`,
    localRecord,
    "application/json"
  );
  const pointer = replacement ?? {
    schema_version: "1.0.0",
    status: "withdrawn",
    withdrawn_release_id: expectedReleaseId,
    withdrawn_at: withdrawnAt,
    reason: reason.trim(),
    replacement: null
  };
  await writePointer(store, pointer);
  return { record, pointer };
}
