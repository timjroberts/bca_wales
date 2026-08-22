import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const explorer = JSON.parse(await readFile(new URL("../../data/launch/explorer-release-2026-08-13.json", import.meta.url), "utf8"));
const siteOrigin = (process.env.BCA_SITE_ORIGIN ?? "https://explore.bca.wales").replace(/\/$/, "");
const assetOrigin = (process.env.BCA_ASSET_ORIGIN ?? "https://assets.bca.wales").replace(/\/$/, "");
const verificationMode = process.env.BCA_VERIFICATION_MODE ?? "current";
assert.ok(["current", "staged"].includes(verificationMode), `unsupported verification mode: ${verificationMode}`);

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
let manifestUrl;
if (verificationMode === "current") {
  assert.equal(pointer.release_id, explorer.release.id);
  assert.equal(pointer.manifest_sha256, explorer.release.manifestSha256);
  manifestUrl = pointer.manifest_url;
} else {
  assert.equal(process.env.BCA_EXPECTED_RELEASE_ID, explorer.release.id);
  assert.equal(process.env.BCA_EXPECTED_MANIFEST_SHA256, explorer.release.manifestSha256);
  manifestUrl = `${assetOrigin}${explorer.release.manifestPath}`;
}

const manifestResponse = await fetchOk(manifestUrl, { cache: "no-store" });
const manifestBytes = Buffer.from(await manifestResponse.arrayBuffer());
assert.equal(createHash("sha256").update(manifestBytes).digest("hex"), explorer.release.manifestSha256);
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

const [activeFireCurrentResponse, activeFireStatusResponse] = await Promise.all([
  fetchOk(`${assetOrigin}${explorer.activeFire.currentPath}`, { cache: "no-store" }),
  fetchOk(`${assetOrigin}${explorer.activeFire.statusPath}`, { cache: "no-store" })
]);
const activeFirePointer = await activeFireCurrentResponse.json();
const activeFireStatus = await activeFireStatusResponse.json();
assert.ok(["current", "degraded", "stale", "outage", "withdrawn"].includes(activeFireStatus.status));
assert.equal(JSON.stringify(activeFirePointer).includes("VIIRS_SNPP_NRT"), false);
if (activeFirePointer.status !== "withdrawn") {
  assert.ok(["current", "degraded", "stale"].includes(activeFirePointer.status));
  for (const reference of [activeFirePointer.map, activeFirePointer.history, activeFirePointer.accessible_table, activeFirePointer.contract]) {
    const url = new URL(reference.url);
    assert.equal(url.origin, assetOrigin);
    assert.equal(url.pathname, `/${reference.key}`);
    const response = await fetchOk(url, { cache: "no-store" });
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(createHash("sha256").update(bytes).digest("hex"), reference.sha256);
  }
  const map = await (await fetchOk(activeFirePointer.map.url, { cache: "no-store" })).json();
  assert.equal(map.type, "FeatureCollection");
  assert.ok(map.features.every((feature) => ["NOAA-20", "NOAA-21"].includes(feature.properties.sensor)));
  const contract = await (await fetchOk(activeFirePointer.contract.url, { cache: "no-store" })).json();
  assert.match(contract.limitations.en.join(" "), /Absence of detections is not evidence that no fire exists/);
}

process.stdout.write(`${JSON.stringify({
  checked_at: new Date().toISOString(),
  site_origin: siteOrigin,
  asset_origin: assetOrigin,
  verification_mode: verificationMode,
  release_id: explorer.release.id,
  current_release_id: pointer.release_id,
  routes: routeChecks.map(([path]) => path),
  representative_asset: representative.asset_id,
  active_fire_status: activeFireStatus.status,
  result: "pass"
})}\n`);
