import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const baseUrl = process.argv[2];
if (!baseUrl) throw new Error("Usage: npm run check:preview -- https://preview-origin.example");
const origin = new URL(baseUrl).origin;
const root = new URL("../../", import.meta.url);
const explorer = JSON.parse(await readFile(new URL("data/launch/explorer-release-2026-08-13.json", root), "utf8"));
const releaseRoot = `/releases/${explorer.release.id}`;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchPreview(path, options = {}) {
  const url = new URL(path, `${origin}/`);
  let lastError;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "error", ...options });
      if (response.ok) {
        assert.equal(new URL(response.url).origin, origin, `${path}: escaped the preview origin`);
        return response;
      }
      lastError = new Error(`${url}: HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 12) await delay(2500);
  }
  throw lastError;
}

const homepage = await fetchPreview("/");
assert.match(await homepage.text(), /Blorenge landscape explorer/i);

const evidencePage = await fetchPreview("/evidence/");
assert.match(await evidencePage.text(), /Evidence/i);

const manifestResponse = await fetchPreview(`${releaseRoot}/manifest.json`);
const manifestBytes = Buffer.from(await manifestResponse.arrayBuffer());
assert.equal(sha256(manifestBytes), explorer.release.manifestSha256);
assert.equal(JSON.parse(manifestBytes.toString("utf8")).release_id, explorer.release.id);

const rangeResponse = await fetchPreview(`${releaseRoot}/assets/context.pmtiles`, {
  headers: { Range: "bytes=0-126" }
});
assert.equal(rangeResponse.status, 206, "PMTiles range request must return partial content");
assert.match(rangeResponse.headers.get("content-range") ?? "", /^bytes 0-126\/\d+$/);
assert.equal(rangeResponse.headers.get("accept-ranges"), "bytes");
const pmtilesHeader = Buffer.from(await rangeResponse.arrayBuffer());
assert.equal(pmtilesHeader.byteLength, 127);
assert.equal(pmtilesHeader.subarray(0, 7).toString("utf8"), "PMTiles");

const geoJsonResponse = await fetchPreview(`${releaseRoot}/assets/effis-592404.geojson`);
const geoJson = await geoJsonResponse.json();
assert.equal(geoJson.type, "FeatureCollection");
assert.ok(Array.isArray(geoJson.features) && geoJson.features.length > 0);

const downloadResponse = await fetchPreview(`${releaseRoot}/assets/evidence-states.csv.txt`);
const download = await downloadResponse.text();
assert.match(download, /evidence_state/i);
assert.match(download, /higher_confidence_observed_change/);

process.stdout.write(`${JSON.stringify({
  origin,
  release_id: explorer.release.id,
  manifest_sha256: sha256(manifestBytes),
  pmtiles_range: rangeResponse.headers.get("content-range"),
  geojson_features: geoJson.features.length,
  download_bytes: Buffer.byteLength(download),
  isolation: "all exercised routes remained on the preview origin"
})}\n`);
