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

test("prototype evidence remains quarantined while production uses the verified release-two candidate", async () => {
  const page = await read("apps/web/app/page.tsx");
  const explorer = await read("apps/web/app/Explorer.tsx");
  assert.match(explorer, /data\/launch\/explorer-release-2026-08-13\.json/);
  assert.match(explorer, /Verified release-two candidate/);
  assert.doesNotMatch(explorer, /No factual evidence release is attached/);
  assert.doesNotMatch(`${page}\n${explorer}`, /prototypes\/blorenge-explorer|55%|burn scar|hectare/i);
  await assert.rejects(read("apps/web/app/evidence/page.tsx"), { code: "ENOENT" });
});

test("site and evidence delivery remain separately scoped", async () => {
  const preview = await read(".github/workflows/preview.yml");
  const production = await read(".github/workflows/deploy-site.yml");
  const staging = await read(".github/workflows/stage-evidence.yml");
  const publication = await read(".github/workflows/publish-evidence.yml");
  assert.match(preview, /pages deploy apps\/web\/out/);
  assert.match(preview, /npm run stage:preview-evidence/);
  assert.match(preview, /NEXT_PUBLIC_ASSET_ORIGIN: ""/);
  assert.match(preview, /npm run check:preview/);
  assert.doesNotMatch(preview, /assets-preview\.bca\.wales/);
  assert.match(await read("config/cloudflare/pages-worker.mjs"), /status: 206/);
  assert.match(production, /environment: production/);
  assert.match(production, /npm run stage:pages-worker/);
  assert.match(production, /npm run check:production/);
  assert.match(production, /BCA_VERIFICATION_MODE: staged/);
  assert.match(staging, /npm run geodata -- stage/);
  assert.doesNotMatch(staging, /npm run geodata -- publish/);
  assert.match(publication, /actions\/download-artifact@v4/);
  assert.match(publication, /npm run geodata -- publish/);
  assert.doesNotMatch(publication, /acquire --registry|build --release-root/);
  assert.doesNotMatch(`${preview}\n${production}`, /wrangler r2 object put/);
});
