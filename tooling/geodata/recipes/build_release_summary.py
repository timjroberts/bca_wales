#!/usr/bin/env python3

import argparse
import json


def load(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--context", required=True)
    parser.add_argument("--terrain", required=True)
    parser.add_argument("--fire", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    context = load(args.context)
    terrain = load(args.terrain)
    fire = load(args.fire)
    release = {
        "release_id": "release-blorenge-2026-08-13.6",
        "dataset_version": "2026-08-13.6",
        "status": "immutable_candidate_not_current",
        "area_of_interest": context["area_of_interest"],
        "visitor_questions": [
            "What area is represented by the provisional provider fire comparison?",
            "What surface and vegetation change is observable in the first suitable post-report observation?",
            "How does that evidence relate to protected-site, terrain, water, paths, place and historical habitat context?",
        ],
        "incident": fire["incident"],
        "observations": fire["observations"],
        "evidence_method": fire["method"],
        "evidence_state_summary": fire["evidence_state_summary"],
        "context_layers": context["layers"],
        "terrain": terrain,
        "claim_ceiling": fire["headline_claim_ceiling"],
        "limitations": fire["limitations"] + context["limitations"],
        "promotion": "Not promoted. Launch acceptance and the separate integration/deployment ticket must complete before releases/current.json changes.",
    }
    with open(args.output, "x", encoding="utf-8") as handle:
        json.dump(release, handle, indent=2, sort_keys=True)
        handle.write("\n")


if __name__ == "__main__":
    main()
