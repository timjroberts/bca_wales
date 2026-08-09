import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const explorer = await readFile(new URL("../app/Explorer.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const evidencePage = await readFile(new URL("../app/evidence/page.tsx", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("prototype keeps map and non-map evidence in one interaction", () => {
  assert.match(explorer, /type ViewMode = "map" \| "list"/);
  assert.match(explorer, /Read without a map/);
  assert.match(explorer, /href="\/evidence"/);
  assert.match(explorer, /<table>/);
  assert.match(explorer, /activeLayers/);
  assert.match(explorer, /Fire and change/);
  assert.match(explorer, /Landscape context/);
  assert.match(explorer, /Historical context/);
  assert.match(explorer, /<details className="layer-group"/);
  assert.match(explorer, /Compare two dates/);
  assert.match(explorer, /Overlay contrast/);
  assert.match(explorer, /"low", "medium", "high"/);
  assert.doesNotMatch(explorer, /55% opacity/);
  assert.match(explorer, /comparison-summary/);
  assert.match(page, /initialView="map"/);
  assert.match(evidencePage, /initialView="list"/);
});

test("prototype exposes bilingual and provenance treatments", () => {
  assert.match(explorer, /English/);
  assert.match(explorer, /Cymraeg/);
  assert.match(explorer, /Licence and reuse/);
  assert.match(explorer, /Evidence status/);
  assert.match(explorer, /Sources in view/);
  assert.match(explorer, /visibleAttributions/);
  assert.match(explorer, /progressive|fallback|Some source names remain in English/i);
  assert.match(explorer, /bca-language/);
  assert.match(explorer, /Max-Age=31536000; Path=\/; SameSite=Lax/);
  assert.match(explorer, /document\.documentElement\.lang = language/);
});

test("starter preview metadata and dependencies are gone", () => {
  assert.doesNotMatch(explorer, /SkeletonPreview|codex-preview|react-loading-skeleton/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
});
