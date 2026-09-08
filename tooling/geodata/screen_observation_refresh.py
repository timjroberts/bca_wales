#!/usr/bin/env python3
"""Screen newer Sentinel SCL assets against the retained release's 20 m gates.

This is a necessary-condition screen, not a candidate build. Passing requires
subsequent full-band, 10 m/20 m validation and publication QA. The union is only
an optimistic coverage bound; it is never an approved temporal composite.
Run in the pinned geodata container, with networking disabled.
"""

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
from osgeo import gdal


def digest(file):
    with open(file, "rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def load(file):
    return json.loads(Path(file).read_text())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--catalogue", type=Path, required=True)
    parser.add_argument("--scl-directory", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    recipe_path = Path(__file__).parent / "recipes/build_change_evidence_v2.py"
    spec = importlib.util.spec_from_file_location("change", recipe_path)
    change = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(change)
    recipe = load(args.archive / "snapshots/publication-recipe.json")
    inputs = {item["input_id"]: item for item in recipe["inputs"]}
    retained = {}

    def verified_input(input_id):
        item = inputs[input_id]
        file = args.archive / item["destination"]
        actual = digest(file)
        if actual != item["expected_sha256"]:
            raise ValueError(f"Retained input checksum mismatch: {input_id}")
        retained[input_id] = actual
        return str(file)

    reference = gdal.Open(verified_input("s2-post-swir1"))
    aoi, aoi_srs, _ = change.release_aoi(verified_input("bca-area-core"))
    domain = change.rasterize(reference, aoi, aoi_srs)
    geometry, srs, _ = change.load_effis(verified_input("effis-release-one"), "592404")
    effis = change.rasterize(reference, geometry, srs) & domain
    baseline = ~change.quality_mask(verified_input("s2-baseline-scl"), reference, domain)
    prefire = ~change.quality_mask(verified_input("s2-prefire-scl"), reference, domain)
    union = np.zeros(domain.shape, dtype=bool)
    rows = []

    def coverage(valid):
        return {
            "valid_aoi_percent": change.percentage(valid, domain),
            "combined_comparable_aoi_percent": change.percentage(valid & baseline & prefire, domain),
            "combined_comparable_effis_percent": change.percentage(valid & baseline & prefire & effis, effis),
            "valid_aoi_pixels": int(valid.sum()),
            "combined_comparable_aoi_pixels": int((valid & baseline & prefire).sum()),
            "combined_comparable_effis_pixels": int((valid & baseline & prefire & effis).sum()),
        }

    for item in sorted(load(args.catalogue)["features"], key=lambda x: x["properties"]["datetime"], reverse=True):
        file = args.scl_directory / f"{item['id']}.tif"
        asset = item["assets"]["scl"]
        sha256 = digest(file)
        if asset["file:checksum"] != "1220" + sha256 or file.stat().st_size != asset["file:size"]:
            raise ValueError(f"Provider checksum/size mismatch: {item['id']}")
        source = gdal.Open(str(file))
        # Explicitly exclude areas outside neighbouring tile footprints. A
        # zero-initialized invalidity warp alone could call these valid.
        footprint = gdal.GetDriverByName("MEM").Create("", source.RasterXSize, source.RasterYSize, 1, gdal.GDT_Byte)
        footprint.SetProjection(source.GetProjection())
        footprint.SetGeoTransform(source.GetGeoTransform())
        footprint.GetRasterBand(1).Fill(1)
        target = gdal.GetDriverByName("MEM").Create("", reference.RasterXSize, reference.RasterYSize, 1, gdal.GDT_Byte)
        target.SetProjection(reference.GetProjection())
        target.SetGeoTransform(reference.GetGeoTransform())
        gdal.ReprojectImage(footprint, target, footprint.GetProjection(), reference.GetProjection(), gdal.GRA_NearestNeighbour)
        valid = (~change.quality_mask(str(file), reference, domain)
                 & domain & target.GetRasterBand(1).ReadAsArray().astype(bool))
        union |= valid
        row = {
            "id": item["id"], "datetime": item["properties"]["datetime"],
            "official_product": item["properties"]["s2:product_uri"],
            "scl_url": asset["href"], "scl_sha256": sha256,
            "scl_bytes": asset["file:size"], **coverage(valid),
        }
        rows.append(row)
        print(json.dumps({"id": item["id"], **coverage(valid)}), flush=True)

    report = {
        "screen_type": "necessary_20m_quality_mask_condition_only",
        "retained_release_id": recipe["release_id"],
        "recipe_code_sha256": digest(recipe_path),
        "catalogue_sha256": digest(args.catalogue),
        "retained_input_sha256": retained,
        "grid_crs": "EPSG:32630", "grid_resolution_m": 20,
        "aoi_pixels": int(domain.sum()), "effis_pixels": int(effis.sum()),
        "invalid_scl_classes": change.INVALID_SCL, "native_dilation_pixels": 1,
        "thresholds_percent": {"scene_valid_aoi": 95, "product_comparable_aoi": 90, "combined_comparable_effis": 95},
        "scenes": rows, "optimistic_union_upper_bound": coverage(union),
        "union_is_approved_composite": False,
        "limitations": [
            "This screen does not establish full-band or 10 m validity; a failure at 20 m already excludes publication.",
            "The union includes every supplied date and overlapping tile only to bound possible coverage, not to approve blending or a broad temporal composite.",
        ],
    }
    with args.output.open("x") as handle:
        json.dump(report, handle, indent=2)
        handle.write("\n")
    print(json.dumps(report["optimistic_union_upper_bound"]), flush=True)


if __name__ == "__main__":
    main()
