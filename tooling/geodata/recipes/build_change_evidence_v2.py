#!/usr/bin/env python3

"""Build release-two change evidence without changing the release-one recipe."""

import argparse
import csv
import json
import os
from collections import Counter

import numpy as np
from osgeo import gdal, ogr, osr

gdal.UseExceptions()
ogr.UseExceptions()
osr.UseExceptions()

INVALID_SCL = [0, 1, 2, 3, 8, 9, 10, 11]
NODATA = -9999.0
SCENE_MINIMUM = 95.0
PRODUCT_MINIMUM = 90.0
EFFIS_MINIMUM = 95.0


def first_geometry(path):
    datasource = ogr.Open(path)
    if datasource is None:
        raise RuntimeError(f"Could not open geometry source: {path}")
    layer = datasource.GetLayer(0)
    feature = layer.GetNextFeature()
    if feature is None or feature.GetGeometryRef() is None:
        raise RuntimeError(f"Geometry source has no feature: {path}")
    spatial_ref = layer.GetSpatialRef()
    if spatial_ref is None:
        spatial_ref = osr.SpatialReference()
        spatial_ref.ImportFromEPSG(4326)
    return feature.GetGeometryRef().Clone(), spatial_ref.Clone(), feature.items()


def traditional_axis(spatial_ref):
    spatial_ref.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return spatial_ref


def transform_geometry(geometry, source_srs, target_srs):
    source = traditional_axis(source_srs.Clone())
    target = traditional_axis(target_srs.Clone())
    result = geometry.Clone()
    if not source.IsSame(target):
        result.Transform(osr.CoordinateTransformation(source, target))
    return result


def release_aoi(core_path):
    geometry, source_srs, properties = first_geometry(core_path)
    if properties.get("name") != "BCA-area of interest" or properties.get("version") != "2026-08-21.1":
        raise RuntimeError("Core geometry identity/version does not match the release-two contract")
    british_grid = osr.SpatialReference()
    british_grid.ImportFromEPSG(27700)
    core_bng = transform_geometry(geometry, source_srs, british_grid)
    if not core_bng.IsValid():
        raise RuntimeError("Core geometry is invalid")
    return core_bng.Buffer(2000.0), british_grid, properties


def dilate(mask):
    height, width = mask.shape
    result = mask.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx == 0 and dy == 0:
                continue
            shifted = np.zeros_like(mask)
            sy = slice(max(0, -dy), min(height, height - dy))
            sx = slice(max(0, -dx), min(width, width - dx))
            ty = slice(max(0, dy), min(height, height + dy))
            tx = slice(max(0, dx), min(width, width + dx))
            shifted[ty, tx] = mask[sy, sx]
            result |= shifted
    return result


def reproject_band(path, reference, algorithm, output_type):
    source = gdal.Open(path)
    memory = gdal.GetDriverByName("MEM").Create(
        "", reference.RasterXSize, reference.RasterYSize, 1, output_type
    )
    memory.SetProjection(reference.GetProjection())
    memory.SetGeoTransform(reference.GetGeoTransform())
    gdal.ReprojectImage(source, memory, source.GetProjection(), reference.GetProjection(), algorithm)
    return source, memory.GetRasterBand(1).ReadAsArray()


def read_scaled(path, reference):
    source, values = reproject_band(path, reference, gdal.GRA_Bilinear, gdal.GDT_Float32)
    values = values.astype(np.float32)
    band = source.GetRasterBand(1)
    scale = band.GetScale() if band.GetScale() is not None else 0.0001
    offset = band.GetOffset() if band.GetOffset() is not None else -0.1
    return values * scale + offset


def rasterize(reference, geometry, source_srs):
    target_srs = osr.SpatialReference()
    target_srs.ImportFromWkt(reference.GetProjection())
    transformed = transform_geometry(geometry, source_srs, target_srs)
    memory = gdal.GetDriverByName("MEM").Create(
        "", reference.RasterXSize, reference.RasterYSize, 1, gdal.GDT_Byte
    )
    memory.SetProjection(reference.GetProjection())
    memory.SetGeoTransform(reference.GetGeoTransform())
    vector_memory = ogr.GetDriverByName("Memory").CreateDataSource("")
    layer = vector_memory.CreateLayer("mask", target_srs, geom_type=transformed.GetGeometryType())
    feature = ogr.Feature(layer.GetLayerDefn())
    feature.SetGeometry(transformed)
    layer.CreateFeature(feature)
    gdal.RasterizeLayer(memory, [1], layer, burn_values=[1])
    return memory.GetRasterBand(1).ReadAsArray().astype(bool)


def quality_mask(scl_path, reference, aoi_mask):
    source = gdal.Open(scl_path)
    invalid = dilate(np.isin(source.GetRasterBand(1).ReadAsArray(), INVALID_SCL))
    native = gdal.GetDriverByName("MEM").Create(
        "", source.RasterXSize, source.RasterYSize, 1, gdal.GDT_Byte
    )
    native.SetProjection(source.GetProjection())
    native.SetGeoTransform(source.GetGeoTransform())
    native.GetRasterBand(1).WriteArray(invalid.astype(np.uint8))
    target = gdal.GetDriverByName("MEM").Create(
        "", reference.RasterXSize, reference.RasterYSize, 1, gdal.GDT_Byte
    )
    target.SetProjection(reference.GetProjection())
    target.SetGeoTransform(reference.GetGeoTransform())
    gdal.ReprojectImage(native, target, native.GetProjection(), reference.GetProjection(), gdal.GRA_NearestNeighbour)
    return target.GetRasterBand(1).ReadAsArray().astype(bool) | ~aoi_mask


def ratio(high, low):
    return np.divide(high - low, high + low, out=np.zeros_like(high), where=np.abs(high + low) > 1e-6)


def scene_values(paths, reference, aoi_mask):
    red, nir10, nir20, swir1, swir2, scl = paths
    invalid = quality_mask(scl, reference, aoi_mask)
    values = {
        "red": read_scaled(red, reference),
        "nir10": read_scaled(nir10, reference),
        "nir20": read_scaled(nir20, reference),
        "swir1": read_scaled(swir1, reference),
        "swir2": read_scaled(swir2, reference),
        "invalid": invalid,
    }
    return values


def percentage(mask, denominator):
    return round(float(mask.sum()) * 100.0 / float(max(1, denominator.sum())), 3)


def serialise(values):
    output = values.astype(np.float32).copy()
    output[~np.isfinite(output)] = NODATA
    return output


def write_cog(path, reference, bands, descriptions):
    temporary = f"{path}.working.tif"
    dataset = gdal.GetDriverByName("GTiff").Create(
        temporary,
        reference.RasterXSize,
        reference.RasterYSize,
        len(bands),
        gdal.GDT_Float32,
        options=["TILED=YES", "COMPRESS=ZSTD", "BIGTIFF=IF_SAFER"],
    )
    dataset.SetProjection(reference.GetProjection())
    dataset.SetGeoTransform(reference.GetGeoTransform())
    for index, (values, description) in enumerate(zip(bands, descriptions), start=1):
        band = dataset.GetRasterBand(index)
        band.WriteArray(serialise(values))
        band.SetDescription(description)
        band.SetNoDataValue(NODATA)
    dataset = None
    gdal.Translate(path, temporary, format="COG", creationOptions=["COMPRESS=ZSTD", "BIGTIFF=IF_SAFER", "OVERVIEWS=AUTO"])
    os.unlink(temporary)


def component_summary(product, values, observed, domain, reference, dates, formula, bands):
    transform = reference.GetGeoTransform()
    pixel_area_ha = abs(transform[1] * transform[5]) / 10000.0
    finite = values[observed]
    edges = [-np.inf, -0.5, -0.25, -0.1, 0.0, 0.1, 0.25, 0.5, np.inf]
    labels = ["below_-0.50", "-0.50_to_-0.25", "-0.25_to_-0.10", "-0.10_to_0", "0_to_+0.10", "+0.10_to_+0.25", "+0.25_to_+0.50", "above_+0.50"]
    counts, _ = np.histogram(finite, bins=edges)
    bins = [
        {"bin": label, "pixel_count": int(count), "area_ha": round(float(count) * pixel_area_ha, 3)}
        for label, count in zip(labels, counts)
    ]
    return {
        "product": product,
        "formula": formula,
        "bands": bands,
        "dates": dates,
        "units": "index points",
        "resolution_m": abs(transform[1]),
        "render_scale": {"minimum": -0.5, "maximum": 0.5, "stored_values_are_clamped": False},
        "observed_pixels": int(observed.sum()),
        "not_observed_pixels": int((domain & ~observed).sum()),
        "observed_area_ha": round(float(observed.sum()) * pixel_area_ha, 3),
        "not_observed_area_ha": round(float((domain & ~observed).sum()) * pixel_area_ha, 3),
        "minimum": float(np.min(finite)),
        "maximum": float(np.max(finite)),
        "percentiles": {str(value): float(np.percentile(finite, value)) for value in [5, 25, 50, 75, 95]},
        "bins": bins,
        "limitations": [
            "The signed difference does not establish cause, fire damage, severity, habitat condition, recovery, dryness or wetness.",
            "Rainfall, phenology, grazing, management and residual observation effects may contribute.",
            "Pixels failing either date's quality mask are Not observed, not zero change.",
        ],
    }


def write_component(summary, json_path, csv_path):
    with open(json_path, "x", encoding="utf-8") as handle:
        json.dump(summary, handle, separators=(",", ":"))
    with open(csv_path, "x", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["product", "bin", "pixel_count", "area_ha", "units", "baseline_date", "comparison_date"])
        for row in summary["bins"]:
            writer.writerow([summary["product"], row["bin"], row["pixel_count"], row["area_ha"], summary["units"], summary["dates"][0], summary["dates"][1]])


def load_effis(path):
    datasource = ogr.Open(path)
    layer = datasource.GetLayer(0)
    for feature in layer:
        if str(feature.GetField("id")) == "592404":
            return feature.GetGeometryRef().Clone(), layer.GetSpatialRef().Clone(), feature.items()
    raise RuntimeError("EFFIS feature 592404 was not present in the controlled snapshot")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--core", required=True)
    parser.add_argument("--baseline", nargs=6, required=True, metavar=("RED", "NIR10", "NIR20", "SWIR1", "SWIR2", "SCL"))
    parser.add_argument("--prefire", nargs=6, required=True, metavar=("RED", "NIR10", "NIR20", "SWIR1", "SWIR2", "SCL"))
    parser.add_argument("--post", nargs=6, required=True, metavar=("RED", "NIR10", "NIR20", "SWIR1", "SWIR2", "SCL"))
    parser.add_argument("--effis", required=True)
    parser.add_argument("--combined-cog", required=True)
    parser.add_argument("--ndvi-cog", required=True)
    parser.add_argument("--ndmi-cog", required=True)
    parser.add_argument("--effis-out", required=True)
    parser.add_argument("--combined-csv", required=True)
    parser.add_argument("--ndvi-csv", required=True)
    parser.add_argument("--ndvi-json", required=True)
    parser.add_argument("--ndmi-csv", required=True)
    parser.add_argument("--ndmi-json", required=True)
    parser.add_argument("--summary", required=True)
    args = parser.parse_args()

    aoi, aoi_srs, core_properties = release_aoi(args.core)
    reference20 = gdal.Open(args.post[3])
    reference10 = gdal.Open(args.post[0])
    aoi20 = rasterize(reference20, aoi, aoi_srs)
    aoi10 = rasterize(reference10, aoi, aoi_srs)
    roles = [("seasonal_baseline", "2025-07-12", args.baseline), ("before_first_report", "2026-07-12", args.prefire), ("comparison", "2026-08-11", args.post)]
    scenes20 = [(role, date, scene_values(paths, reference20, aoi20)) for role, date, paths in roles]
    scenes10 = [(role, date, scene_values(paths, reference10, aoi10)) for role, date, paths in roles]

    observations = []
    for (role, date, values20), (_, _, values10) in zip(scenes20, scenes10):
        valid20 = ~values20["invalid"] & aoi20
        valid10 = ~values10["invalid"] & aoi10
        valid_percent = min(percentage(valid20, aoi20), percentage(valid10, aoi10))
        observations.append({"role": role, "date": date, "valid_aoi_percent": valid_percent})
    failed_scenes = [item for item in observations if item["valid_aoi_percent"] < SCENE_MINIMUM]
    if failed_scenes:
        raise RuntimeError(f"Scene validity gate failed; reselection decision required: {failed_scenes}")

    baseline20, prefire20, post20 = [item[2] for item in scenes20]
    baseline10, _, post10 = [item[2] for item in scenes10]
    comparable20 = ~baseline20["invalid"] & ~prefire20["invalid"] & ~post20["invalid"] & aoi20
    comparable_ndmi = ~baseline20["invalid"] & ~post20["invalid"] & aoi20
    comparable_ndvi = ~baseline10["invalid"] & ~post10["invalid"] & aoi10

    ndvi_baseline = ratio(baseline10["nir10"], baseline10["red"])
    ndvi_post = ratio(post10["nir10"], post10["red"])
    delta_ndvi = ndvi_post - ndvi_baseline
    delta_ndvi[~comparable_ndvi] = np.nan
    ndmi_baseline = ratio(baseline20["nir20"], baseline20["swir1"])
    ndmi_post = ratio(post20["nir20"], post20["swir1"])
    delta_ndmi = ndmi_post - ndmi_baseline
    delta_ndmi[~comparable_ndmi] = np.nan

    ndvi20_baseline = ratio(baseline20["nir20"], baseline20["red"])
    ndvi20_post = ratio(post20["nir20"], post20["red"])
    nbr_prefire = ratio(prefire20["nir20"], prefire20["swir2"])
    nbr_post = ratio(post20["nir20"], post20["swir2"])
    combined_dnbr = nbr_prefire - nbr_post
    combined_dndvi = ndvi20_post - ndvi20_baseline
    combined_dndmi = delta_ndmi.copy()
    for values in [combined_dnbr, combined_dndvi, combined_dndmi]:
        values[~comparable20] = np.nan

    evidence_state = np.zeros_like(combined_dnbr, dtype=np.float32)
    observed_change = comparable20 & (combined_dnbr > 0.10) & (combined_dndvi < -0.08)
    higher = observed_change & (combined_dndmi < -0.05)
    evidence_state[comparable20] = 1
    evidence_state[observed_change & ~higher] = 2
    evidence_state[higher] = 3
    observation_count = np.zeros_like(combined_dnbr, dtype=np.float32)
    observation_count[comparable20] = 3
    evidence_state[~aoi20] = np.nan
    observation_count[~aoi20] = np.nan

    coverage = {
        "ndvi_comparable_percent": percentage(comparable_ndvi, aoi10),
        "ndmi_comparable_percent": percentage(comparable_ndmi, aoi20),
        "combined_comparable_percent": percentage(comparable20, aoi20),
    }
    if min(coverage.values()) < PRODUCT_MINIMUM:
        raise RuntimeError(f"Product comparability gate failed; reselection decision required: {coverage}")

    effis_geometry, effis_srs, effis_properties = load_effis(args.effis)
    effis20 = rasterize(reference20, effis_geometry, effis_srs) & aoi20
    coverage["effis_combined_comparable_percent"] = percentage(comparable20 & effis20, effis20)
    if coverage["effis_combined_comparable_percent"] < EFFIS_MINIMUM:
        raise RuntimeError(f"EFFIS comparability gate failed; reselection decision required: {coverage}")

    write_cog(args.combined_cog, reference20, [combined_dnbr, combined_dndvi, combined_dndmi, evidence_state, observation_count], ["dNBR", "delta_NDVI", "delta_NDMI", "evidence_state", "observation_count"])
    write_cog(args.ndvi_cog, reference10, [delta_ndvi], ["delta_NDVI"])
    write_cog(args.ndmi_cog, reference20, [delta_ndmi], ["delta_NDMI"])

    dates = ["2025-07-12", "2026-08-11"]
    ndvi_summary = component_summary("NDVI", delta_ndvi, comparable_ndvi, aoi10, reference10, dates, "(B8 - B4) / (B8 + B4)", ["B8", "B4"])
    ndmi_summary = component_summary("NDMI", delta_ndmi, comparable_ndmi, aoi20, reference20, dates, "(B8A - B11) / (B8A + B11)", ["B8A", "B11"])
    write_component(ndvi_summary, args.ndvi_json, args.ndvi_csv)
    write_component(ndmi_summary, args.ndmi_json, args.ndmi_csv)

    transform = reference20.GetGeoTransform()
    pixel_area_ha = abs(transform[1] * transform[5]) / 10000.0
    counts = Counter(evidence_state[aoi20].astype(int).tolist())
    state_rows = [("not_observed", int(aoi20.sum()) - int(comparable20.sum())), ("observed_no_thresholded_change", counts[1]), ("lower_confidence_observed_change", counts[2]), ("higher_confidence_observed_change", counts[3])]
    with open(args.combined_csv, "x", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["evidence_state", "pixel_count", "area_ha_rounded"])
        for label, count in state_rows:
            writer.writerow([label, count, round(count * pixel_area_ha)])

    wgs84 = osr.SpatialReference()
    wgs84.ImportFromEPSG(4326)
    effis_wgs84 = transform_geometry(effis_geometry, effis_srs, wgs84)
    effis_feature = {
        "type": "Feature",
        "properties": {**effis_properties, "layer_id": "effis-provisional-boundary", "provider_feature_id": "592404", "classification": "provisional_provider", "provider": "European Union, Copernicus EFFIS", "limitation": "Not an authority, legal or surveyed perimeter; provider dates are not authority incident times."},
        "geometry": json.loads(effis_wgs84.ExportToJson()),
    }
    with open(args.effis_out, "x", encoding="utf-8") as handle:
        json.dump({"type": "FeatureCollection", "features": [effis_feature]}, handle, separators=(",", ":"))

    report = {
        "spatial_contract": {"core_label": core_properties["name"], "core_version": core_properties["version"], "buffer_distance_m": 2000, "buffer_crs": "EPSG:27700", "clip_mode": "exact"},
        "observations": {item["role"]: item for item in observations},
        "coverage": coverage,
        "quality_thresholds": {"scene_valid_percent_min": SCENE_MINIMUM, "product_comparable_percent_min": PRODUCT_MINIMUM, "effis_comparable_percent_min": EFFIS_MINIMUM},
        "mask": {"invalid_scl_classes": INVALID_SCL, "dilation_native_pixels": 1, "dilation_m": 20},
        "combined_thresholds": {"dNBR": "> 0.10", "delta_NDVI": "< -0.08", "delta_NDMI_higher_confidence": "< -0.05"},
        "components": {"ndvi": ndvi_summary, "ndmi": ndmi_summary},
    }
    with open(args.summary, "x", encoding="utf-8") as handle:
        json.dump(report, handle, separators=(",", ":"))


if __name__ == "__main__":
    main()
