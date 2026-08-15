import assert from "node:assert/strict";
import test from "node:test";
import { createPagesWorker } from "../config/cloudflare/pages-worker.mjs";
import { validateRetiredPaths } from "../tooling/checks/stage-pages-worker.mjs";

test("the Pages worker serves current non-cacheable 404s for retired routes", async () => {
  let assetRequest;
  const worker = createPagesWorker(["/evidence", "/evidence/"]);
  const response = await worker.fetch(new Request("https://explore.bca.wales/evidence/"), {
    ASSETS: {
      fetch: async (request) => {
        assetRequest = request;
        return new Response("normal not-found page", { headers: { "X-Frame-Options": "DENY" } });
      }
    }
  });

  assert.equal(new URL(assetRequest.url).pathname, "/404.html");
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-robots-tag"), "noindex");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(await response.text(), "normal not-found page");
});

test("retired route configuration excludes broad and immutable asset targets", () => {
  assert.deepEqual(validateRetiredPaths({ paths: ["/evidence", "/evidence/"] }), ["/evidence", "/evidence/"]);
  for (const routePath of ["/", "/_next/static/app.js", "/releases/release-1/manifest.json", "/image.png", "/foo*"]) {
    assert.throws(() => validateRetiredPaths({ paths: [routePath] }));
  }
});
