import assert from "node:assert/strict";
import test from "node:test";
import { createPagesWorker } from "../config/cloudflare/pages-worker.mjs";

const previewWorker = createPagesWorker(["/evidence", "/evidence/"]);

const bytes = new TextEncoder().encode(`PMTiles${"x".repeat(249)}`);
const env = {
  ASSETS: {
    async fetch() {
      return new Response(bytes, {
        status: 200,
        headers: { "Content-Type": "application/vnd.pmtiles" }
      });
    }
  }
};

test("preview worker returns bounded PMTiles byte ranges", async () => {
  const request = new Request(
    "https://preview.example/releases/release-example-1/assets/context.pmtiles",
    { headers: { Range: "bytes=0-126" } }
  );
  const response = await previewWorker.fetch(request, env);
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.equal(response.headers.get("content-range"), `bytes 0-126/${bytes.byteLength}`);
  assert.equal(response.headers.get("content-length"), "127");
  assert.equal((await response.arrayBuffer()).byteLength, 127);
});

test("preview worker rejects unsatisfiable ranges and forwards the explorer", async () => {
  const rangeResponse = await previewWorker.fetch(new Request(
    "https://preview.example/releases/release-example-1/assets/context.pmtiles",
    { headers: { Range: "bytes=999-1000" } }
  ), env);
  assert.equal(rangeResponse.status, 416);
  assert.equal(rangeResponse.headers.get("content-range"), `bytes */${bytes.byteLength}`);

  const ordinaryResponse = await previewWorker.fetch(
    new Request("https://preview.example/"),
    env
  );
  assert.equal(ordinaryResponse.status, 200);
  assert.equal((await ordinaryResponse.arrayBuffer()).byteLength, bytes.byteLength);
});
