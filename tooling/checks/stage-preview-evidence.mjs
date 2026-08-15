import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const explorerContractPath = path.join(root, "data/launch/explorer-release-2026-08-13.json");
const previewWorkerPath = path.join(root, "config/cloudflare/preview-worker.mjs");
const outputRoot = path.join(root, "apps/web/out");
const sourceOrigin = "https://assets.bca.wales";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function fetchBytes(url) {
  const response = await fetch(url, { redirect: "error" });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

const explorer = JSON.parse(await readFile(explorerContractPath, "utf8"));
const releaseId = explorer.release.id;
assert.match(releaseId, /^release-[a-z0-9][a-z0-9._-]+$/);

const manifestPath = `/releases/${releaseId}/manifest.json`;
assert.equal(explorer.release.manifestPath, manifestPath);
const manifestUrl = `${sourceOrigin}${manifestPath}`;
const manifestBytes = await fetchBytes(manifestUrl);
assert.equal(
  sha256(manifestBytes),
  explorer.release.manifestSha256,
  "immutable release manifest checksum changed"
);

const manifest = JSON.parse(manifestBytes.toString("utf8"));
assert.equal(manifest.release_id, releaseId);
assert.ok(Array.isArray(manifest.assets) && manifest.assets.length > 0);

const assets = await Promise.all(manifest.assets.map(async (asset) => {
  assert.match(asset.sha256, /^[0-9a-f]{64}$/);
  assert.ok(Number.isSafeInteger(asset.bytes) && asset.bytes > 0);

  const url = new URL(asset.url);
  const expectedPrefix = `/releases/${releaseId}/assets/`;
  assert.equal(url.origin, sourceOrigin, `${asset.asset_id}: unexpected source origin`);
  assert.ok(url.pathname.startsWith(expectedPrefix), `${asset.asset_id}: unexpected object key`);
  assert.equal(url.search, "", `${asset.asset_id}: source URL must be immutable and query-free`);
  assert.equal(url.hash, "", `${asset.asset_id}: source URL must not contain a fragment`);

  const filename = path.posix.basename(url.pathname);
  assert.equal(url.pathname, `${expectedPrefix}${filename}`, `${asset.asset_id}: nested or unsafe asset path`);

  const bytes = await fetchBytes(url.href);
  assert.equal(bytes.byteLength, asset.bytes, `${asset.asset_id}: byte count changed`);
  assert.equal(sha256(bytes), asset.sha256, `${asset.asset_id}: checksum changed`);
  return { filename, bytes };
}));

const releaseRoot = path.join(outputRoot, "releases", releaseId);
const assetRoot = path.join(releaseRoot, "assets");
const previewWorker = await readFile(previewWorkerPath);
await mkdir(assetRoot, { recursive: true });
await writeFile(path.join(releaseRoot, "manifest.json"), manifestBytes, { flag: "wx" });
await writeFile(path.join(outputRoot, "_worker.js"), previewWorker, { flag: "wx" });
for (const asset of assets) {
  await writeFile(path.join(assetRoot, asset.filename), asset.bytes, { flag: "wx" });
}

process.stdout.write(`${JSON.stringify({
  release_id: releaseId,
  source_manifest: manifestUrl,
  manifest_sha256: sha256(manifestBytes),
  assets: assets.length,
  bytes: assets.reduce((total, asset) => total + asset.bytes.byteLength, 0),
  delivery: "same-origin-pages",
  pmtiles_ranges: "preview-worker"
})}\n`);
