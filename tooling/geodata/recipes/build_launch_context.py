#!/usr/bin/env python3

import argparse
import json
import re
from collections import Counter
from osgeo import ogr, osr

ogr.UseExceptions()
osr.UseExceptions()


def field(feature, name):
    index = feature.GetFieldIndex(name)
    return feature.GetField(index) if index >= 0 else None


def clean(value):
    return value.strip() if isinstance(value, str) else value


def traditional_gis(srs):
    result = srs.Clone()
    result.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return result


def osm_tags(feature):
    """Parse GDAL's OSM `other_tags` hstore without exposing unreviewed keys."""
    raw = field(feature, "other_tags") or ""
    pairs = re.findall(r'"((?:[^"\\]|\\.)*)"=>"((?:[^"\\]|\\.)*)"', raw)

    def unescape(value):
        return re.sub(r"\\(.)", r"\1", value)

    return {unescape(key): unescape(value) for key, value in pairs}


def transform_geometry(geometry, source_srs, target_srs):
    result = geometry.Clone()
    result.Transform(osr.CoordinateTransformation(
        traditional_gis(source_srs), traditional_gis(target_srs)
    ))
    return result


def feature_json(geometry, properties):
    return {
        "type": "Feature",
        "properties": {key: clean(value) for key, value in properties.items() if value not in (None, "")},
        "geometry": json.loads(geometry.ExportToJson()),
    }


def intersection(geometry, clip):
    try:
        left = geometry if geometry.IsValid() else geometry.MakeValid()
        right = clip if clip.IsValid() else clip.MakeValid()
        return left.Intersection(right)
    except RuntimeError:
        return None


def first_geometry(path):
    datasource = ogr.Open(path)
    layer = datasource.GetLayer(0)
    feature = layer.GetNextFeature()
    return feature.GetGeometryRef().Clone(), layer.GetSpatialRef().Clone()


def clipped_features(path, aoi, aoi_srs, target_srs, layer_id, source, allowlist, selector=None):
    datasource = ogr.Open(path)
    layer = datasource.GetLayer(0)
    source_srs = layer.GetSpatialRef() or aoi_srs
    clip = transform_geometry(aoi, aoi_srs, source_srs)
    layer.SetSpatialFilter(clip)
    results = []
    for item in layer:
        if selector and not selector(item):
            continue
        geometry = item.GetGeometryRef()
        if geometry is None:
            continue
        clipped = intersection(geometry, clip)
        if clipped is None or clipped.IsEmpty():
            continue
        properties = {name: field(item, name) for name in allowlist}
        properties.update({"layer_id": layer_id, "source": source})
        results.append(feature_json(transform_geometry(clipped, source_srs, target_srs), properties))
    return results


def osm_features(path, aoi, aoi_srs, target_srs):
    datasource = ogr.Open(path)
    spatial_filter = transform_geometry(aoi, aoi_srs, target_srs)
    results = []
    path_types = Counter()

    points = datasource.GetLayerByName("points")
    if points:
        points.SetSpatialFilter(spatial_filter)
        for item in points:
            tags = osm_tags(item)
            place = clean(field(item, "place"))
            name = clean(field(item, "name"))
            if not place or not name:
                continue
            geometry = item.GetGeometryRef()
            clipped = intersection(geometry, spatial_filter) if geometry else None
            if clipped is not None and not clipped.IsEmpty():
                results.append(feature_json(geometry, {
                    "layer_id": "place-names",
                    "source": "OpenStreetMap",
                    "source_id": field(item, "osm_id"),
                    "name": name,
                    "name_cy": tags.get("name:cy"),
                    "place": place,
                }))

    lines = datasource.GetLayerByName("lines")
    if lines:
        lines.SetSpatialFilter(spatial_filter)
        for item in lines:
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
                "layer_id": "contextual-paths",
                "source": "OpenStreetMap",
                "source_id": field(item, "osm_id"),
                "name": field(item, "name"),
                "name_cy": tags.get("name:cy"),
                "highway": highway,
                "access": tags.get("access"),
                "foot": tags.get("foot"),
                "surface": tags.get("surface"),
                "tracktype": tags.get("tracktype"),
                "limitation": "Context only; not the definitive legal public-rights-of-way record.",
            }))

    multipolygons = datasource.GetLayerByName("multipolygons")
    if multipolygons:
        multipolygons.SetSpatialFilter(spatial_filter)
        for item in multipolygons:
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
                "layer_id": "basemap-land",
                "source": "OpenStreetMap",
                "source_id": field(item, "osm_id"),
                "name": field(item, "name"),
                "name_cy": tags.get("name:cy"),
                "natural": natural,
                "landuse": landuse,
            }))
    return results, path_types


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sssi", required=True)
    parser.add_argument("--park", required=True)
    parser.add_argument("--rivers", required=True)
    parser.add_argument("--habitat", required=True)
    parser.add_argument("--osm", required=True)
    parser.add_argument("--geojson", required=True)
    parser.add_argument("--summary", required=True)
    args = parser.parse_args()

    sssi_geometry, source_srs = first_geometry(args.sssi)
    aoi = sssi_geometry.Buffer(2000)
    target_srs = osr.SpatialReference()
    target_srs.ImportFromEPSG(4326)
    target_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)

    features = []
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
    osm, path_types = osm_features(args.osm, aoi, source_srs, target_srs)
    features.extend(osm)

    counts = Counter(item["properties"]["layer_id"] for item in features)
    required_counts = {
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
        "area_of_interest": "Blorenge SSSI NRW_SSSI.13108 buffered by exactly 2000 metres in EPSG:27700",
        "layers": [
            {"layer_id": layer_id, "feature_count": count}
            for layer_id, count in sorted(counts.items())
        ],
        "path_types": dict(sorted(path_types.items())),
        "historical_phase1_codes": dict(sorted(habitat_codes.items())),
        "limitations": [
            "The SSSI boundary is not the legal Blorenge Common CL18 boundary.",
            "OpenStreetMap paths are contextual and do not establish legal public-rights-of-way status.",
            "The Phase 1 habitat survey is historical and does not describe current condition or recovery.",
        ],
    }
    with open(args.summary, "x", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2, sort_keys=True)
        handle.write("\n")


if __name__ == "__main__":
    main()
