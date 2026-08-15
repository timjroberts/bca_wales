import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const explorer = JSON.parse(await readFile(new URL("../../data/launch/explorer-release-2026-08-13.json", import.meta.url), "utf8"));
const siteOrigin = (process.env.BCA_SITE_ORIGIN ?? "https://explore.bca.wales").replace(/\/$/, "");
const assetOrigin = (process.env.BCA_ASSET_ORIGIN ?? "https://assets.bca.wales").replace(/\/$/, "");

async function fetchOk(url, options) {
  const response = await fetch(url, options);
  assert.equal(response.ok, true, `${url}: HTTP ${response.status}`);
  return response;
}

const routeChecks = [
  ["/", /Explore the Blorenge landscape and see how it changes over time/],
  ["/accessibility/", /Accessibility statement/],
  ["/privacy/", /Privacy notice/],
  ["/security/", /Security/]
];

for (const [path, expected] of routeChecks) {
  const response = await fetchOk(`${siteOrigin}${path}`);
  const body = await response.text();
  assert.match(body, expected, `${path}: expected launch content was absent`);
  if (path === "/") {
    assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  }
}

const evidenceResponse = await fetch(`${siteOrigin}/evidence/`, { redirect: "manual" });
assert.equal(evidenceResponse.status, 404, "/evidence/ must use the normal not-found response");

const pointerResponse = await fetchOk(`${assetOrigin}/releases/current.json`, { cache: "no-store" });
const pointer = await pointerResponse.json();
assert.equal(pointer.status, "current");
assert.equal(pointer.release_id, explorer.release.id);
assert.equal(pointer.manifest_sha256, explorer.release.manifestSha256);

const manifestResponse = await fetchOk(pointer.manifest_url, { cache: "no-store" });
const manifestBytes = Buffer.from(await manifestResponse.arrayBuffer());
assert.equal(createHash("sha256").update(manifestBytes).digest("hex"), pointer.manifest_sha256);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
assert.equal(manifest.release_id, explorer.release.id);
assert.equal(manifest.gate.result, "pass");
assert.deepEqual(manifest.gate.hard_failures, []);

const representative = manifest.assets.find((asset) => asset.asset_id === "context-pmtiles");
assert.ok(representative, "representative context asset is absent from the release manifest");
const assetResponse = await fetchOk(representative.url);
const assetBytes = Buffer.from(await assetResponse.arrayBuffer());
assert.equal(assetBytes.length, representative.bytes);
assert.equal(createHash("sha256").update(assetBytes).digest("hex"), representative.sha256);

process.stdout.write(`${JSON.stringify({
  checked_at: new Date().toISOString(),
  site_origin: siteOrigin,
  asset_origin: assetOrigin,
  release_id: pointer.release_id,
  routes: routeChecks.map(([path]) => path),
  representative_asset: representative.asset_id,
  result: "pass"
})}\n`);
