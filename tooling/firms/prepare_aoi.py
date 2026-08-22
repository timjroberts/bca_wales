#!/usr/bin/env python3
"""Derive the release-two FIRMS AOI from the canonical BCA core."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from osgeo import ogr, osr


EXPECTED_NAME = "BCA-area of interest"
EXPECTED_VERSION = "2026-08-21.1"


def spatial_reference(epsg: int) -> osr.SpatialReference:
    reference = osr.SpatialReference()
    reference.ImportFromEPSG(epsg)
    reference.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return reference


def write_canonical(path: Path, document: object) -> None:
    path.write_text(
        json.dumps(document, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--core", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    arguments = parser.parse_args()

    core_bytes = arguments.core.read_bytes()
    core_document = json.loads(core_bytes)
    if core_document.get("name") != EXPECTED_NAME:
        raise ValueError(f"Unexpected canonical core name: {core_document.get('name')!r}")
    features = core_document.get("features")
    if not isinstance(features, list) or len(features) != 1:
        raise ValueError("Canonical core must contain exactly one feature")
    feature = features[0]
    if feature.get("properties", {}).get("version") != EXPECTED_VERSION:
        raise ValueError("Canonical core version is not the release-two version")
    if feature.get("geometry", {}).get("type") != "Polygon":
        raise ValueError("Canonical core must be a Polygon")

    core_geometry = ogr.CreateGeometryFromJson(json.dumps(feature["geometry"]))
    if core_geometry is None or not core_geometry.IsValid():
        raise ValueError("Canonical core geometry is invalid")

    wgs84 = spatial_reference(4326)
    british_national_grid = spatial_reference(27700)
    to_bng = osr.CoordinateTransformation(wgs84, british_national_grid)
    to_wgs84 = osr.CoordinateTransformation(british_national_grid, wgs84)

    projected = core_geometry.Clone()
    projected.AssignSpatialReference(wgs84)
    if projected.Transform(to_bng) != ogr.OGRERR_NONE:
        raise RuntimeError("Could not transform canonical core to EPSG:27700")
    buffered = projected.Buffer(2000.0)
    if buffered is None or buffered.IsEmpty() or not buffered.IsValid():
        raise RuntimeError("Could not derive a valid 2 km buffer")
    area_square_metres = buffered.GetArea()
    perimeter_metres = buffered.Boundary().Length()

    buffered_wgs84 = buffered.Clone()
    buffered_wgs84.AssignSpatialReference(british_national_grid)
    if buffered_wgs84.Transform(to_wgs84) != ogr.OGRERR_NONE:
        raise RuntimeError("Could not transform buffered AOI to EPSG:4326")
    buffered_wgs84.FlattenTo2D()
    west, east, south, north = buffered_wgs84.GetEnvelope()

    geometry_document = json.loads(buffered_wgs84.ExportToJson())
    aoi_document = {
        "type": "FeatureCollection",
        "name": "BCA-area of interest plus exactly 2 km",
        "bbox": [west, south, east, north],
        "features": [
            {
                "type": "Feature",
                "id": "bca-area-of-interest-plus-2km",
                "properties": {
                    "name": "BCA-area of interest plus exactly 2 km",
                    "core_name": EXPECTED_NAME,
                    "core_version": EXPECTED_VERSION,
                    "buffer_distance_metres": 2000,
                    "buffer_crs": "EPSG:27700",
                    "public_crs": "EPSG:4326",
                },
                "geometry": geometry_document,
            }
        ],
    }

    arguments.output.mkdir(parents=True, exist_ok=False)
    aoi_path = arguments.output / "aoi.geojson"
    write_canonical(aoi_path, aoi_document)
    aoi_bytes = aoi_path.read_bytes()
    metadata = {
        "schema_version": "1.0.0",
        "core": {
            "path": str(arguments.core),
            "name": EXPECTED_NAME,
            "version": EXPECTED_VERSION,
            "sha256": hashlib.sha256(core_bytes).hexdigest(),
        },
        "derivation": {
            "operation": "OGR geometry buffer",
            "projected_crs": "EPSG:27700",
            "buffer_distance_metres": 2000,
            "output_crs": "EPSG:4326",
        },
        "aoi": {
            "bbox": [west, south, east, north],
            "area_square_metres": area_square_metres,
            "perimeter_metres": perimeter_metres,
            "sha256": hashlib.sha256(aoi_bytes).hexdigest(),
        },
    }
    write_canonical(arguments.output / "aoi-metadata.json", metadata)


if __name__ == "__main__":
    main()
