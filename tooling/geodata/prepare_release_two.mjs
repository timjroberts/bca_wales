#!/usr/bin/env node

/**
 * Prepare the checksum-pinned release-two recipe from an exact LiDAR catalogue
 * intersection. This is a review-time helper; the geodata orchestrator still
 * performs a separate fresh acquisition into the immutable candidate archive.
 */

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const oldRecipePath = path.join(repositoryRoot, "data/launch/publication-recipe-2026-08-13.json");
const selectedPath = process.argv[2];
const cataloguePath = process.argv[3];
const outputPath = process.argv[4];
const cacheRoot = process.argv[5] ?? "/tmp/bca-release-two-prefetch";
const releaseId = "release-blorenge-2026-08-21.5";
const datasetVersion = "2026-08-21.5";
const stagingRoot = path.join(repositoryRoot, ".geodata-staging/release-two");

if (!selectedPath || !cataloguePath || !outputPath) {
  throw new Error("Usage: prepare_release_two.mjs SELECTED.json CATALOGUE.geojson OUTPUT.json [CACHE]");
}

async function sha256File(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function download(url, name) {
  await mkdir(cacheRoot, { recursive: true });
  const destination = path.join(cacheRoot, name);
  try {
    const details = await stat(destination);
    if (details.isFile() && details.size > 0) return await sha256File(destination);
  } catch {}

  const temporary = `${destination}.partial`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: "w" }));
      await rename(temporary, destination);
      return await sha256File(destination);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`${url}: ${lastError}`);
}

async function mapLimit(items, limit, operation) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await operation(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function input({ input_id, dataset_id, source, destination, media_type, maximum_bytes, expected_sha256 }) {
  return { input_id, dataset_id, source, destination, media_type, maximum_bytes, expected_sha256 };
}

const oldRecipe = JSON.parse(await readFile(oldRecipePath, "utf8"));
const registry = JSON.parse(await readFile(path.join(repositoryRoot, "data/launch/source-registry.json"), "utf8"));
const selectedTiles = JSON.parse(await readFile(selectedPath, "utf8"))
  .sort((left, right) => left.dtm_link.localeCompare(right.dtm_link));
const oldInputs = new Map(oldRecipe.inputs.map((item) => [item.input_id, item]));
const knownHashByUrl = new Map(oldRecipe.inputs.map((item) => [item.source.replace(/^planetary:/, ""), item.expected_sha256]));

const bounds = "323233.5310126663,198414.9666252311,333993.16014189116,215940.42484088655,EPSG%3A27700";
const contextUrls = {
  "nrw-sssi": registry.sources.find((source) => source.dataset_id === "nrw-sssi").acquisition.url,
  "nrw-national-park": `https://datamap.gov.wales/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=inspire-nrw%3ANRW_NATIONAL_PARK&outputFormat=application%2Fjson&srsName=EPSG%3A27700&BBOX=${bounds}`,
  "nrw-main-rivers": `https://datamap.gov.wales/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=inspire-nrw%3ANRW_MAIN_RIVERS&outputFormat=application%2Fjson&srsName=EPSG%3A27700&BBOX=${bounds}`,
  "nrw-phase1-habitat": `https://datamap.gov.wales/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=geonode%3Anrw_phase1_vegetation_voronoi&outputFormat=application%2Fjson&srsName=EPSG%3A27700&BBOX=${bounds}`,
};
const effisUrl = "https://maps.effis.emergency.copernicus.eu/effis?service=WFS&version=1.1.0&request=getfeature&typename=ms%3Amodis.ba.poly&outputformat=geojson&srsName=EPSG%3A4326&bbox=51.680022769546724,-3.1141917079035677,51.83740107116975,-2.9576185245017776,EPSG%3A4326";
const b8aUrls = Object.fromEntries(["baseline", "prefire", "post"].map((role) => {
  const source = oldInputs.get(`s2-${role}-swir1`).source;
  return [role, source.replace(/B11\.tif$/, "B8A.tif")];
}));

const reviewDownloads = [
  ...Object.entries(contextUrls).map(([id, url]) => ({ id, url })),
  { id: "effis-bounded", url: effisUrl },
  ...Object.entries(b8aUrls).map(([role, url]) => ({ id: `s2-${role}-nir20`, url })),
];
const reviewHashes = new Map((await mapLimit(reviewDownloads, 4, async ({ id, url }) => [
  id,
  await download(url, `${id}.bin`),
])).map((entry) => entry));
await mkdir(stagingRoot, { recursive: true });
for (const { id } of reviewDownloads) {
  if (id.startsWith("s2-")) continue;
  await copyFile(path.join(cacheRoot, `${id}.bin`), path.join(stagingRoot, `${id}.geojson`));
}
await copyFile(cataloguePath, path.join(stagingRoot, "lidar-catalogue.geojson"));

const lidarInputs = await mapLimit(selectedTiles, 8, async (tile) => {
  const url = `https://${tile.dtm_link}`;
  const fileName = path.basename(new URL(url).pathname);
  const coordinates = fileName.match(/_(\d{6})_/)[1];
  const id = `lidar-${tile.delivery}-${coordinates}`;
  const checksum = knownHashByUrl.get(url) ?? await download(url, `${id}.tif`);
  return input({
    input_id: id,
    dataset_id: "wg-lidar-dtm-2020-2023",
    source: url,
    destination: `quarantine/lidar/${fileName}`,
    media_type: "image/tiff",
    maximum_bytes: 33554432,
    expected_sha256: checksum,
  });
});

const inputs = [
  input({
    input_id: "bca-area-core",
    dataset_id: "bca-area-of-interest",
    source: "Blorenge.geojson",
    destination: "quarantine/bca/Blorenge.geojson",
    media_type: "application/geo+json",
    maximum_bytes: 1048576,
    expected_sha256: await sha256File(path.join(repositoryRoot, "Blorenge.geojson")),
  }),
  ...Object.entries(contextUrls).map(([id]) => input({
    input_id: id,
    dataset_id: oldInputs.get(id).dataset_id,
    source: `.geodata-staging/release-two/${id}.geojson`,
    destination: oldInputs.get(id).destination,
    media_type: "application/geo+json",
    maximum_bytes: id === "nrw-phase1-habitat" ? 16777216 : oldInputs.get(id).maximum_bytes,
    expected_sha256: reviewHashes.get(id),
  })),
  {
    ...oldInputs.get("osm-wales"),
    source: ".geodata-work/release-blorenge-2026-08-13.6/quarantine/osm/wales-260812.osm.pbf",
  },
  input({
    input_id: "lidar-catalogue",
    dataset_id: "wg-lidar-tile-catalogue",
    source: ".geodata-staging/release-two/lidar-catalogue.geojson",
    destination: "quarantine/lidar/catalogue-expanded-aoi.geojson",
    media_type: "application/geo+json",
    maximum_bytes: 104857600,
    expected_sha256: await sha256File(cataloguePath),
  }),
  ...lidarInputs,
];

for (const role of ["baseline", "prefire", "post"]) {
  inputs.push(oldInputs.get(`s2-${role}-red`));
  inputs.push(oldInputs.get(`s2-${role}-nir`));
  inputs.push(input({
    input_id: `s2-${role}-nir20`,
    dataset_id: "copernicus-sentinel-2-l2a",
    source: b8aUrls[role],
    destination: `quarantine/sentinel/s2-${role}/B8A.tif`,
    media_type: "image/tiff",
    maximum_bytes: 268435456,
    expected_sha256: reviewHashes.get(`s2-${role}-nir20`),
  }));
  inputs.push(oldInputs.get(`s2-${role}-swir1`));
  inputs.push(oldInputs.get(`s2-${role}-swir2`));
  inputs.push(oldInputs.get(`s2-${role}-scl`));
}
inputs.push(...oldRecipe.inputs.filter((item) => item.input_id.startsWith("landsat-")));
inputs.push(input({
  input_id: "effis-bounded",
  dataset_id: "effis-current-burnt-areas",
  source: effisUrl,
  destination: "quarantine/effis/blorenge-expanded-aoi.geojson",
  media_type: "application/geo+json",
  maximum_bytes: 104857600,
  expected_sha256: reviewHashes.get("effis-bounded"),
}));
inputs.push(input({
  input_id: "effis-release-one",
  dataset_id: "effis-current-burnt-areas",
  source: ".geodata-work/release-blorenge-2026-08-13.6/quarantine/effis/blorenge.geojson",
  destination: "quarantine/effis/release-one-blorenge.geojson",
  media_type: "application/geo+json",
  maximum_bytes: 104857600,
  expected_sha256: oldInputs.get("effis-bounded").expected_sha256,
}));

const lidarIds = lidarInputs.map((item) => item.input_id);
const sceneIds = (role) => ["red", "nir", "nir20", "swir1", "swir2", "scl"].map((band) => `s2-${role}-${band}`);
const landsatIds = inputs.filter((item) => item.input_id.startsWith("landsat-")).map((item) => item.input_id);
const aoiDependentInputIds = inputs
  .map((item) => item.input_id)
  .filter((id) => !["bca-area-core", "effis-release-one", "osm-wales"].includes(id));

const intermediates = [
  ["context-geojson", "private/context.geojson"],
  ["terrain-hillshade-tif", "private/terrain-hillshade.tif"],
  ["terrain-contours-geojson", "private/terrain-contours.geojson"],
  ["terrain-mbtiles", "private/terrain.mbtiles"],
  ["change-report", "private/change-report.json"],
  ["change-mbtiles", "private/change.mbtiles"],
  ["ndvi-render-tif", "private/ndvi-render.tif"],
  ["ndvi-mbtiles", "private/ndvi.mbtiles"],
  ["ndmi-render-tif", "private/ndmi-render.tif"],
  ["ndmi-mbtiles", "private/ndmi.mbtiles"],
].map(([artifact_id, artifactPath]) => ({ artifact_id, path: artifactPath }));

const steps = [
  {
    step_id: "build-context-v2",
    tool: "python3",
    argv: ["/repo/tooling/geodata/recipes/build_launch_context_v2.py", "--core", "{artifact:bca-area-core}", "--sssi", "{artifact:nrw-sssi}", "--park", "{artifact:nrw-national-park}", "--rivers", "{artifact:nrw-main-rivers}", "--habitat", "{artifact:nrw-phase1-habitat}", "--osm", "{artifact:osm-wales}", "--geojson", "{artifact:context-geojson}", "--summary", "{artifact:context-summary}"],
    inputs: ["bca-area-core", "nrw-sssi", "nrw-national-park", "nrw-main-rivers", "nrw-phase1-habitat", "osm-wales"],
    outputs: ["context-geojson", "context-summary"],
  },
  {
    step_id: "tile-context-v2",
    tool: "tippecanoe",
    argv: ["--force", "--output", "{artifact:context-pmtiles}", "--minimum-zoom", "8", "--maximum-zoom", "14", "--drop-densest-as-needed", "{artifact:context-geojson}"],
    inputs: ["context-geojson"],
    outputs: ["context-pmtiles"],
  },
  {
    step_id: "build-terrain-v2",
    tool: "python3",
    argv: ["/repo/tooling/geodata/recipes/build_terrain_v2.py", "--core", "{artifact:bca-area-core}", "--dtm", "{artifact:terrain-dtm-cog}", "--hillshade", "{artifact:terrain-hillshade-tif}", "--contours", "{artifact:terrain-contours-geojson}", "--summary", "{artifact:terrain-summary}", "--tiles", ...lidarIds.map((id) => `{artifact:${id}}`)],
    inputs: ["bca-area-core", "lidar-catalogue", ...lidarIds],
    outputs: ["terrain-dtm-cog", "terrain-hillshade-tif", "terrain-contours-geojson", "terrain-summary"],
  },
  {
    step_id: "terrain-mbtiles-v2",
    tool: "gdal_translate",
    argv: ["-of", "MBTILES", "-co", "TILE_FORMAT=PNG", "{artifact:terrain-hillshade-tif}", "{artifact:terrain-mbtiles}"],
    inputs: ["terrain-hillshade-tif"], outputs: ["terrain-mbtiles"],
  },
  {
    step_id: "terrain-raster-pmtiles-v2", tool: "pmtiles",
    argv: ["convert", "{artifact:terrain-mbtiles}", "{artifact:terrain-pmtiles}"],
    inputs: ["terrain-mbtiles"], outputs: ["terrain-pmtiles"],
  },
  {
    step_id: "terrain-contours-pmtiles-v2", tool: "tippecanoe",
    argv: ["--force", "--output", "{artifact:terrain-contours-pmtiles}", "--minimum-zoom", "8", "--maximum-zoom", "14", "{artifact:terrain-contours-geojson}"],
    inputs: ["terrain-contours-geojson"], outputs: ["terrain-contours-pmtiles"],
  },
  {
    step_id: "build-change-evidence-v2",
    tool: "python3",
    argv: [
      "/repo/tooling/geodata/recipes/build_change_evidence_v2.py", "--core", "{artifact:bca-area-core}",
      "--baseline", ...sceneIds("baseline").map((id) => `{artifact:${id}}`),
      "--prefire", ...sceneIds("prefire").map((id) => `{artifact:${id}}`),
      "--post", ...sceneIds("post").map((id) => `{artifact:${id}}`),
      "--effis", "{artifact:effis-bounded}", "--previous-effis", "{artifact:effis-release-one}",
      "--combined-cog", "{artifact:change-cog}", "--ndvi-cog", "{artifact:ndvi-cog}", "--ndmi-cog", "{artifact:ndmi-cog}",
      "--effis-out", "{artifact:effis-geojson}", "--effis-summary", "{artifact:effis-summary-json}",
      "--combined-csv", "{artifact:evidence-csv}", "--ndvi-csv", "{artifact:ndvi-summary-csv}", "--ndvi-json", "{artifact:ndvi-summary-json}",
      "--ndmi-csv", "{artifact:ndmi-summary-csv}", "--ndmi-json", "{artifact:ndmi-summary-json}", "--summary", "{artifact:change-report}",
    ],
    inputs: ["bca-area-core", ...sceneIds("baseline"), ...sceneIds("prefire"), ...sceneIds("post"), ...landsatIds, "effis-bounded", "effis-release-one"],
    outputs: ["change-cog", "ndvi-cog", "ndmi-cog", "effis-geojson", "effis-summary-json", "evidence-csv", "ndvi-summary-csv", "ndvi-summary-json", "ndmi-summary-csv", "ndmi-summary-json", "change-report"],
  },
  {
    step_id: "change-mbtiles-v2", tool: "gdal_translate",
    argv: ["-b", "4", "-of", "MBTILES", "-ot", "Byte", "-scale", "0", "3", "0", "255", "-co", "TILE_FORMAT=PNG", "{artifact:change-cog}", "{artifact:change-mbtiles}"],
    inputs: ["change-cog"], outputs: ["change-mbtiles"],
  },
  {
    step_id: "change-raster-pmtiles-v2", tool: "pmtiles",
    argv: ["convert", "{artifact:change-mbtiles}", "{artifact:change-pmtiles}"],
    inputs: ["change-mbtiles"], outputs: ["change-pmtiles"],
  },
  ...["ndvi", "ndmi"].flatMap((id) => [
    {
      step_id: `render-${id}-v2`, tool: "python3",
      argv: ["/repo/tooling/geodata/recipes/render_change_component.py", "--input", `{artifact:${id}-cog}`, "--core", "{artifact:bca-area-core}", "--product", id.toUpperCase(), "--output", `{artifact:${id}-render-tif}`],
      inputs: ["bca-area-core", `${id}-cog`], outputs: [`${id}-render-tif`],
    },
    {
      step_id: `${id}-mbtiles-v2`, tool: "gdal_translate",
      argv: ["-of", "MBTILES", "-co", "TILE_FORMAT=PNG", `{artifact:${id}-render-tif}`, `{artifact:${id}-mbtiles}`],
      inputs: [`${id}-render-tif`], outputs: [`${id}-mbtiles`],
    },
    {
      step_id: `${id}-raster-pmtiles-v2`, tool: "pmtiles",
      argv: ["convert", `{artifact:${id}-mbtiles}`, `{artifact:${id}-pmtiles}`],
      inputs: [`${id}-mbtiles`], outputs: [`${id}-pmtiles`],
    },
  ]),
  {
    step_id: "build-release-summary-v2", tool: "python3",
    argv: ["/repo/tooling/geodata/recipes/build_release_summary_v2.py", "--context", "{artifact:context-summary}", "--terrain", "{artifact:terrain-summary}", "--change", "{artifact:change-report}", "--release-id", releaseId, "--dataset-version", datasetVersion, "--output", "{artifact:release-summary}"],
    inputs: ["context-summary", "terrain-summary", "change-report"], outputs: ["release-summary"],
  },
];

const outputs = [
  ["context-pmtiles", "landscape-context", "outputs/context.pmtiles", "vector_pmtiles", "application/vnd.pmtiles", "public", "Bilingual landscape context vector tiles including the visible BCA-area core.", { minimum_bytes: 1000, maximum_bytes: 33554432 }],
  ["context-summary", "landscape-context", "outputs/context-summary.json", "accessible_json", "application/json", "public", "Accessible bilingual summary of the release-wide landscape context.", { minimum_bytes: 500, maximum_bytes: 1048576, required_fields: ["area_of_interest", "layers", "limitations"] }],
  ["terrain-dtm-cog", "terrain", "private/terrain-dtm.tif", "cog", "image/tiff; application=geotiff; profile=cloud-optimized", "private", "Private reproducibility DTM for the exact expanded AOI.", { minimum_bytes: 1000, maximum_bytes: 536870912, expected_crs: "EPSG:27700", expected_resolution_m: 10, expected_band_count: 1 }],
  ["terrain-pmtiles", "terrain", "outputs/terrain.pmtiles", "raster_pmtiles", "application/vnd.pmtiles", "public", "Terrain hillshade raster tiles.", { minimum_bytes: 1000, maximum_bytes: 16777216 }],
  ["terrain-contours-pmtiles", "terrain", "outputs/terrain-contours.pmtiles", "vector_pmtiles", "application/vnd.pmtiles", "public", "Labelled 10 metre terrain contours.", { minimum_bytes: 1000, maximum_bytes: 16777216 }],
  ["terrain-summary", "terrain", "outputs/terrain-summary.json", "accessible_json", "application/json", "public", "Accessible terrain source, coverage and elevation summary.", { minimum_bytes: 300, maximum_bytes: 1048576, required_fields: ["source", "source_tile_count", "capture_dates", "spatial_contract", "elevation_m", "limitations"] }],
  ["change-cog", "observed-change", "private/observed-change.tif", "cog", "image/tiff; application=geotiff; profile=cloud-optimized", "private", "Private combined evidence COG.", { minimum_bytes: 1000, maximum_bytes: 67108864, expected_crs: "EPSG:32630", expected_resolution_m: 20, expected_band_count: 5, expected_band_descriptions: ["dNBR", "delta_NDVI", "delta_NDMI", "evidence_state", "observation_count"] }],
  ["change-pmtiles", "observed-change", "outputs/observed-change.pmtiles", "raster_pmtiles", "application/vnd.pmtiles", "public", "Combined observed surface and vegetation change overview.", { minimum_bytes: 1000, maximum_bytes: 8388608 }],
  ["evidence-csv", "observed-change", "outputs/evidence-states.csv.txt", "accessible_csv", "text/csv", "public", "Accessible combined evidence-state counts and areas.", { minimum_bytes: 100, maximum_bytes: 1048576, minimum_rows: 4, required_fields: ["evidence_state", "pixel_count", "area_ha_rounded"] }],
  ["release-summary", "observed-change", "outputs/release-summary.json", "accessible_json", "application/json", "public", "Accessible release-wide factual, provenance and limitation summary.", { minimum_bytes: 1000, maximum_bytes: 2097152, required_fields: ["release_id", "dataset_version", "area_of_interest", "change_evidence", "limitations"] }],
  ["ndvi-cog", "ndvi-change", "outputs/ndvi-change.tif", "cog", "image/tiff; application=geotiff; profile=cloud-optimized", "public", "Lossless native 10 m signed NDVI difference COG for bounded range reads.", { minimum_bytes: 1000, maximum_bytes: 33554432, expected_crs: "EPSG:32630", expected_resolution_m: 10, expected_band_count: 1, expected_band_descriptions: ["delta_NDVI"] }],
  ["ndvi-pmtiles", "ndvi-change", "outputs/ndvi-change.pmtiles", "raster_pmtiles", "application/vnd.pmtiles", "public", "Fixed-scale NDVI change display tiles with patterned Not observed pixels.", { minimum_bytes: 1000, maximum_bytes: 8388608 }],
  ["ndvi-summary-csv", "ndvi-change", "outputs/ndvi-change-summary.csv.txt", "accessible_csv", "text/csv", "public", "Accessible fixed-bin NDVI counts and areas.", { minimum_bytes: 100, maximum_bytes: 1048576, minimum_rows: 8, required_fields: ["product", "bin", "pixel_count", "area_ha", "units", "baseline_date", "comparison_date"] }],
  ["ndvi-summary-json", "ndvi-change", "outputs/ndvi-change-summary.json", "accessible_json", "application/json", "public", "Accessible bilingual NDVI method, dates, distribution, attribution and limitations.", { minimum_bytes: 500, maximum_bytes: 1048576, required_fields: ["product", "names", "formula", "bands", "dates", "units", "resolution_m", "bins", "limitations"] }],
  ["ndmi-cog", "ndmi-change", "outputs/ndmi-change.tif", "cog", "image/tiff; application=geotiff; profile=cloud-optimized", "public", "Lossless native 20 m signed NDMI difference COG for bounded range reads.", { minimum_bytes: 1000, maximum_bytes: 33554432, expected_crs: "EPSG:32630", expected_resolution_m: 20, expected_band_count: 1, expected_band_descriptions: ["delta_NDMI"] }],
  ["ndmi-pmtiles", "ndmi-change", "outputs/ndmi-change.pmtiles", "raster_pmtiles", "application/vnd.pmtiles", "public", "Fixed-scale NDMI change display tiles with patterned Not observed pixels.", { minimum_bytes: 1000, maximum_bytes: 8388608 }],
  ["ndmi-summary-csv", "ndmi-change", "outputs/ndmi-change-summary.csv.txt", "accessible_csv", "text/csv", "public", "Accessible fixed-bin NDMI counts and areas.", { minimum_bytes: 100, maximum_bytes: 1048576, minimum_rows: 8, required_fields: ["product", "bin", "pixel_count", "area_ha", "units", "baseline_date", "comparison_date"] }],
  ["ndmi-summary-json", "ndmi-change", "outputs/ndmi-change-summary.json", "accessible_json", "application/json", "public", "Accessible bilingual NDMI method, dates, distribution, attribution and limitations.", { minimum_bytes: 500, maximum_bytes: 1048576, required_fields: ["product", "names", "formula", "bands", "dates", "units", "resolution_m", "bins", "limitations"] }],
  ["effis-geojson", "effis-event", "outputs/effis-592404.geojson", "geojson", "application/geo+json", "public", "Complete provider attributes with display geometry clipped to the expanded AOI.", { minimum_bytes: 500, maximum_bytes: 1048576, minimum_features: 1, required_fields: ["provider_feature_id", "provider", "classification", "display_geometry", "limitation"] }],
  ["effis-summary-json", "effis-event", "outputs/effis-592404-summary.json", "accessible_json", "application/json", "public", "Accessible bilingual EFFIS provenance, release comparison and limitations.", { minimum_bytes: 300, maximum_bytes: 1048576, required_fields: ["layer", "provider_feature", "comparison_with_release_one", "attribution", "limitations"] }],
].map(([asset_id, dataset_id, outputPath, profile, media_type, visibility, accessible_description, qa]) => ({ asset_id, dataset_id, path: outputPath, profile, media_type, visibility, accessible_description, qa }));

const datasets = [
  {
    dataset_id: "landscape-context", source_dataset_ids: ["bca-area-of-interest", "nrw-sssi", "nrw-national-park", "osm-wales-geofabrik", "nrw-main-rivers", "nrw-phase1-vegetation-voronoi"], evidence_version: datasetVersion,
    title: "Expanded Blorenge landscape context / Cyd-destun tirwedd ehangach Blorenge", provider: "Blorenge Commoners Association, Natural Resources Wales, OpenStreetMap contributors and Geofabrik", licence: "BCA publication authority, OGL 3.0 and ODbL 1.0 by source", attribution: "Blorenge Commoners Association; contains NRW and Ordnance Survey information under the recorded attribution; © OpenStreetMap contributors; processed by Geofabrik.", classification: "contextual", observation_dates: ["2026-07-30", "2026-08-12", "2026-08-21"], method: "Preserve the canonical BCA core, derive its exact 2 km AOI in EPSG:27700, and clip only allowlisted context fields to that AOI.", uncertainty: "Source dates and completeness vary; the BCA core is approximate and contextual paths do not establish legal status.", limitations: ["The BCA-area is not the legal, official, surveyed or current CL18 boundary.", "The SSSI remains an independent authoritative context layer.", "Phase 1 habitat is historical."],
  },
  {
    dataset_id: "terrain", source_dataset_ids: ["bca-area-of-interest", "wg-lidar-tile-catalogue", "wg-lidar-dtm-2020-2023"], evidence_version: datasetVersion,
    title: "Expanded Blorenge terrain context / Cyd-destun tir ehangach Blorenge", provider: "Welsh Government; BCA processing", licence: "Open Government Licence 3.0 and BCA publication authority", attribution: "Welsh Government LiDAR; processed by Blorenge Commoners Association.", classification: "contextual", observation_dates: ["2020-12-24", "2020-12-25", "2021-02-27", "2022-01-12"], method: "Mosaic the 163 exact intersecting 1 m DTM tiles, average to 10 m inside the expanded AOI, then derive fixed hillshade and contours.", uncertainty: "Capture dates vary by tile and hillshade is a visualisation.", limitations: ["Not produced specifically for flood modelling.", "Terrain does not describe current surface cover."],
  },
  {
    dataset_id: "observed-change", source_dataset_ids: ["bca-area-of-interest", "copernicus-sentinel-2-l2a", "usgs-landsat-c2-l2-sr"], evidence_version: datasetVersion,
    title: "Observed surface and vegetation change / Newid arwyneb a llystyfiant a arsylwyd", provider: "European Union Copernicus programme, USGS and BCA processing", licence: "Copernicus Sentinel data legal notice, USGS public domain and BCA publication authority", attribution: "Contains modified Copernicus Sentinel data 2025–2026; Landsat imagery courtesy of the U.S. Geological Survey; processing by Blorenge Commoners Association.", classification: "derived", observation_dates: ["2025-07-12", "2026-07-12", "2026-07-27", "2026-08-11"], method: "Apply the common Sentinel mask, require three-observation comparability, calculate continuous dNBR/NDVI/NDMI and publish the conservative uncalibrated combined states; Landsat corroboration remains separate and unfused.", uncertainty: "Evidence states are not locally calibrated severity and do not establish pixel-level cause.", limitations: ["Not proof of ecological condition or recovery.", "No exact incident-authority perimeter is available.", "Not observed is never no change."],
  },
  {
    dataset_id: "ndvi-change", source_dataset_ids: ["bca-area-of-interest", "copernicus-sentinel-2-l2a"], evidence_version: datasetVersion,
    title: "Vegetation greenness index change (NDVI) / Newid mynegai gwyrddni llystyfiant (NDVI)", provider: "European Union Copernicus programme; BCA processing", licence: "Copernicus Sentinel data legal notice and BCA publication authority", attribution: "Contains modified Copernicus Sentinel data 2025–2026; processing by Blorenge Commoners Association.", classification: "derived", observation_dates: ["2025-07-12", "2026-08-11"], method: "Publish NDVI(2026-08-11) minus NDVI(2025-07-12) from native B8/B4 at 10 m after the common SCL mask.", uncertainty: "Rainfall, phenology, grazing, management and residual observation effects may contribute.", limitations: ["Does not establish cause, fire damage, severity, habitat condition or recovery.", "Not observed pixels fail one or both date masks."],
  },
  {
    dataset_id: "ndmi-change", source_dataset_ids: ["bca-area-of-interest", "copernicus-sentinel-2-l2a"], evidence_version: datasetVersion,
    title: "Moisture-sensitive index change (NDMI) / Newid mynegai sy’n sensitif i leithder (NDMI)", provider: "European Union Copernicus programme; BCA processing", licence: "Copernicus Sentinel data legal notice and BCA publication authority", attribution: "Contains modified Copernicus Sentinel data 2025–2026; processing by Blorenge Commoners Association.", classification: "derived", observation_dates: ["2025-07-12", "2026-08-11"], method: "Publish NDMI(2026-08-11) minus NDMI(2025-07-12) from native B8A/B11 at 20 m after the common SCL mask.", uncertainty: "Rainfall, phenology, grazing, management and residual observation effects may contribute.", limitations: ["Does not establish cause, fire damage, severity, dryness or wetness.", "Not observed pixels fail one or both date masks."],
  },
  {
    dataset_id: "effis-event", source_dataset_ids: ["bca-area-of-interest", "effis-current-burnt-areas"], evidence_version: datasetVersion,
    title: "EFFIS provisional provider boundary / Ffin dros dro y darparwr EFFIS", provider: "European Union, Copernicus EFFIS; BCA processing", licence: "CC BY 4.0 and BCA publication authority", attribution: "European Union, Copernicus EFFIS; clipped and reformatted by Blorenge Commoners Association.", classification: "provisional", observation_dates: ["2026-07-20", "2026-07-29"], method: "Reacquire complete provider feature 592404, preserve its fields and snapshot, compare it with release one, and clip only the display geometry to the expanded AOI.", uncertainty: "Provider dates and geometry are not incident-authority truth.", limitations: ["Not an authority, legal or surveyed perimeter.", "Does not validate raster change or thermal anomalies."],
  },
];

const recipe = {
  schema_version: "1.0.0",
  recipe_id: "blorenge-second-release",
  recipe_version: "2.0.4",
  release_id: releaseId,
  dataset_version: datasetVersion,
  registry_id: "blorenge-launch",
  public_asset_origin: "https://assets.bca.wales",
  supersedes: "release-blorenge-2026-08-13.6",
  spatial_contract: {
    core_input_id: "bca-area-core", core_label: "BCA-area of interest", core_version: "2026-08-21.1", core_sha256: "825404bb2e7fb85620d874b900a0884e3dc5f0107c26b5491dca665f90f77d73",
    buffer_distance_m: 2000, buffer_crs: "EPSG:27700", clip_mode: "exact", aoi_dependent_input_ids: aoiDependentInputIds,
    aoi_dependent_dataset_ids: datasets.map((dataset) => dataset.dataset_id), rebuild_aoi_dependent_inputs: true,
  },
  quality_gates: [{
    gate_id: "expanded-aoi-change-coverage", report_artifact_id: "change-report",
    assertions: [
      ["observations.seasonal_baseline.valid_aoi_percent", "gte", 95, "Seasonal baseline must be at least 95% valid over the expanded AOI."],
      ["observations.before_first_report.valid_aoi_percent", "gte", 95, "Before-first-report scene must be at least 95% valid over the expanded AOI."],
      ["observations.first_suitable_after_report.valid_aoi_percent", "gte", 95, "Post-report comparison scene must be at least 95% valid over the expanded AOI."],
      ["coverage.ndvi_comparable_percent", "gte", 90, "NDVI must be at least 90% comparable over the expanded AOI."],
      ["coverage.ndmi_comparable_percent", "gte", 90, "NDMI must be at least 90% comparable over the expanded AOI."],
      ["coverage.combined_comparable_percent", "gte", 90, "Combined evidence must be at least 90% comparable over the expanded AOI."],
      ["coverage.effis_combined_comparable_percent", "gte", 95, "Combined evidence must be at least 95% comparable over the EFFIS feature."],
    ].map(([assertionPath, operator, value, message]) => ({ path: assertionPath, operator, value, message })),
  }],
  inputs,
  intermediates,
  steps,
  outputs,
  datasets,
  cross_release_qa: {
    baseline_manifest: ".geodata-work/release-blorenge-2026-08-13.6/manifests/release.json",
    maximum_asset_growth_ratio: 10,
    maximum_feature_change_ratio: 10,
  },
};

await writeFile(outputPath, `${JSON.stringify(recipe, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: outputPath, inputs: inputs.length, lidar_tiles: lidarInputs.length, outputs: outputs.length }, null, 2));
