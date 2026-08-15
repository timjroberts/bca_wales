import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../apps/web/app/mapApplicationState.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const {
  INITIAL_MAP_APPLICATION_STATE,
  canPinMap,
  dismissMapApplicationMode,
  mapApplicationExitPlan,
  updateMapApplicationState
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const roomyViewport = { viewportWidth: 1280, viewportHeight: 720 };

test("application mode enters at the map threshold only on a capable viewport", () => {
  assert.equal(canPinMap({ viewportWidth: 761, viewportHeight: 560 }), true);
  assert.equal(canPinMap({ viewportWidth: 760, viewportHeight: 720 }), false);
  assert.equal(canPinMap({ viewportWidth: 1280, viewportHeight: 559 }), false);
  assert.deepEqual(
    updateMapApplicationState(INITIAL_MAP_APPLICATION_STATE, { ...roomyViewport, sentinelTop: 1 }),
    { pinned: false, dismissed: false }
  );
  assert.deepEqual(
    updateMapApplicationState(INITIAL_MAP_APPLICATION_STATE, { ...roomyViewport, sentinelTop: 0 }),
    { pinned: true, dismissed: false }
  );
});

test("an explicit exit stays dismissed until the visitor crosses above the threshold", () => {
  const dismissed = dismissMapApplicationMode();
  assert.deepEqual(
    updateMapApplicationState(dismissed, { ...roomyViewport, sentinelTop: -100 }),
    { pinned: false, dismissed: true }
  );
  const rearmed = updateMapApplicationState(dismissed, { ...roomyViewport, sentinelTop: 1 });
  assert.deepEqual(rearmed, { pinned: false, dismissed: false });
  assert.deepEqual(
    updateMapApplicationState(rearmed, { ...roomyViewport, sentinelTop: 0 }),
    { pinned: true, dismissed: false }
  );
});

test("viewport changes release the map into natural flow without immediate re-entry", () => {
  const pinned = { pinned: true, dismissed: false };
  const narrow = updateMapApplicationState(pinned, {
    viewportWidth: 760,
    viewportHeight: 720,
    sentinelTop: -100
  });
  assert.deepEqual(narrow, { pinned: false, dismissed: true });
  assert.deepEqual(
    updateMapApplicationState(narrow, { ...roomyViewport, sentinelTop: -100 }),
    { pinned: false, dismissed: true }
  );
});

test("top and footer exits preserve focus targets and reduced-motion behavior", () => {
  assert.deepEqual(mapApplicationExitPlan("top", false), { focusId: "page-top", behavior: "smooth" });
  assert.deepEqual(mapApplicationExitPlan("top", true), { focusId: "page-top", behavior: "auto" });
  assert.deepEqual(mapApplicationExitPlan("footer", false), { focusId: "service-footer", behavior: "smooth" });
  assert.deepEqual(mapApplicationExitPlan("footer", true), { focusId: "service-footer", behavior: "auto" });
});
