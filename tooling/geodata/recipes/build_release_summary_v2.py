#!/usr/bin/env python3

"""Assemble the accessible release-two factual summary."""

import argparse
import json


def load(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--context", required=True)
    parser.add_argument("--terrain", required=True)
    parser.add_argument("--change", required=True)
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--dataset-version", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    context = load(args.context)
    terrain = load(args.terrain)
    change = load(args.change)
    release = {
        "release_id": args.release_id,
        "dataset_version": args.dataset_version,
        "status": "immutable_candidate_not_current",
        "area_of_interest": context["area_of_interest"],
        "visitor_questions": [
            "What surface and vegetation change is observable across the BCA-area of interest plus exactly 2 km?",
            "What do the separately selectable NDVI and NDMI differences show without assigning a cause?",
            "How does that evidence relate to the retained EFFIS event boundary and independent landscape context?",
        ],
        "change_evidence": change,
        "context_layers": context["layers"],
        "terrain": terrain,
        "claim_ceiling": "Satellite observations show surface and vegetation change consistent with the documented July 2026 Blaenavon wildfire; component index changes do not establish cause.",
        "limitations": change["limitations"] + context["limitations"],
        "promotion": "Not promoted. Explorer integration, launch acceptance and deployment verification must complete before releases/current.json changes.",
    }
    with open(args.output, "x", encoding="utf-8") as handle:
        json.dump(release, handle, indent=2, sort_keys=True)
        handle.write("\n")


if __name__ == "__main__":
    main()
