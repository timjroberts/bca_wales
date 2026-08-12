import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("the production application uses static export and package seams", async () => {
  const config = await read("apps/web/next.config.ts");
  const webPackage = JSON.parse(await read("apps/web/package.json"));
  assert.match(config, /output: "export"/);
  assert.deepEqual(config.match(/transpilePackages:[\s\S]*?\]/)?.[0].includes("@bca/domain"), true);
  assert.equal(webPackage.dependencies["@bca/publication"], "0.1.0");
});

test("prototype evidence is quarantined from production", async () => {
  const page = await read("apps/web/app/page.tsx");
  const evidence = await read("apps/web/app/evidence/page.tsx");
  assert.match(evidence, /no illustrative prototype geometry or evidence values/i);
  assert.doesNotMatch(`${page}\n${evidence}`, /55%|burn scar|hectare|Sentinel-2|EFFIS/i);
});

test("site and evidence delivery remain separately scoped", async () => {
  const preview = await read(".github/workflows/preview.yml");
  const production = await read(".github/workflows/deploy-site.yml");
  assert.match(preview, /pages deploy apps\/web\/out/);
  assert.match(production, /environment: production/);
  assert.doesNotMatch(`${preview}\n${production}`, /wrangler r2 object put/);
});
