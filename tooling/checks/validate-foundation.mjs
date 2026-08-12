import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import process from "node:process";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = new URL("../../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const validations = [
  ["schemas/release-manifest.schema.json", "fixtures/releases/release.example.json"],
  ["schemas/explorer-interface.schema.json", "fixtures/explorer/interface.example.json"],
  ["schemas/environment.schema.json", "config/environments/preview.json"],
  ["schemas/environment.schema.json", "config/environments/production.json"]
];

const validators = new Map();

for (const [schemaPath, documentPath] of validations) {
  const document = await readJson(documentPath);
  let validate = validators.get(schemaPath);
  if (!validate) {
    validate = ajv.compile(await readJson(schemaPath));
    validators.set(schemaPath, validate);
  }
  assert.equal(validate(document), true, `${documentPath}: ${ajv.errorsText(validate.errors)}`);
}

const headers = await readFile(new URL("apps/web/public/_headers", root), "utf8");
for (const required of [
  "Content-Security-Policy",
  "Permissions-Policy",
  "Referrer-Policy",
  "X-Content-Type-Options",
  "frame-ancestors 'none'",
  "object-src 'none'"
]) {
  assert.match(headers, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
assert.doesNotMatch(headers, /unsafe-eval|default-src \*/);

const fixture = await readFile(new URL("fixtures/releases/release.example.json", root), "utf8");
assert.match(fixture, /Contract fixture/);
assert.match(fixture, /Must never be promoted/);

const cors = await readJson("config/cloudflare/r2-cors.json");
assert.equal(cors.rules.length, 1);
assert.deepEqual(cors.rules[0].allowed.methods, ["GET", "HEAD"]);
assert.deepEqual(cors.rules[0].allowed.origins.sort(), [
  "https://preview.bca.wales",
  "https://explore.bca.wales"
].sort());
assert.equal("AllowedOrigins" in cors.rules[0], false, "R2 CORS must use Cloudflare API shape");

process.stdout.write("Foundation contracts and security policy are valid.\n");
