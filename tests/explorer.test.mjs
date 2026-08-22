import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("the interface fixture is internally referential and never claims to be evidence", async () => {
  const fixture = JSON.parse(await read("fixtures/explorer/interface.example.json"));
  const groupIds = new Set(fixture.groups.map((group) => group.id));
  const layerIds = fixture.layers.map((layer) => layer.id);
  assert.equal(new Set(layerIds).size, layerIds.length);
  assert.ok(fixture.layers.every((layer) => groupIds.has(layer.groupId)));
  assert.ok(fixture.map.features.features.every((feature) => layerIds.includes(feature.properties.layerId)));
  assert.ok(
    fixture.layers.some((layer) => !layer.name.cy || !layer.description.cy || !layer.method.cy),
    "progressive Welsh fallback needs an exercised fixture"
  );
  assert.match(fixture.fixtureNotice.en, /not public evidence/i);
  assert.ok(fixture.layers.every((layer) => /fixture|release|snapshot/i.test(layer.evidenceStatus.en)));
});

test("the single explorer route keeps map controls, shareable state and source detail", async () => {
  const explorer = await read("apps/web/app/Explorer.tsx");
  const accessibility = await read("apps/web/app/accessibility/page.tsx");
  const map = await read("apps/web/app/MapCanvas.tsx");
  const mapTools = await read("apps/web/app/MapTools.tsx");
  const activeFire = await read("apps/web/app/activeFire.ts");
  const activeFirePanel = await read("apps/web/app/ActiveFirePanel.tsx");
  const applicationMode = await read("apps/web/app/MapApplicationMode.tsx");
  assert.match(explorer, /Blorenge Landscape Explorer/);
  assert.match(explorer, /Explore the Blorenge landscape and see how it changes over time/);
  assert.match(explorer, /After exploring this beautiful landscape on foot, why not explore its data and compare and observe how it changes over time\./);
  assert.match(explorer, /Download accessible evidence states \(CSV\)/);
  assert.match(explorer, /window\.history\.replaceState/);
  assert.match(explorer, /aria-live="polite"/);
  assert.match(explorer, /Max-Age=31536000/);
  assert.match(explorer, /document\.documentElement\.lang/);
  assert.doesNotMatch(explorer, /initialView|\/evidence\/|Read without a map|How to read this explorer|reading-notes/);
  assert.match(accessibility, /interactive map requires WebGL/);
  assert.match(accessibility, /downloadable CSV/);
  assert.doesNotMatch(accessibility, /href="\/evidence\/"|same substantive evidence without a map/);
  assert.match(map, /new maplibregl\.Map/);
  assert.match(map, /new Protocol/);
  assert.match(map, /pmtiles:\/\//);
  assert.match(map, /release-context/);
  assert.match(map, /release-ndvi/);
  assert.match(map, /release-ndmi/);
  assert.match(map, /operational-thermal/);
  assert.match(map, /thermal-diamond/);
  assert.match(map, /cooperativeGestures: true/);
  assert.match(map, /prefers-reduced-motion: reduce/);
  assert.match(map, /new ResizeObserver\(\(\) => map\.resize\(\)\)/);
  assert.match(mapTools, /className="map-tools" open=\{openPanels\.tools\}/);
  assert.match(mapTools, /className="map-tool-panel map-tool-layers" open=\{openPanels\.layers\}/);
  assert.match(mapTools, /className="map-tool-panel map-tool-date" open=\{openPanels\.date\}/);
  assert.match(mapTools, /onToggle=\{\(event\) => setPanelOpen/);
  assert.match(mapTools, /onComparisonToggle/);
  assert.match(mapTools, /onEarlierDateChange/);
  assert.match(mapTools, /aria-controls="source-details"/);
  assert.match(mapTools, /type=\{layer\.selectionGroup \? "radio" : "checkbox"\}/);
  assert.match(activeFire, /status === "outage"/);
  assert.match(activeFire, /now >= new Date\(pointer\.stale_after\)/);
  assert.match(activeFire, /now < new Date\(pointer\.hide_default_after\)/);
  assert.match(activeFire, /unexpected asset origin/);
  assert.match(activeFirePanel, /Absence of detections is not evidence that no fire exists/);
  assert.match(activeFirePanel, /Show this filtered history on the map/);
  assert.match(activeFirePanel, /Download the complete accessible 30-day history/);
  assert.doesNotMatch(explorer, /MapOverlayPrototype|PrototypeSwitcher|prototypeVariant/);
  assert.doesNotMatch(mapTools, /PROTOTYPE|VariantA|VariantB|VariantC/);
  assert.doesNotMatch(explorer, /className="view-toolbar"/);
  assert.match(applicationMode, /window\.visualViewport\?\.addEventListener\("resize"/);
  assert.match(applicationMode, /document\.body\.style\.overflow = "hidden"/);
  assert.match(applicationMode, /document\.getElementById\("source-details"\)/);
  assert.match(applicationMode, /focus\(\{ preventScroll: true \}\)/);
  assert.match(applicationMode, /a\[href\^='#'\]/);
});

test("the factual presentation contract is internally referential and exposes public-safe alternatives", async () => {
  const release = JSON.parse(await read("data/launch/explorer-release-2026-08-13.json"));
  const groupIds = new Set(release.groups.map((group) => group.id));
  const layerIds = release.layers.map((layer) => layer.id);
  assert.equal(release.fixture, false);
  assert.equal(new Set(layerIds).size, layerIds.length);
  assert.ok(release.layers.every((layer) => groupIds.has(layer.groupId)));
  assert.ok(release.layers.every((layer) => layer.provider && layer.licence && layer.owner && layer.nextReviewAt));
  assert.equal(release.release.id, "release-blorenge-2026-08-21.8");
  assert.equal(release.release.publishedAt, "2026-08-22T09:40:24.559Z");
  assert.deepEqual(release.layers.filter((layer) => layer.selectionGroup === "change-evidence").map((layer) => layer.id), ["change", "ndvi", "ndmi"]);
  assert.equal(release.layers.find((layer) => layer.id === "thermal").defaultVisible, true);
  assert.deepEqual(Object.keys(release.map.assets).filter((key) => ["change", "ndvi", "ndmi"].includes(key)), ["change", "ndvi", "ndmi"]);
  assert.equal(release.activeFire.currentPath, "/active-fire/current.json");
  assert.match(release.map.assets.download, /evidence-states\.csv\.txt$/);
  assert.equal(release.evidenceStates.length, 4);
  assert.match(release.claim, /consistent with the documented July 2026 Blaenavon wildfire/);
});
