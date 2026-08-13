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
