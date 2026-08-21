#!/usr/bin/env python3

"""Build release-two terrain from the canonical BCA core plus exactly 2 km."""

import argparse
import json

from osgeo import gdal, ogr, osr

from build_launch_context import first_geometry, transform_geometry
from build_terrain import write_cutline

gdal.UseExceptions()
ogr.UseExceptions()
osr.UseExceptions()


def release_aoi(core_path):
    geometry, source_srs = first_geometry(core_path)
    datasource = ogr.Open(core_path)
    properties = datasource.GetLayer(0).GetNextFeature().items()
    if properties.get("name") != "BCA-area of interest" or properties.get("version") != "2026-08-21.1":
        raise RuntimeError("Core geometry identity/version does not match the release-two contract")
    british_grid = osr.SpatialReference()
    british_grid.ImportFromEPSG(27700)
    british_grid.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    core_bng = transform_geometry(geometry, source_srs, british_grid)
    if not core_bng.IsValid():
        raise RuntimeError("Core geometry is invalid")
    return core_bng.Buffer(2000.0), british_grid, properties


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--core", required=True)
    parser.add_argument("--dtm", required=True)
    parser.add_argument("--hillshade", required=True)
    parser.add_argument("--contours", required=True)
    parser.add_argument("--summary", required=True)
    parser.add_argument("--tiles", nargs="+", required=True)
    args = parser.parse_args()

    aoi, srs, core_properties = release_aoi(args.core)
    cutline = write_cutline(aoi, srs)
    vrt = gdal.BuildVRT("/vsimem/bca-terrain-v2.vrt", args.tiles)
    gdal.Warp(
        args.dtm,
        vrt,
        format="COG",
        dstSRS="EPSG:27700",
        xRes=10,
        yRes=10,
        resampleAlg="average",
        cutlineDSName="/vsimem/bca-terrain-aoi.geojson",
        cropToCutline=True,
        dstNodata=-9999,
        creationOptions=["COMPRESS=ZSTD", "BIGTIFF=IF_SAFER", "OVERVIEWS=IGNORE_EXISTING"],
    )
    gdal.DEMProcessing(
        args.hillshade,
        args.dtm,
        "hillshade",
        format="GTiff",
        computeEdges=True,
        azimuth=315,
        altitude=45,
        creationOptions=["TILED=YES", "COMPRESS=DEFLATE"],
    )

    dtm = gdal.Open(args.dtm)
    source_srs = osr.SpatialReference()
    source_srs.ImportFromWkt(dtm.GetProjection())
    target_srs = osr.SpatialReference()
    target_srs.ImportFromEPSG(4326)
    source_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    target_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    transform = osr.CoordinateTransformation(source_srs, target_srs)
    memory = ogr.GetDriverByName("Memory").CreateDataSource("")
    layer = memory.CreateLayer("contours", source_srs, geom_type=ogr.wkbLineString)
    layer.CreateField(ogr.FieldDefn("elevation_m", ogr.OFTReal))
    gdal.ContourGenerate(dtm.GetRasterBand(1), 10, 0, [], 1, -9999, layer, -1, 0)
    features = []
    for item in layer:
        geometry = item.GetGeometryRef().Clone()
        geometry.Transform(transform)
        features.append({
            "type": "Feature",
            "properties": {
                "layer_id": "terrain-contours",
                "source": "Welsh Government LiDAR",
                "elevation_m": round(item.GetField("elevation_m"), 1),
                "capture_period": "2020-2022",
            },
            "geometry": json.loads(geometry.ExportToJson()),
        })
    with open(args.contours, "x", encoding="utf-8") as handle:
        json.dump({"type": "FeatureCollection", "features": features}, handle, separators=(",", ":"))

    minimum, maximum, mean, standard_deviation = dtm.GetRasterBand(1).ComputeStatistics(False)
    summary = {
        "source": "Welsh Government 1 m DTM",
        "source_tile_count": len(args.tiles),
        "capture_dates": ["2020-12-24", "2020-12-25", "2021-02-27", "2022-01-12"],
        "display_resolution_m": 10,
        "contour_interval_m": 10,
        "spatial_contract": {
            "core_label": "BCA-area of interest",
            "core_version": core_properties["version"],
            "buffer_distance_m": 2000,
            "buffer_crs": "EPSG:27700",
        },
        "elevation_m": {
            "minimum": round(minimum, 1),
            "maximum": round(maximum, 1),
            "mean": round(mean, 1),
            "standard_deviation": round(standard_deviation, 1),
        },
        "method": "Exact intersecting source tiles were averaged to a 10 m DTM inside the BCA-area-of-interest-plus-2-km AOI; fixed 315-degree hillshade and 10 m contours were derived offline.",
        "limitations": [
            "Capture date varies by tile.",
            "Hillshade is a visualisation, not a direct observation of surface cover.",
            "The source was not produced specifically for flood modelling.",
        ],
    }
    with open(args.summary, "x", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2, sort_keys=True)
        handle.write("\n")
    cutline = None


if __name__ == "__main__":
    main()
