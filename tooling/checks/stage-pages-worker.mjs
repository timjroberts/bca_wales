import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const configPath = path.join(root, "config/cloudflare/retired-pages-routes.json");
const workerPath = path.join(root, "config/cloudflare/pages-worker.mjs");
const defaultOutputPath = path.join(root, "apps/web/out/_worker.js");
const protectedPath = /^\/(?:_next|releases)(?:\/|$)/;

export function validateRetiredPaths(config) {
  assert.equal(typeof config, "object", "retired-route config must be an object");
  assert.notEqual(config, null, "retired-route config must be an object");
  assert.ok(Array.isArray(config.paths), "paths must be an array");

  const paths = new Set();
  for (const routePath of config.paths) {
    assert.equal(typeof routePath, "string", "each retired route must be a string");
    assert.ok(routePath.startsWith("/"), `${routePath}: route must start with /`);
    assert.notEqual(routePath, "/", "the site root cannot be retired");
    assert.doesNotMatch(routePath, /[?#*]/, `${routePath}: query strings, fragments and wildcards are not allowed`);
    assert.doesNotMatch(routePath, protectedPath, `${routePath}: immutable application and release assets cannot be retired`);
    assert.doesNotMatch(routePath, /\/[^/]+\.[a-z0-9]+$/i, `${routePath}: only extensionless HTML routes can be retired`);
    assert.equal(new URL(routePath, "https://example.invalid").pathname, routePath, `${routePath}: route must be URL-normalized`);
    assert.equal(paths.has(routePath), false, `${routePath}: duplicate retired route`);
    paths.add(routePath);
  }
  return [...paths];
}

export async function stagePagesWorker(outputPath = defaultOutputPath) {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const retiredPaths = validateRetiredPaths(config);
  const source = await readFile(workerPath, "utf8");
  const deployedSource = `${source}\nexport default createPagesWorker(${JSON.stringify(retiredPaths)});\n`;
  await writeFile(outputPath, deployedSource, { flag: "wx" });
  return retiredPaths;
}

async function main() {
  const retiredPaths = await stagePagesWorker();
  process.stdout.write(`${JSON.stringify({ worker: "apps/web/out/_worker.js", retired_paths: retiredPaths })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
