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

test("map and semantic routes share controls, state links and source detail", async () => {
  const explorer = await read("apps/web/app/Explorer.tsx");
  const map = await read("apps/web/app/MapCanvas.tsx");
  const mapTools = await read("apps/web/app/MapTools.tsx");
  assert.match(explorer, /initialView: "map" \| "evidence"/);
  assert.match(explorer, /stateHref\("\/evidence\/"/);
  assert.match(explorer, /aria-live="polite"/);
  assert.match(explorer, /aria-controls="source-details"/);
  assert.match(explorer, /Max-Age=31536000/);
  assert.match(explorer, /document\.documentElement\.lang/);
  assert.match(map, /new maplibregl\.Map/);
  assert.match(map, /cooperativeGestures: true/);
  assert.match(map, /prefers-reduced-motion: reduce/);
  assert.match(mapTools, /className="map-tools" open=\{openPanels\.tools\}/);
  assert.match(mapTools, /className="map-tool-panel map-tool-layers" open=\{openPanels\.layers\}/);
  assert.match(mapTools, /className="map-tool-panel map-tool-date" open=\{openPanels\.date\}/);
  assert.match(mapTools, /onToggle=\{\(event\) => setPanelOpen/);
  assert.match(mapTools, /onComparisonToggle/);
  assert.match(mapTools, /onEarlierDateChange/);
  assert.match(mapTools, /aria-controls="source-details"/);
  assert.doesNotMatch(explorer, /MapOverlayPrototype|PrototypeSwitcher|prototypeVariant/);
  assert.doesNotMatch(mapTools, /PROTOTYPE|VariantA|VariantB|VariantC/);
});

test("the accessible download contains metadata only", async () => {
  const csv = await read("apps/web/public/explorer-interface-fixture.csv");
  assert.match(csv, /public_evidence/);
  assert.equal(csv.trim().split("\n").slice(1).every((line) => line.endsWith(",false")), true);
});
