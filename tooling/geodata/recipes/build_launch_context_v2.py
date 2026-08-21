#!/usr/bin/env python3

"""Build release-two context from the canonical BCA core plus exactly 2 km."""

import argparse
import json
from collections import Counter

from osgeo import ogr, osr

from build_launch_context import (
    clean,
    clipped_features,
    feature_json,
    field,
    first_geometry,
    intersection,
    osm_tags,
    transform_geometry,
)

ogr.UseExceptions()
osr.UseExceptions()


def readable_features(layer, errors):
    consecutive_errors = 0
    while True:
        try:
            feature = layer.GetNextFeature()
        except RuntimeError as error:
            errors.append(str(error))
            consecutive_errors += 1
            if consecutive_errors > 100:
                raise RuntimeError("OSM layer produced more than 100 consecutive unreadable features") from error
            continue
        consecutive_errors = 0
        if feature is None:
            break
        yield feature


def osm_features_v2(path, aoi, aoi_srs, target_srs):
    datasource = ogr.Open(path)
    spatial_filter = transform_geometry(aoi, aoi_srs, target_srs)
    results = []
    path_types = Counter()
    read_errors = []

    points = datasource.GetLayerByName("points")
    if points:
        points.SetSpatialFilter(spatial_filter)
        for item in readable_features(points, read_errors):
            tags = osm_tags(item)
            place = clean(field(item, "place"))
            name = clean(field(item, "name"))
            if not place or not name:
                continue
            geometry = item.GetGeometryRef()
            clipped = intersection(geometry, spatial_filter) if geometry else None
            if clipped is not None and not clipped.IsEmpty():
                results.append(feature_json(geometry, {
                    "layer_id": "place-names", "source": "OpenStreetMap", "source_id": field(item, "osm_id"),
                    "name": name, "name_cy": tags.get("name:cy"), "place": place,
                }))

    lines = datasource.GetLayerByName("lines")
    if lines:
        lines.SetSpatialFilter(spatial_filter)
        for item in readable_features(lines, read_errors):
            tags = osm_tags(item)
            highway = clean(field(item, "highway"))
            if not highway:
                continue
            geometry = item.GetGeometryRef()
            if geometry is None:
                continue
            clipped = intersection(geometry, spatial_filter)
            if clipped is None or clipped.IsEmpty():
                continue
            path_types[highway] += 1
            results.append(feature_json(clipped, {
                "layer_id": "contextual-paths", "source": "OpenStreetMap", "source_id": field(item, "osm_id"),
                "name": field(item, "name"), "name_cy": tags.get("name:cy"), "highway": highway,
                "access": tags.get("access"), "foot": tags.get("foot"), "surface": tags.get("surface"),
                "tracktype": tags.get("tracktype"),
                "limitation": "Context only; not the definitive legal public-rights-of-way record.",
            }))

    multipolygons = datasource.GetLayerByName("multipolygons")
    if multipolygons:
        multipolygons.SetSpatialFilter(spatial_filter)
        for item in readable_features(multipolygons, read_errors):
            tags = osm_tags(item)
            natural = clean(field(item, "natural"))
            landuse = clean(field(item, "landuse"))
            if not natural and not landuse:
                continue
            geometry = item.GetGeometryRef()
            if geometry is None:
                continue
            clipped = intersection(geometry, spatial_filter)
            if clipped is None or clipped.IsEmpty():
                continue
            results.append(feature_json(clipped, {
                "layer_id": "basemap-land", "source": "OpenStreetMap", "source_id": field(item, "osm_id"),
                "name": field(item, "name"), "name_cy": tags.get("name:cy"),
                "natural": natural, "landuse": landuse,
            }))
    return results, path_types, read_errors


def release_aoi(core_path):
    geometry, source_srs = first_geometry(core_path)
    datasource = ogr.Open(core_path)
    feature = datasource.GetLayer(0).GetNextFeature()
    properties = feature.items()
    if properties.get("name") != "BCA-area of interest" or properties.get("version") != "2026-08-21.1":
        raise RuntimeError("Core geometry identity/version does not match the release-two contract")
    british_grid = osr.SpatialReference()
    british_grid.ImportFromEPSG(27700)
    british_grid.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    core_bng = transform_geometry(geometry, source_srs, british_grid)
    if not core_bng.IsValid():
        raise RuntimeError("Core geometry is invalid")
    return core_bng, core_bng.Buffer(2000.0), british_grid, properties


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--core", required=True)
    parser.add_argument("--sssi", required=True)
    parser.add_argument("--park", required=True)
    parser.add_argument("--rivers", required=True)
    parser.add_argument("--habitat", required=True)
    parser.add_argument("--osm", required=True)
    parser.add_argument("--geojson", required=True)
    parser.add_argument("--summary", required=True)
    args = parser.parse_args()

    core, aoi, source_srs, core_properties = release_aoi(args.core)
    target_srs = osr.SpatialReference()
    target_srs.ImportFromEPSG(4326)
    target_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)

    features = [feature_json(
        transform_geometry(core, source_srs, target_srs),
        {
            **core_properties,
            "layer_id": "bca-area-of-interest",
            "source": "Blorenge Commoners Association",
            "public_label": "BCA-area of interest",
            "limitation": "Approximate BCA working area; not the legal, official, surveyed or current CL18 boundary.",
        },
    )]
    features.extend(clipped_features(
        args.sssi, aoi, source_srs, target_srs, "blorenge-sssi", "Natural Resources Wales",
        ["id", "sssi_id", "sssi_code", "sssi_name", "first_notified", "last_notified", "last_edited", "cartesian_area_ha", "status"],
        lambda item: str(field(item, "sssi_code")) == "33WFL",
    ))
    features.extend(clipped_features(
        args.park, aoi, source_srs, target_srs, "bannau-brycheiniog-national-park", "Natural Resources Wales",
        ["id", "objectid", "isis_id", "np_name", "desig_date", "edit_date", "area_ha"],
        lambda item: str(field(item, "isis_id")) == "2449",
    ))
    features.extend(clipped_features(
        args.rivers, aoi, source_srs, target_srs, "principal-watercourses", "Natural Resources Wales",
        ["OBJECTID", "WCRS_REF", "WCRS_NAME", "ALT_NAME", "LENGTH_KM", "GlobalID"],
    ))
    habitat = clipped_features(
        args.habitat, aoi, source_srs, target_srs, "historical-phase1-habitat", "Natural Resources Wales",
        ["objectid", "label", "voronoi_uid", "phase1_code", "survey", "area_ha", "original_unique_id"],
    )
    for item in habitat:
        item["properties"]["limitation"] = "Historical survey; not current habitat condition or ecological recovery."
    features.extend(habitat)
    osm, path_types, osm_read_errors = osm_features_v2(args.osm, aoi, source_srs, target_srs)
    features.extend(osm)

    counts = Counter(item["properties"]["layer_id"] for item in features)
    required_counts = {
        "bca-area-of-interest": 1,
        "blorenge-sssi": 1,
        "bannau-brycheiniog-national-park": 1,
        "principal-watercourses": 1,
        "historical-phase1-habitat": 1,
        "place-names": 1,
        "contextual-paths": 1,
        "basemap-land": 1,
    }
    missing = [
        f"{layer_id} (expected at least {minimum}, found {counts[layer_id]})"
        for layer_id, minimum in required_counts.items()
        if counts[layer_id] < minimum
    ]
    if missing:
        raise RuntimeError("Required factual context is absent: " + "; ".join(missing))

    with open(args.geojson, "x", encoding="utf-8") as handle:
        json.dump({"type": "FeatureCollection", "features": features}, handle, separators=(",", ":"))

    habitat_codes = Counter(item["properties"].get("phase1_code", "unknown") for item in habitat)
    summary = {
        "area_of_interest": {
            "label_en": "BCA-area of interest plus exactly 2 km",
            "label_cy": "Ardal o ddiddordeb BCA ynghyd ag union 2 km",
            "core_label": "BCA-area of interest",
            "core_version": core_properties["version"],
            "buffer_distance_m": 2000,
            "buffer_crs": "EPSG:27700",
            "area_square_metres": round(aoi.GetArea(), 3),
        },
        "layers": [
            {"layer_id": layer_id, "feature_count": count}
            for layer_id, count in sorted(counts.items())
        ],
        "path_types": dict(sorted(path_types.items())),
        "source_qa": {
            "osm_unreadable_feature_count": len(osm_read_errors),
            "osm_unreadable_feature_errors": sorted(set(osm_read_errors)),
        },
        "historical_phase1_codes": dict(sorted(habitat_codes.items())),
        "limitations": [
            "The BCA-area of interest is approximate and is not the legal, official, surveyed or current CL18 boundary.",
            "The Blorenge SSSI remains a separate authoritative protected-site context layer.",
            "OpenStreetMap paths are contextual and do not establish legal public-rights-of-way status.",
            "The Phase 1 habitat survey is historical and does not describe current condition or recovery.",
            "OpenStreetMap records that GDAL cannot parse are omitted and counted in source_qa; valid records remain independently clipped.",
        ],
    }
    with open(args.summary, "x", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2, sort_keys=True)
        handle.write("\n")


if __name__ == "__main__":
    main()
