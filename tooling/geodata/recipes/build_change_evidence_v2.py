#!/usr/bin/env python3

"""Build release-two change evidence without changing the release-one recipe."""

import argparse
import csv
import hashlib
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
EFFIS_HISTORIC_RESPONSE_SHA256 = "651b441769bd485c5f45e48fefb777084c08b059be4eee61c9ecf122e03c3e6a"
EFFIS_CURRENT_RESPONSE_SHA256 = "ad5e648111a6e8803e9f159463d65ecda66976783868f1b798c45d3d0f854778"


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


def composite_scene(primary_paths, fill_paths, reference, aoi_mask):
    primary = scene_values(primary_paths, reference, aoi_mask)
    fill = scene_values(fill_paths, reference, aoi_mask)
    use_primary = ~primary["invalid"] & aoi_mask
    use_fill = primary["invalid"] & ~fill["invalid"] & aoi_mask
    values = {
        band: np.where(use_primary, primary[band], fill[band])
        for band in ["red", "nir10", "nir20", "swir1", "swir2"]
    }
    values["invalid"] = primary["invalid"] & fill["invalid"]
    source_date = np.zeros(aoi_mask.shape, dtype=np.uint32)
    source_date[use_primary] = 20260729
    source_date[use_fill] = 20260811
    return values, source_date


def percentage(mask, denominator):
    return round(float(mask.sum()) * 100.0 / float(max(1, denominator.sum())), 3)


def serialise(values):
    output = values.astype(np.float32).copy()
    output[~np.isfinite(output)] = NODATA
    return output


def write_cog(path, reference, bands, descriptions, domain):
    rows, columns = np.where(domain)
    if rows.size == 0 or columns.size == 0:
        raise RuntimeError("Output domain is empty")
    row_start, row_stop = int(rows.min()), int(rows.max()) + 1
    column_start, column_stop = int(columns.min()), int(columns.max()) + 1
    transform = reference.GetGeoTransform()
    cropped_transform = (
        transform[0] + column_start * transform[1] + row_start * transform[2],
        transform[1],
        transform[2],
        transform[3] + column_start * transform[4] + row_start * transform[5],
        transform[4],
        transform[5],
    )
    temporary = f"{path}.working.tif"
    dataset = gdal.GetDriverByName("GTiff").Create(
        temporary,
        column_stop - column_start,
        row_stop - row_start,
        len(bands),
        gdal.GDT_Float32,
        options=["TILED=YES", "COMPRESS=ZSTD", "BIGTIFF=IF_SAFER"],
    )
    dataset.SetProjection(reference.GetProjection())
    dataset.SetGeoTransform(cropped_transform)
    for index, (values, description) in enumerate(zip(bands, descriptions), start=1):
        band = dataset.GetRasterBand(index)
        band.WriteArray(serialise(values[row_start:row_stop, column_start:column_stop]))
        band.SetDescription(description)
        band.SetNoDataValue(NODATA)
    dataset = None
    gdal.Translate(path, temporary, format="COG", creationOptions=["COMPRESS=ZSTD", "BIGTIFF=IF_SAFER", "OVERVIEWS=AUTO"])
    os.unlink(temporary)


def write_source_date_cog(path, reference, source_date, domain):
    rows, columns = np.where(domain)
    if rows.size == 0 or columns.size == 0:
        raise RuntimeError("Source-date provenance domain is empty")
    row_start, row_stop = int(rows.min()), int(rows.max()) + 1
    column_start, column_stop = int(columns.min()), int(columns.max()) + 1
    transform = reference.GetGeoTransform()
    cropped_transform = (
        transform[0] + column_start * transform[1] + row_start * transform[2],
        transform[1],
        transform[2],
        transform[3] + column_start * transform[4] + row_start * transform[5],
        transform[4],
        transform[5],
    )
    temporary = f"{path}.working.tif"
    dataset = gdal.GetDriverByName("GTiff").Create(
        temporary,
        column_stop - column_start,
        row_stop - row_start,
        1,
        gdal.GDT_UInt32,
        options=["TILED=YES", "COMPRESS=ZSTD"],
    )
    dataset.SetProjection(reference.GetProjection())
    dataset.SetGeoTransform(cropped_transform)
    band = dataset.GetRasterBand(1)
    band.WriteArray(source_date[row_start:row_stop, column_start:column_stop])
    band.SetDescription("post_source_date")
    band.SetNoDataValue(0)
    dataset = None
    gdal.Translate(path, temporary, format="COG", creationOptions=["COMPRESS=ZSTD", "OVERVIEWS=AUTO", "RESAMPLING=NEAREST"])
    os.unlink(temporary)


def source_date_summary(source_date, domain, reference):
    transform = reference.GetGeoTransform()
    pixel_area_ha = abs(transform[1] * transform[5]) / 10000.0
    counts = Counter(source_date[domain].tolist())
    total = int(domain.sum())
    return {
        "encoding": {
            "0": "Not observed",
            "20260729": "2026-07-29 earliest valid post-report source",
            "20260811": "2026-08-11 invalid-pixel fill source",
        },
        "pixel_counts": {
            "2026-07-29": counts[20260729],
            "2026-08-11": counts[20260811],
            "not_observed": counts[0],
        },
        "area_ha": {
            "2026-07-29": round(counts[20260729] * pixel_area_ha, 3),
            "2026-08-11": round(counts[20260811] * pixel_area_ha, 3),
            "not_observed": round(counts[0] * pixel_area_ha, 3),
        },
        "coverage_percent": {
            "2026-07-29": round(counts[20260729] * 100.0 / total, 3),
            "2026-08-11": round(counts[20260811] * 100.0 / total, 3),
            "not_observed": round(counts[0] * 100.0 / total, 3),
        },
    }


def component_summary(product, values, observed, domain, reference, dates, formula, bands, provenance):
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
    names = {
        "NDVI": {
            "en": "Vegetation greenness index change (NDVI)",
            "cy": "Newid mynegai gwyrddni llystyfiant (NDVI)",
        },
        "NDMI": {
            "en": "Moisture-sensitive index change (NDMI)",
            "cy": "Newid mynegai sy’n sensitif i leithder (NDMI)",
        },
    }
    colours = {
        "NDVI": ["#762A83", "#AF8DC3", "#E7D4E8", "#F7F7F7", "#D9F0D3", "#7FBF7B", "#1B7837"],
        "NDMI": ["#8C510A", "#D8B365", "#F6E8C3", "#F5F5F5", "#C7EAE5", "#5AB4AC", "#01665E"],
    }
    return {
        "product": product,
        "names": names[product],
        "formula": formula,
        "bands": bands,
        "dates": dates,
        "comparison_observation": {
            "label": "2026-07-29/2026-08-11 narrow same-season post-report composite",
            "selection": "Use 2026-07-29 where independently valid, otherwise 2026-08-11 where independently valid, otherwise Not observed.",
            "source_date_provenance": provenance,
        },
        "units": "index points",
        "resolution_m": abs(transform[1]),
        "render_scale": {
            "stops": [-0.5, -0.25, -0.1, 0.0, 0.1, 0.25, 0.5],
            "colours": colours[product],
            "stored_values_are_clamped": False,
            "not_observed": "labelled grey hatch",
        },
        "observed_pixels": int(observed.sum()),
        "not_observed_pixels": int((domain & ~observed).sum()),
        "observed_area_ha": round(float(observed.sum()) * pixel_area_ha, 3),
        "not_observed_area_ha": round(float((domain & ~observed).sum()) * pixel_area_ha, 3),
        "minimum": float(np.min(finite)),
        "maximum": float(np.max(finite)),
        "percentiles": {str(value): float(np.percentile(finite, value)) for value in [5, 25, 50, 75, 95]},
        "bins": bins,
        "attribution": "Contains modified Copernicus Sentinel data 2025–2026; processing by Blorenge Commoners Association.",
        "limitations": [
            "The signed difference does not establish cause, fire damage, severity, habitat condition, recovery, dryness or wetness.",
            "Rainfall, phenology, grazing, management and residual observation effects may contribute.",
            "Pixels failing the baseline mask or both independently applied post-date masks are Not observed, not zero change.",
        ],
    }


def write_component(summary, json_path, csv_path):
    with open(json_path, "x", encoding="utf-8") as handle:
        json.dump(summary, handle, separators=(",", ":"))
    with open(csv_path, "x", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["product", "bin", "pixel_count", "area_ha", "units", "baseline_date", "comparison_date"])
        for row in summary["bins"]:
            writer.writerow([summary["product"], row["bin"], row["pixel_count"], row["area_ha"], summary["units"], summary["dates"][0], summary["comparison_observation"]["label"]])


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_effis(path, feature_id):
    datasource = ogr.Open(path)
    if datasource is None:
        raise RuntimeError(f"Could not open EFFIS snapshot: {path}")
    layer = datasource.GetLayer(0)
    for feature in layer:
        if str(feature.GetField("id")) == feature_id:
            spatial_ref = layer.GetSpatialRef()
            if spatial_ref is None:
                spatial_ref = osr.SpatialReference()
                spatial_ref.ImportFromEPSG(4326)
            return feature.GetGeometryRef().Clone(), spatial_ref.Clone(), feature.items()
    raise RuntimeError(f"EFFIS feature {feature_id} was not present in the controlled snapshot")


def effis_feature_ids(path):
    datasource = ogr.Open(path)
    if datasource is None:
        raise RuntimeError(f"Could not open EFFIS snapshot: {path}")
    return {str(feature.GetField("id")) for feature in datasource.GetLayer(0)}


def geometry_sha256(geometry):
    return hashlib.sha256(bytes(geometry.ExportToWkb())).hexdigest()


def validate_effis_corroboration(current_path, historic_geometry, historic_properties):
    if sha256_file(current_path) != EFFIS_CURRENT_RESPONSE_SHA256:
        raise RuntimeError("Current EFFIS corroborating response does not match the reviewed checksum")
    feature_ids = effis_feature_ids(current_path)
    if "592404" in feature_ids or not {"627416", "627417"}.issubset(feature_ids):
        raise RuntimeError("Current EFFIS response no longer has the reviewed disappearance, corroboration and exclusion identities")
    current_geometry, _, current_properties = load_effis(current_path, "627416")
    changed = sorted(
        key for key in set(historic_properties) | set(current_properties)
        if historic_properties.get(key) != current_properties.get(key)
    )
    if changed != ["CLASS", "LASTUPDATE", "id"]:
        raise RuntimeError(f"EFFIS 627416 differs from historic 592404 in unreviewed fields: {changed}")
    historic_geometry_sha256 = geometry_sha256(historic_geometry)
    current_geometry_sha256 = geometry_sha256(current_geometry)
    if current_geometry_sha256 != historic_geometry_sha256:
        raise RuntimeError("EFFIS 627416 geometry is not coordinate-identical to historic 592404")
    return {
        "provider_feature_id": "627416",
        "relationship": "BCA-inferred-rekey",
        "provider_crosswalk_available": False,
        "retrieved_at": "2026-08-21T21:32:07.885Z",
        "response_sha256": EFFIS_CURRENT_RESPONSE_SHA256,
        "provider_area_ha": current_properties.get("AREA_HA"),
        "provider_lastupdate": current_properties.get("LASTUPDATE"),
        "geometry_sha256": current_geometry_sha256,
        "changed_attributes": changed,
        "excluded_feature_ids": ["627417"],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--core", required=True)
    parser.add_argument("--baseline", nargs=6, required=True, metavar=("RED", "NIR10", "NIR20", "SWIR1", "SWIR2", "SCL"))
    parser.add_argument("--prefire", nargs=6, required=True, metavar=("RED", "NIR10", "NIR20", "SWIR1", "SWIR2", "SCL"))
    parser.add_argument("--post-primary", nargs=6, required=True, metavar=("RED", "NIR10", "NIR20", "SWIR1", "SWIR2", "SCL"))
    parser.add_argument("--post-fill", nargs=6, required=True, metavar=("RED", "NIR10", "NIR20", "SWIR1", "SWIR2", "SCL"))
    parser.add_argument("--effis", required=True)
    parser.add_argument("--current-effis", required=True)
    parser.add_argument("--combined-cog", required=True)
    parser.add_argument("--ndvi-cog", required=True)
    parser.add_argument("--ndmi-cog", required=True)
    parser.add_argument("--post-provenance-10m", required=True)
    parser.add_argument("--post-provenance-20m", required=True)
    parser.add_argument("--effis-out", required=True)
    parser.add_argument("--effis-summary", required=True)
    parser.add_argument("--combined-csv", required=True)
    parser.add_argument("--ndvi-csv", required=True)
    parser.add_argument("--ndvi-json", required=True)
    parser.add_argument("--ndmi-csv", required=True)
    parser.add_argument("--ndmi-json", required=True)
    parser.add_argument("--summary", required=True)
    args = parser.parse_args()

    aoi, aoi_srs, core_properties = release_aoi(args.core)
    reference20 = gdal.Open(args.post_fill[3])
    reference10 = gdal.Open(args.post_fill[0])
    aoi20 = rasterize(reference20, aoi, aoi_srs)
    aoi10 = rasterize(reference10, aoi, aoi_srs)
    baseline20 = scene_values(args.baseline, reference20, aoi20)
    prefire20 = scene_values(args.prefire, reference20, aoi20)
    post20, post_source_date20 = composite_scene(args.post_primary, args.post_fill, reference20, aoi20)
    baseline10 = scene_values(args.baseline, reference10, aoi10)
    prefire10 = scene_values(args.prefire, reference10, aoi10)
    post10, post_source_date10 = composite_scene(args.post_primary, args.post_fill, reference10, aoi10)
    roles = [
        ("seasonal_baseline", "2025-07-12", baseline20, baseline10),
        ("before_first_report", "2026-07-12", prefire20, prefire10),
        ("first_suitable_after_report", "2026-07-29/2026-08-11", post20, post10),
    ]

    observations = []
    for role, date, values20, values10 in roles:
        valid20 = ~values20["invalid"] & aoi20
        valid10 = ~values10["invalid"] & aoi10
        valid_percent = min(percentage(valid20, aoi20), percentage(valid10, aoi10))
        observation = {"role": role, "date": date, "valid_aoi_percent": valid_percent}
        if role == "first_suitable_after_report":
            observation.update({
                "observation_type": "narrow_same_season_composite",
                "label": "2026-07-29/2026-08-11 narrow same-season post-report composite",
                "selection_order": ["2026-07-29", "2026-08-11"],
                "source_date_provenance": {
                    "10m": source_date_summary(post_source_date10, aoi10, reference10),
                    "20m": source_date_summary(post_source_date20, aoi20, reference20),
                },
            })
        observations.append(observation)
    failed_scenes = [item for item in observations if item["valid_aoi_percent"] < SCENE_MINIMUM]
    if failed_scenes:
        raise RuntimeError(f"Scene validity gate failed; reselection decision required: {failed_scenes}")

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

    if sha256_file(args.effis) != EFFIS_HISTORIC_RESPONSE_SHA256:
        raise RuntimeError("Historic EFFIS provider evidence does not match the reviewed release-one checksum")
    effis_geometry, effis_srs, effis_properties = load_effis(args.effis, "592404")
    effis_corroboration = validate_effis_corroboration(args.current_effis, effis_geometry, effis_properties)
    effis20 = rasterize(reference20, effis_geometry, effis_srs) & aoi20
    coverage["effis_combined_comparable_percent"] = percentage(comparable20 & effis20, effis20)
    if coverage["effis_combined_comparable_percent"] < EFFIS_MINIMUM:
        raise RuntimeError(f"EFFIS comparability gate failed; reselection decision required: {coverage}")

    write_cog(args.combined_cog, reference20, [combined_dnbr, combined_dndvi, combined_dndmi, evidence_state, observation_count], ["dNBR", "delta_NDVI", "delta_NDMI", "evidence_state", "observation_count"], aoi20)
    write_cog(args.ndvi_cog, reference10, [delta_ndvi], ["delta_NDVI"], aoi10)
    write_cog(args.ndmi_cog, reference20, [delta_ndmi], ["delta_NDMI"], aoi20)
    write_source_date_cog(args.post_provenance_10m, reference10, post_source_date10, aoi10)
    write_source_date_cog(args.post_provenance_20m, reference20, post_source_date20, aoi20)

    dates = ["2025-07-12", "2026-07-29", "2026-08-11"]
    post_provenance10 = observations[2]["source_date_provenance"]["10m"]
    post_provenance20 = observations[2]["source_date_provenance"]["20m"]
    ndvi_summary = component_summary("NDVI", delta_ndvi, comparable_ndvi, aoi10, reference10, dates, "(B8 - B4) / (B8 + B4)", ["B8", "B4"], post_provenance10)
    ndmi_summary = component_summary("NDMI", delta_ndmi, comparable_ndmi, aoi20, reference20, dates, "(B8A - B11) / (B8A + B11)", ["B8A", "B11"], post_provenance20)
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
    aoi_effis = transform_geometry(aoi, aoi_srs, effis_srs)
    clipped_effis = effis_geometry.Intersection(aoi_effis)
    if clipped_effis.IsEmpty():
        raise RuntimeError("EFFIS feature 592404 does not intersect the release AOI")
    effis_wgs84 = transform_geometry(clipped_effis, effis_srs, wgs84)
    effis_feature = {
        "type": "Feature",
        "properties": {**effis_properties, "layer_id": "effis-provisional-boundary", "provider_feature_id": "592404", "classification": "historic_provisional_provider", "provider": "European Union, Copernicus EFFIS", "source_status": "Historic checksum-pinned provider evidence retained from release one; feature 592404 was not returned by EFFIS on 21 August 2026.", "current_corroboration": "Feature 627416 is geometry-identical but is only a BCA-inferred re-key, not an EFFIS-declared successor.", "display_geometry": "Provider feature clipped only for display to the release AOI; the complete historic provider snapshot is retained in acquisition lineage.", "limitation": "Not an authority, legal or surveyed perimeter; provider dates are not authority incident times."},
        "geometry": json.loads(effis_wgs84.ExportToJson()),
    }
    with open(args.effis_out, "x", encoding="utf-8") as handle:
        json.dump({"type": "FeatureCollection", "features": [effis_feature]}, handle, separators=(",", ":"))
    with open(args.effis_summary, "x", encoding="utf-8") as handle:
        json.dump({
            "layer": {
                "name_en": "EFFIS provisional provider boundary",
                "name_cy": "Ffin dros dro y darparwr EFFIS",
            },
            "provider_feature": effis_properties,
            "source_identity": {
                "role": "canonical historic provider evidence retained from release one",
                "provider_feature_id": "592404",
                "retrieved_at": "2026-08-13T18:20:27.597Z",
                "response_sha256": EFFIS_HISTORIC_RESPONSE_SHA256,
                "feature_not_returned_on": "2026-08-21",
                "fresh_reacquisition_claimed": False,
            },
            "current_corroboration": effis_corroboration,
            "display_geometry": effis_feature["properties"]["display_geometry"],
            "attribution": "European Union, Copernicus EFFIS; clipped and reformatted by Blorenge Commoners Association.",
            "limitations": [
                "Not an authority, legal or surveyed perimeter.",
                "Provider dates are not authority incident times.",
                "EFFIS no longer returns historic feature 592404; 627416 is only a BCA-inferred re-key because no provider crosswalk is published.",
                "Spatial overlap does not validate or establish the cause of raster change or thermal anomalies.",
            ],
            "limitations_cy": [
                "Nid yw'n ffin awdurdod, gyfreithiol nac wedi'i harolygu.",
                "Nid amseroedd digwyddiad awdurdod yw dyddiadau'r darparwr.",
                "Nid yw EFFIS bellach yn dychwelyd nodwedd hanesyddol 592404; dim ond ailallweddiad a gasglwyd gan BCA yw 627416 gan nad oes croesgyfeiriad darparwr wedi'i gyhoeddi.",
                "Nid yw gorgyffwrdd gofodol yn dilysu nac yn sefydlu achos newid raster nac anomaleddau thermol.",
            ],
        }, handle, separators=(",", ":"))

    report = {
        "spatial_contract": {"core_label": core_properties["name"], "core_version": core_properties["version"], "buffer_distance_m": 2000, "buffer_crs": "EPSG:27700", "clip_mode": "exact"},
        "observations": {item["role"]: item for item in observations},
        "coverage": coverage,
        "quality_thresholds": {"scene_valid_percent_min": SCENE_MINIMUM, "product_comparable_percent_min": PRODUCT_MINIMUM, "effis_comparable_percent_min": EFFIS_MINIMUM},
        "mask": {"invalid_scl_classes": INVALID_SCL, "dilation_native_pixels": 1, "dilation_m": 20, "post_observations_masked_independently": True},
        "combined_thresholds": {"dNBR": "> 0.10", "delta_NDVI": "< -0.08", "delta_NDMI_higher_confidence": "< -0.05"},
        "components": {"ndvi": ndvi_summary, "ndmi": ndmi_summary},
        "evidence_state_summary": [
            {"state": label, "pixel_count": count, "area_ha_rounded": round(count * pixel_area_ha)}
            for label, count in state_rows
        ],
        "effis": {
            "provider_feature_id": "592404",
            "source_status": "historic_release_one_provider_evidence",
            "historic_response_sha256": EFFIS_HISTORIC_RESPONSE_SHA256,
            "current_corroboration": effis_corroboration,
            "limitation": "Independent provisional provider boundary; not an authority, legal or surveyed perimeter and not validation of any raster or thermal anomaly.",
        },
        "landsat_corroboration": "Retained as separate 30 m corroboration in lineage and not fused into the Sentinel-derived raster.",
        "limitations": [
            "Observed change is not proof of ecological recovery or habitat condition.",
            "Component NDVI and NDMI differences do not establish cause, fire damage, severity, dryness or wetness.",
            "No exact, legal, surveyed or incident-authority perimeter is available.",
            "The evidence-state thresholds are not locally calibrated severity classes.",
            "Pixels failing the full mask are Not observed, never zero or no change.",
        ],
    }
    with open(args.summary, "x", encoding="utf-8") as handle:
        json.dump(report, handle, separators=(",", ":"))


if __name__ == "__main__":
    main()
