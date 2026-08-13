#!/usr/bin/env python3

import argparse
import csv
import json
import os
from collections import Counter
from osgeo import gdal, ogr, osr
import numpy as np

gdal.UseExceptions()
ogr.UseExceptions()
osr.UseExceptions()

INVALID_SCL = [0, 1, 2, 3, 8, 9, 10, 11]


def first_geometry(path):
    datasource = ogr.Open(path)
    layer = datasource.GetLayer(0)
    feature = layer.GetNextFeature()
    return feature.GetGeometryRef().Clone(), layer.GetSpatialRef().Clone()


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


def read_scaled(path, reference):
    source = gdal.Open(path)
    memory = gdal.GetDriverByName("MEM").Create(
        "", reference.RasterXSize, reference.RasterYSize, 1, gdal.GDT_Float32
    )
    memory.SetProjection(reference.GetProjection())
    memory.SetGeoTransform(reference.GetGeoTransform())
    gdal.ReprojectImage(source, memory, source.GetProjection(), reference.GetProjection(), gdal.GRA_Bilinear)
    band = memory.GetRasterBand(1)
    values = band.ReadAsArray().astype(np.float32)
    scale = source.GetRasterBand(1).GetScale()
    offset = source.GetRasterBand(1).GetOffset()
    if scale is None:
        scale = 0.0001
    if offset is None:
        offset = -0.1
    return values * scale + offset


def rasterize_aoi(reference, geometry, source_srs):
    target_srs = osr.SpatialReference()
    target_srs.ImportFromWkt(reference.GetProjection())
    transformed = geometry.Clone()
    transformed.Transform(osr.CoordinateTransformation(source_srs, target_srs))
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


def write_multiband(path, reference, bands, descriptions, nodata=-9999.0):
    driver = gdal.GetDriverByName("GTiff")
    temporary = f"{path}.working.tif"
    dataset = driver.Create(
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
        band.WriteArray(values)
        band.SetDescription(description)
        band.SetNoDataValue(nodata)
    dataset = None
    gdal.Translate(
        path,
        temporary,
        format="COG",
        creationOptions=["COMPRESS=ZSTD", "BIGTIFF=IF_SAFER", "OVERVIEWS=AUTO"],
    )
    os.unlink(temporary)


def load_effis(path):
    datasource = ogr.Open(path)
    layer = datasource.GetLayer(0)
    for feature in layer:
        if str(feature.GetField("id")) == "592404":
            geometry = feature.GetGeometryRef().Clone()
            properties = {
                name: feature.GetField(name)
                for name in ["id", "FIREDATE", "FINALDATE", "LASTUPDATE", "COUNTRY", "PROVINCE", "COMMUNE", "AREA_HA", "CLASS"]
            }
            return geometry, layer.GetSpatialRef().Clone(), properties
    raise RuntimeError("EFFIS feature 592404 was not present in the bounded snapshot")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sssi", required=True)
    parser.add_argument("--baseline", nargs=5, metavar=("RED", "NIR", "SWIR1", "SWIR2", "SCL"), required=True)
    parser.add_argument("--prefire", nargs=5, metavar=("RED", "NIR", "SWIR1", "SWIR2", "SCL"), required=True)
    parser.add_argument("--post", nargs=5, metavar=("RED", "NIR", "SWIR1", "SWIR2", "SCL"), required=True)
    parser.add_argument("--effis", required=True)
    parser.add_argument("--cog", required=True)
    parser.add_argument("--evidence", required=True)
    parser.add_argument("--csv", required=True)
    parser.add_argument("--summary", required=True)
    args = parser.parse_args()

    sssi, sssi_srs = first_geometry(args.sssi)
    aoi = sssi.Buffer(2000)
    reference = gdal.Open(args.post[4])
    aoi_mask = rasterize_aoi(reference, aoi, sssi_srs)

    scenes = []
    for role, date, paths in [
        ("seasonal_baseline", "2025-07-12", args.baseline),
        ("before_first_report", "2026-07-12", args.prefire),
        ("first_suitable_after_report", "2026-08-11", args.post),
    ]:
        red, nir, swir1, swir2 = [read_scaled(path, reference) for path in paths[:4]]
        scl_dataset = gdal.Open(paths[4])
        scl_memory = gdal.GetDriverByName("MEM").Create("", reference.RasterXSize, reference.RasterYSize, 1, gdal.GDT_Byte)
        scl_memory.SetProjection(reference.GetProjection())
        scl_memory.SetGeoTransform(reference.GetGeoTransform())
        gdal.ReprojectImage(scl_dataset, scl_memory, scl_dataset.GetProjection(), reference.GetProjection(), gdal.GRA_NearestNeighbour)
        scl = scl_memory.GetRasterBand(1).ReadAsArray()
        invalid = dilate(np.isin(scl, INVALID_SCL)) | ~aoi_mask
        ndvi = np.divide(nir - red, nir + red, out=np.zeros_like(nir), where=np.abs(nir + red) > 1e-6)
        nbr = np.divide(nir - swir2, nir + swir2, out=np.zeros_like(nir), where=np.abs(nir + swir2) > 1e-6)
        ndmi = np.divide(nir - swir1, nir + swir1, out=np.zeros_like(nir), where=np.abs(nir + swir1) > 1e-6)
        for array in [ndvi, nbr, ndmi]:
            array[invalid] = np.nan
        scenes.append({"role": role, "date": date, "invalid": invalid, "ndvi": ndvi, "nbr": nbr, "ndmi": ndmi})

    baseline, prefire, post = scenes
    comparable = ~baseline["invalid"] & ~post["invalid"] & aoi_mask
    dnbr = prefire["nbr"] - post["nbr"]
    dndvi = post["ndvi"] - baseline["ndvi"]
    dndmi = post["ndmi"] - baseline["ndmi"]
    for array in [dnbr, dndvi, dndmi]:
        array[~comparable] = np.nan

    evidence_state = np.zeros_like(dnbr, dtype=np.float32)
    observed_change = comparable & (dnbr > 0.10) & (dndvi < -0.08)
    higher = observed_change & (dndmi < -0.05)
    lower = observed_change & ~higher
    evidence_state[comparable] = 1
    evidence_state[lower] = 2
    evidence_state[higher] = 3
    observation_count = np.zeros_like(dnbr, dtype=np.float32)
    observation_count[comparable] = 2
    observation_count[~comparable] = 0
    output_bands = []
    for values in [dnbr, dndvi, dndmi, evidence_state, observation_count]:
        serialised = values.astype(np.float32)
        serialised[~np.isfinite(serialised)] = -9999.0
        output_bands.append(serialised)
    write_multiband(args.cog, reference, output_bands, ["dNBR", "delta_NDVI", "delta_NDMI", "evidence_state", "observation_count"])

    transform = reference.GetGeoTransform()
    pixel_area_ha = abs(transform[1] * transform[5]) / 10000
    counts = Counter(evidence_state[aoi_mask].astype(int).tolist())
    not_observed = int(aoi_mask.sum()) - int(comparable.sum())
    state_rows = [
        ("not_observed", not_observed, "A quality mask prevents comparison."),
        ("observed_no_thresholded_change", counts[1], "A valid comparison exists but the conservative change rule is not met."),
        ("lower_confidence_observed_change", counts[2], "dNBR and NDVI indicate change; the moisture-sensitive indicator does not agree."),
        ("higher_confidence_observed_change", counts[3], "dNBR, NDVI and NDMI agree on observed surface and vegetation change."),
    ]
    with open(args.csv, "x", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["evidence_state", "pixel_count", "area_ha_rounded", "meaning"])
        for label, count, meaning in state_rows:
            writer.writerow([label, count, round(count * pixel_area_ha), meaning])

    effis_geometry, effis_srs, effis_properties = load_effis(args.effis)
    wgs84 = osr.SpatialReference()
    wgs84.ImportFromEPSG(4326)
    if not effis_srs.IsSame(wgs84):
        effis_geometry.Transform(osr.CoordinateTransformation(effis_srs, wgs84))
    effis_feature = {
        "type": "Feature",
        "properties": {
            "layer_id": "effis-provisional-boundary",
            "classification": "provisional_provider",
            "provider": "European Union, Copernicus EFFIS",
            "provider_feature_id": "592404",
            "provider_area_ha": int(float(effis_properties["AREA_HA"])),
            "provider_firedate": effis_properties["FIREDATE"],
            "provider_finaldate": effis_properties["FINALDATE"],
            "provider_lastupdate": effis_properties["LASTUPDATE"],
            "evidence_status": "High-confidence event match; separate provisional provider interpretation, not an incident-authority or surveyed perimeter.",
            "limitation": "Provider dates are not authoritative ignition, containment or extinction times; provider area differs from SWFRS operational estimates.",
        },
        "geometry": json.loads(effis_geometry.ExportToJson()),
    }
    with open(args.evidence, "x", encoding="utf-8") as handle:
        json.dump({"type": "FeatureCollection", "features": [effis_feature]}, handle, separators=(",", ":"))

    summary = {
        "headline_claim_ceiling": "Satellite observations show surface and vegetation change consistent with the documented July 2026 Blaenavon wildfire.",
        "incident": {
            "bca_identifier": "swfrs-blaenavon-2026-07-19",
            "first_report": "2026-07-19T19:42:00Z",
            "chronology": "Active and under containment operations on 23 July; work and a holding perimeter line were reported on 27 July.",
            "control_or_stop_time": None,
            "cause": None,
        },
        "observations": [
            {"role": scene["role"], "date": scene["date"], "valid_aoi_percent": round(float((~scene["invalid"] & aoi_mask).sum()) * 100 / float(aoi_mask.sum()), 3)}
            for scene in scenes
        ],
        "method": {
            "indicators": ["continuous dNBR", "continuous NDVI change", "continuous NDMI change"],
            "mask": "Sentinel-2 SCL invalid classes plus a one-pixel (20 m) adjacency dilation.",
            "states": {"0": "not observed", "1": "observed, no thresholded change", "2": "lower-confidence observed change", "3": "higher-confidence observed change"},
            "thresholds": {"dNBR": "> 0.10", "delta_NDVI": "< -0.08", "delta_NDMI_higher_confidence": "< -0.05"},
            "calibration": "Conservative uncalibrated evidence-state rule; not a local severity classification.",
        },
        "evidence_state_summary": [
            {"state": label, "pixel_count": count, "area_ha_rounded": round(count * pixel_area_ha)}
            for label, count, _ in state_rows
        ],
        "effis": effis_feature["properties"],
        "limitations": [
            "Observed change is not proof of ecological recovery or habitat condition.",
            "No exact, legal, surveyed or incident-authority perimeter is available.",
            "The first suitable post-report Sentinel-2 observation is 11 August 2026; earlier cloud-obscured areas remain not observed.",
            "The evidence-state thresholds are not locally calibrated severity classes.",
            "Landsat corroboration remains a separate 30 m observation and is not fused into the Sentinel-derived raster.",
        ],
    }
    with open(args.summary, "x", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2, sort_keys=True)
        handle.write("\n")


if __name__ == "__main__":
    main()
