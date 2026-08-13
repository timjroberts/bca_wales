import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  acquireRelease,
  buildRelease,
  inspectOutput,
  loadContracts,
  reproduceRelease,
  resolveAcquisitionTarget,
  verifyArchive
} from "../tooling/geodata/src/pipeline.mjs";
import { publishRelease, withdrawRelease } from "../tooling/geodata/src/r2.mjs";
import { readJson } from "../tooling/geodata/src/runtime.mjs";

const repositoryRoot = path.resolve(new URL("../", import.meta.url).pathname);
const fixedDate = new Date("2026-08-13T10:00:00Z");
const clock = () => fixedDate;
const commit = "1".repeat(40);

test("Planetary Computer acquisition signs only the reviewed Landsat mirror and records no SAS query", async () => {
  const asset = "https://landsateuwest.blob.core.windows.net/landsat-c2/example.TIF";
  const target = await resolveAcquisitionTarget(`planetary:${asset}`, async (url) => {
    assert.equal(url.hostname, "planetarycomputer.microsoft.com");
    assert.equal(url.searchParams.get("href"), asset);
    return new Response(JSON.stringify({ href: `${asset}?sig=temporary` }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  });
  assert.equal(target.recordUrl, asset);
  assert.equal(target.fetchUrl, `${asset}?sig=temporary`);
});

class MemoryStore {
  objects = new Map();

  async putFile(key, file) {
    this.objects.set(key, await readFile(file));
  }

  async getFile(key, destination) {
    const value = this.objects.get(key);
    if (!value) throw new Error("404 not found");
    await writeFile(destination, value, { flag: "wx" });
  }

  async getOptional(key, destination) {
    if (!this.objects.has(key)) return false;
    await this.getFile(key, destination);
    return true;
  }
}

async function fixture(root) {
  const termsContent = "Test licence terms snapshot.\n";
  const termsPath = path.join(root, "terms/test.txt");
  await mkdir(path.dirname(termsPath), { recursive: true });
  await writeFile(termsPath, termsContent);
  const termsSha = createHash("sha256").update(termsContent).digest("hex");
  const sourceFile = path.join(root, "source.geojson");
  await writeFile(sourceFile, JSON.stringify({
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { name: "Blorenge", code: "33WFL" },
      geometry: { type: "Point", coordinates: [-3.06, 51.79] }
    }]
  }));
  const registry = {
    schema_version: "1.0.0",
    registry_id: "test-registry",
    reviewed_at: "2026-08-13T09:00:00Z",
    release_authority: "timjroberts",
    status: "approved",
    status_reason: "Test contract is approved.",
    area_of_interest: {},
    hard_gaps: [],
    deferred_enhancements: [],
    sources: [{
      dataset_id: "source-one",
      title: "Source one",
      purpose: "Toolchain test",
      classification: "authoritative",
      provider: "Test provider",
      provider_dataset_id: "source-one",
      landing_url: "https://example.invalid/source",
      acquisition: { method: "local fixture", url: sourceFile, media_type: "application/geo+json" },
      upstream: { publication_date: "2026-08-13", refresh_policy: "manual" },
      licence: { id: "test", url: "https://example.invalid/terms", attribution: "Test attribution", reviewed_at: "2026-08-13" },
      schema: { geometry: "Point", required_fields: ["name", "code"] },
      transformation: "Copy the exact fixture.",
      known_gaps: [],
      safety: "public_safe",
      publication: "approved_candidate",
      contract: {
        owner: "timjroberts",
        temporal_role: "test observation",
        licence_terms: { snapshot_path: "terms/test.txt", sha256: termsSha },
        recipe: { id: "source-one", version: "1.0.0" },
        output_profiles: ["geojson", "accessible_csv"],
        refresh: { mode: "manual", maximum_age_days: 30, approved_change_bounds: {} },
        retention: "Retain published inputs.",
        withdrawal: "Withdraw the pointer."
      }
    }]
  };
  const recipe = {
    schema_version: "1.0.0",
    recipe_id: "test-recipe",
    recipe_version: "1.0.0",
    release_id: "release-test-001",
    dataset_version: "test-001",
    registry_id: "test-registry",
    public_asset_origin: "https://assets.example.invalid",
    supersedes: null,
    inputs: [{
      input_id: "source-one-input",
      dataset_id: "source-one",
      source: sourceFile,
      destination: "quarantine/source.geojson",
      media_type: "application/geo+json",
      maximum_bytes: 10000,
      expected_sha256: null
    }],
    intermediates: [],
    steps: [
      {
        step_id: "copy-geojson",
        tool: "ogr2ogr",
        argv: ["-f", "GeoJSON", "{artifact:public-geojson}", "{artifact:source-one-input}"],
        inputs: ["source-one-input"],
        outputs: ["public-geojson"]
      },
      {
        step_id: "make-csv",
        tool: "python3",
        argv: ["/repo/tooling/geodata/recipes/geojson_to_csv.py", "{artifact:public-geojson}", "{artifact:accessible-csv}", "name", "code"],
        inputs: ["public-geojson"],
        outputs: ["accessible-csv"]
      }
    ],
    outputs: [
      {
        asset_id: "public-geojson",
        dataset_id: "published-one",
        path: "outputs/public.geojson",
        profile: "geojson",
        media_type: "application/geo+json",
        visibility: "public",
        accessible_description: "Test geometry.",
        qa: { minimum_bytes: 20, minimum_features: 1, required_fields: ["name", "code"] }
      },
      {
        asset_id: "accessible-csv",
        dataset_id: "published-one",
        path: "outputs/public.csv",
        profile: "accessible_csv",
        media_type: "text/csv",
        visibility: "public",
        accessible_description: "Test non-map table.",
        qa: { minimum_bytes: 10, minimum_rows: 1, required_fields: ["name", "code"] }
      }
    ],
    datasets: [{
      dataset_id: "published-one",
      source_dataset_ids: ["source-one"],
      evidence_version: "test-001",
      title: "Published test",
      provider: "Test provider",
      licence: "Test terms",
      attribution: "Test attribution",
      classification: "authoritative",
      observation_dates: ["2026-08-13"],
      method: "Test-only copy.",
      uncertainty: "No real evidence.",
      limitations: ["Test only."]
    }],
    cross_release_qa: {
      baseline_manifest: null,
      maximum_asset_growth_ratio: 2,
      maximum_feature_change_ratio: 0
    }
  };
  const registryPath = path.join(root, "registry.json");
  const recipePath = path.join(root, "recipe.json");
  await Promise.all([
    writeFile(registryPath, JSON.stringify(registry)),
    writeFile(recipePath, JSON.stringify(recipe))
  ]);
  return { registryPath, recipePath };
}

function localRunner(releaseRoot) {
  const host = (containerPath) => path.join(releaseRoot, containerPath.replace(/^\/work\//, ""));
  return async (tool, argv) => {
    if (argv[0] === "--version" || (tool === "pmtiles" && argv[0] === "version")) {
      const versions = {
        gdalinfo: "GDAL 3.13.2",
        tippecanoe: "tippecanoe v2.62.2",
        pmtiles: "pmtiles 1.30.0",
        python3: "Python 3.14"
      };
      return { stdout: `${versions[tool]}\n`, stderr: "" };
    }
    if (tool === "ogr2ogr") await copyFile(host(argv[3]), host(argv[2]));
    else if (tool === "python3") {
      const document = JSON.parse(await readFile(host(argv[1]), "utf8"));
      const rows = document.features.map((feature) => `${feature.properties.name},${feature.properties.code}`);
      await writeFile(host(argv[2]), `name,code\n${rows.join("\n")}\n`);
    } else if (tool === "pmtiles") return { stdout: "archive valid\n", stderr: "" };
    else if (tool === "gdalinfo") return { stdout: JSON.stringify({ metadata: { IMAGE_STRUCTURE: { LAYOUT: "COG" } } }), stderr: "" };
    else throw new Error(`Unexpected tool ${tool}`);
    return { stdout: "", stderr: "" };
  };
}

test("the launch registry and example recipe satisfy the final contracts", async () => {
  const loaded = await loadContracts({
    registryPath: path.join(repositoryRoot, "data/launch/source-registry.json"),
    recipePath: path.join(repositoryRoot, "config/publication/recipe.example.json")
  });
  assert.equal(loaded.registry.schema_version, "1.0.0");
  assert.equal(loaded.recipe.outputs.some((output) => output.profile === "accessible_csv"), true);
});

test("acquisition, build, archive verification and reproduction preserve exact lineage", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-geodata-test-"));
  context.after(() => rm(root, { recursive: true }));
  const contracts = await fixture(root);
  const acquired = await acquireRelease({
    ...contracts,
    workspaceRoot: path.join(root, "work"),
    codeCommit: commit,
    clock
  });
  const built = await buildRelease({
    releaseRoot: acquired.releaseRoot,
    clock,
    runner: localRunner(acquired.releaseRoot)
  });
  assert.equal(built.qa.result, "pass");
  assert.deepEqual(built.qa.hard_failures, []);
  assert.equal(built.candidate.assets.length, 2);
  assert.deepEqual(await verifyArchive(acquired.releaseRoot), {
    release_id: "release-test-001",
    verified_outputs: 2
  });

  const reproduced = await reproduceRelease({
    archiveRoot: acquired.releaseRoot,
    workspaceRoot: path.join(root, "reproduced"),
    clock,
    runner: localRunner(path.join(root, "reproduced/release-test-001"))
  });
  assert.deepEqual(
    reproduced.outputs.map((output) => output.sha256),
    built.lineage.outputs.map((output) => output.sha256)
  );
});

test("PMTiles v3 and COG output checks use package-aware verification", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-formats-test-"));
  context.after(() => rm(root, { recursive: true }));
  await mkdir(path.join(root, "outputs"));
  const pmtiles = path.join(root, "outputs/test.pmtiles");
  const cog = path.join(root, "outputs/test.tif");
  await writeFile(pmtiles, Buffer.concat([Buffer.from("PMTiles"), Buffer.from([3]), Buffer.alloc(32)]));
  await writeFile(cog, Buffer.concat([Buffer.from([0x49, 0x49, 0x2a, 0x00]), Buffer.alloc(32)]));
  const runner = localRunner(root);
  const pmtilesResult = await inspectOutput({
    asset_id: "tiles",
    profile: "raster_pmtiles",
    qa: { minimum_bytes: 8 }
  }, pmtiles, runner, root);
  const cogResult = await inspectOutput({
    asset_id: "analysis-cog",
    profile: "cog",
    qa: { minimum_bytes: 4 }
  }, cog, runner, root);
  assert.deepEqual(pmtilesResult.hardFailures, []);
  assert.deepEqual(cogResult.hardFailures, []);
});

test("publication changes the current pointer only after verified immutable uploads", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-publish-test-"));
  context.after(() => rm(root, { recursive: true }));
  const contracts = await fixture(root);
  const acquired = await acquireRelease({
    ...contracts,
    workspaceRoot: path.join(root, "work"),
    codeCommit: commit,
    clock
  });
  await buildRelease({ releaseRoot: acquired.releaseRoot, clock, runner: localRunner(acquired.releaseRoot) });
  const store = new MemoryStore();
  const published = await publishRelease({
    releaseRoot: acquired.releaseRoot,
    store,
    identity: "timjroberts",
    mode: "manual",
    clock
  });
  assert.equal(published.pointer.status, "current");
  assert.equal(store.objects.has("releases/current.json"), true);
  assert.equal(store.objects.has("releases/release-test-001/manifest.json"), true);
  assert.equal(store.objects.has("releases/release-test-001/assets/public.geojson"), true);

  const withdrawn = await withdrawRelease({
    releaseRoot: acquired.releaseRoot,
    store,
    expectedReleaseId: "release-test-001",
    identity: "timjroberts",
    reason: "Controlled withdrawal rehearsal",
    clock
  });
  assert.equal(withdrawn.pointer.status, "withdrawn");
  assert.equal(store.objects.has("releases/release-test-001/assets/public.geojson"), true, "withdrawal preserves immutable assets");
  assert.equal(JSON.parse(store.objects.get("releases/current.json").toString()).status, "withdrawn");
});

test("a failed gate cannot upload or promote anything", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-fail-closed-test-"));
  context.after(() => rm(root, { recursive: true }));
  const contracts = await fixture(root);
  const acquired = await acquireRelease({
    ...contracts,
    workspaceRoot: path.join(root, "work"),
    codeCommit: commit,
    clock
  });
  await buildRelease({ releaseRoot: acquired.releaseRoot, clock, runner: localRunner(acquired.releaseRoot) });
  const candidatePath = path.join(acquired.releaseRoot, "manifests/candidate-release.json");
  const candidate = await readJson(candidatePath);
  candidate.gate.result = "fail";
  candidate.gate.hard_failures = ["TEST_FAILURE"];
  await writeFile(candidatePath, JSON.stringify(candidate));
  const store = new MemoryStore();
  await assert.rejects(
    publishRelease({ releaseRoot: acquired.releaseRoot, store, identity: "timjroberts", clock }),
    /failing candidate/
  );
  assert.equal(store.objects.size, 0);
});

test("the pinned container executes a complete offline transformation", {
  skip: process.env.BCA_DOCKER_SMOKE !== "1"
}, async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "bca-container-test-"));
  context.after(() => rm(root, { recursive: true }));
  const contracts = await fixture(root);
  const acquired = await acquireRelease({
    ...contracts,
    workspaceRoot: path.join(root, "work"),
    codeCommit: commit,
    clock
  });
  const built = await buildRelease({ releaseRoot: acquired.releaseRoot, clock });
  assert.equal(built.qa.result, "pass");
  assert.equal(built.lineage.toolchain.verification.length, 4);
  assert.equal(built.lineage.outputs.length, 2);
});
