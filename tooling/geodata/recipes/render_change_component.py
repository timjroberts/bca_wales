#!/usr/bin/env python3

"""Render a release-two analytical component COG to an RGBA display raster."""

import argparse

import numpy as np
from osgeo import gdal, ogr, osr

from build_change_evidence_v2 import release_aoi, rasterize

gdal.UseExceptions()
ogr.UseExceptions()
osr.UseExceptions()

STOPS = np.array([-0.5, -0.25, -0.1, 0.0, 0.1, 0.25, 0.5], dtype=np.float32)
COLOURS = {
    "NDVI": np.array([[118, 42, 131], [175, 141, 195], [231, 212, 232], [247, 247, 247], [217, 240, 211], [127, 191, 123], [27, 120, 55]], dtype=np.float32),
    "NDMI": np.array([[140, 81, 10], [216, 179, 101], [246, 232, 195], [245, 245, 245], [199, 234, 229], [90, 180, 172], [1, 102, 94]], dtype=np.float32),
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--core", required=True)
    parser.add_argument("--product", choices=sorted(COLOURS), required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    source = gdal.Open(args.input)
    values = source.GetRasterBand(1).ReadAsArray().astype(np.float32)
    nodata = source.GetRasterBand(1).GetNoDataValue()
    valid = np.isfinite(values) & (values != nodata)
    aoi, aoi_srs, _ = release_aoi(args.core)
    inside = rasterize(source, aoi, aoi_srs)

    clipped = np.clip(values, STOPS[0], STOPS[-1])
    rgb = np.zeros((*values.shape, 3), dtype=np.uint8)
    colours = COLOURS[args.product]
    for channel in range(3):
        rgb[..., channel] = np.interp(clipped, STOPS, colours[:, channel]).round().astype(np.uint8)

    rows, columns = np.indices(values.shape)
    hatch = inside & ~valid
    dark_hatch = hatch & (((rows + columns) % 8) < 2)
    rgb[hatch] = [190, 190, 190]
    rgb[dark_hatch] = [115, 115, 115]
    alpha = np.zeros(values.shape, dtype=np.uint8)
    alpha[inside] = 255

    driver = gdal.GetDriverByName("GTiff")
    output = driver.Create(
        args.output,
        source.RasterXSize,
        source.RasterYSize,
        4,
        gdal.GDT_Byte,
        options=["TILED=YES", "COMPRESS=DEFLATE", "PHOTOMETRIC=RGB"],
    )
    output.SetProjection(source.GetProjection())
    output.SetGeoTransform(source.GetGeoTransform())
    for index in range(3):
        output.GetRasterBand(index + 1).WriteArray(rgb[..., index])
    output.GetRasterBand(4).WriteArray(alpha)
    output.GetRasterBand(4).SetColorInterpretation(gdal.GCI_AlphaBand)
    output = None


if __name__ == "__main__":
    main()
