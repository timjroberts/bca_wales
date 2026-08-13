#!/usr/bin/env python3
"""Create a deterministic, geometry-free CSV table from GeoJSON features."""

import csv
import json
import pathlib
import sys


def main() -> None:
    if len(sys.argv) < 4:
        raise SystemExit("usage: geojson_to_csv.py INPUT OUTPUT FIELD [FIELD ...]")

    source = pathlib.Path(sys.argv[1])
    destination = pathlib.Path(sys.argv[2])
    fields = sys.argv[3:]
    document = json.loads(source.read_text(encoding="utf-8"))
    features = document.get("features")
    if document.get("type") != "FeatureCollection" or not isinstance(features, list):
        raise SystemExit("input must be a GeoJSON FeatureCollection")

    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        for feature in features:
            properties = feature.get("properties") or {}
            writer.writerow({field: properties.get(field, "") for field in fields})


if __name__ == "__main__":
    main()
