# Geodata publication toolchain

`bca-geodata` is the shell-free orchestrator for immutable evidence releases.
It validates the source registry and recipe, quarantines exact inputs, executes
pinned geospatial commands without transformation-time network access, checks
outputs, records complete lineage and changes the public R2 pointer only after
every versioned object has been verified in place.

The orchestrator and its JSON contracts are tested with Node. Real geospatial
steps run in `bca/geodata-toolchain:1.0.0`, built from `Containerfile` and
`config/publication/toolchain.lock.json`. The image pins GDAL, Tippecanoe,
PMTiles and Python. A release records the lock checksum and every invoked tool
version.

## Output recipes

Recipes use argument arrays, never shell strings. Exact `{artifact:ID}`
placeholders resolve inside the release workspace. Common pinned recipes are:

```json
[
  ["ogr2ogr", ["-f", "GeoJSON", "OUTPUT.geojson", "INPUT", "-t_srs", "EPSG:4326"]],
  ["tippecanoe", ["--force", "--output", "OUTPUT.pmtiles", "INPUT.geojson"]],
  ["gdal_translate", ["-of", "COG", "-co", "COMPRESS=ZSTD", "INPUT.tif", "OUTPUT.tif"]],
  ["gdal_translate", ["-of", "MBTILES", "INPUT.tif", "INTERMEDIATE.mbtiles"]],
  ["pmtiles", ["convert", "INTERMEDIATE.mbtiles", "OUTPUT.pmtiles"]]
]
```

An MBTiles temporary file is declared under `intermediates`; it cannot enter a
release manifest. Public outputs support small GeoJSON, vector PMTiles, raster
PMTiles, CSV and accessible JSON. Private COGs remain in lineage and the
reproducibility archive but are omitted from the public release manifest.

Run `npm run geodata -- --help` for the command surface. The complete release
procedure and recovery rules are in
`docs/runbooks/evidence-publication.md`.

When a recipe or transformation is corrected without changing provider inputs,
`reuse-acquisition` creates a new release workspace only after re-hashing every
retained byte against the new recipe. Original retrieval metadata is preserved;
the new manifest records the retained-input operation explicitly.

`stage` uploads and verifies only versioned assets and their final immutable
manifest. It never reads or writes `releases/current.json`; a later manual
`publish` re-verifies the same bytes before changing that pointer.

## Expanded-AOI and raster contracts

Superseding recipes can include `spatial_contract`. It pins the canonical core
input id, version and SHA-256; records the metric buffer CRS and distance; and
enumerates every AOI-dependent input and dataset that must be rebuilt. The
orchestrator rejects a core checksum that differs from the recipe input,
rejects unknown members, verifies every listed dataset output transitively
depends on the core input, and disables retained acquisition when the contract
requires fresh AOI-dependent inputs. Release two uses canonical
`Blorenge.geojson` version `2026-08-21.1`, transformed to `EPSG:27700` and
buffered by exactly 2000 m.

Recipe `quality_gates` evaluate named values in a JSON report artifact after
the offline graph runs. A missing report, missing value or failed `eq`, `gte`
or `lte` assertion becomes a hard publication-gate failure. Use these for
expanded-AOI scene validity, product comparability and EFFIS-coverage gates;
do not encode those thresholds only in prose.

Output QA supports `maximum_bytes` and, for COGs, `expected_crs`,
`expected_resolution_m`, `resolution_tolerance_m`, `expected_band_count` and
`expected_band_descriptions`. The release-two NDVI/NDMI contract uses these to
hold public component COGs to 32 MiB, native 10 m and 20 m resolution, and one
named analytical band. Component PMTiles use an 8 MiB ceiling.

`build_change_evidence_v2.py` is a new versioned transformation entry point.
It leaves the launch builder unchanged for release-one auditability, derives
the exact core-plus-2-km AOI, applies the common Sentinel-2 mask, fails before
writing outputs when the 95% scene, 90% product or 95% EFFIS comparability gate
fails, and writes separate lossless NDVI/NDMI COGs plus accessible CSV/JSON
distribution summaries. It requires B04, B08, B8A, B11, B12 and SCL for each
selected Sentinel-2 scene.
