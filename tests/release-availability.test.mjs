import assert from "node:assert/strict";
import test from "node:test";
import { loadReleaseAvailability } from "../apps/web/app/releaseAvailability.mjs";

const expected = {
  manifestUrl: "https://assets.example.test/releases/current.json",
  expectedReleaseId: "release-test-2",
  expectedManifestPath: "/releases/release-test-2/manifest.json",
  expectedManifestSha256: "a".repeat(64)
};

function response(document, status = 200) {
  return new Response(JSON.stringify(document), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test("a current pointer must select the pinned release, manifest URL and checksum", async () => {
  const result = await loadReleaseAvailability({
    ...expected,
    fetchImpl: async () => response({
      schema_version: "1.0.0",
      status: "current",
      release_id: expected.expectedReleaseId,
      manifest_url: `https://assets.example.test${expected.expectedManifestPath}`,
      manifest_sha256: expected.expectedManifestSha256
    })
  });
  assert.deepEqual(result, { health: "current", reason: null });
});

test("a mismatched current pointer fails closed", async () => {
  const result = await loadReleaseAvailability({
    ...expected,
    fetchImpl: async () => response({
      schema_version: "1.0.0",
      status: "current",
      release_id: "release-other",
      manifest_url: `https://assets.example.test${expected.expectedManifestPath}`,
      manifest_sha256: expected.expectedManifestSha256
    })
  });
  assert.deepEqual(result, { health: "unavailable", reason: null });
});

test("a withdrawn pointer preserves its public reason and hides the release", async () => {
  const result = await loadReleaseAvailability({
    ...expected,
    fetchImpl: async () => response({ status: "withdrawn", reason: "Evidence integrity review." })
  });
  assert.deepEqual(result, { health: "withdrawn", reason: "Evidence integrity review." });
});

test("a passing immutable manifest supports self-contained previews", async () => {
  const result = await loadReleaseAvailability({
    ...expected,
    fetchImpl: async () => response({
      release_id: expected.expectedReleaseId,
      gate: { result: "pass", hard_failures: [] }
    })
  });
  assert.deepEqual(result, { health: "current", reason: null });
});

test("a missing or unreadable pointer fails closed", async () => {
  assert.deepEqual(await loadReleaseAvailability({ ...expected, fetchImpl: async () => response({}, 404) }), unavailable());
  assert.deepEqual(await loadReleaseAvailability({ ...expected, fetchImpl: async () => { throw new Error("offline"); } }), unavailable());
});

function unavailable() {
  return { health: "unavailable", reason: null };
}
