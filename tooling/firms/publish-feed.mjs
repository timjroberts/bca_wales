#!/usr/bin/env node

import { readFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { publishOperationalFeed, sha256 } from "./operational-feed.mjs";
import { R2ObjectStore } from "./r2-object-store.mjs";

function options(argv) {
  const parsed = {
    bucket: "bca-wales-public-releases",
    jurisdiction: "eu",
    origin: "https://assets.bca.wales",
    aoi: "data/validation/firms/2026-08-21/aoi.geojson",
    metadata: "data/validation/firms/2026-08-21/aoi-metadata.json"
  };
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Invalid option: ${key ?? ""}`);
    parsed[key.slice(2)] = value;
  }
  return parsed;
}

async function main() {
  const args = options(process.argv);
  const mapKey = process.env.FIRMS_MAP_KEY;
  if (!mapKey) throw new Error("FIRMS_MAP_KEY is required");
  const [aoiBytes, metadataBytes, coreBytes] = await Promise.all([
    readFile(path.resolve(args.aoi)),
    readFile(path.resolve(args.metadata)),
    readFile(path.resolve("Blorenge.geojson"))
  ]);
  const metadata = JSON.parse(metadataBytes.toString("utf8"));
  if (sha256(aoiBytes) !== metadata.aoi.sha256) throw new Error("Pinned AOI checksum does not match its metadata");
  if (sha256(coreBytes) !== metadata.core.sha256) throw new Error("Canonical core checksum does not match the pinned AOI derivation");
  const store = new R2ObjectStore({ bucket: args.bucket, jurisdiction: args.jurisdiction });
  const result = await publishOperationalFeed({
    store,
    mapKey,
    aoi: JSON.parse(aoiBytes.toString("utf8")),
    aoiMetadata: metadata,
    assetOrigin: args.origin
  });
  const summary = [
    "## Recent satellite thermal anomalies",
    "",
    `- Outcome: **${result.status.status}**`,
    `- Published a new verified pointer: **${result.published ? "yes" : "no"}**`,
    `- Last attempted: ${result.status.last_attempted_at}`,
    `- Last complete success: ${result.status.last_complete_success_at ?? "none"}`,
    `- Latest source observation: ${result.status.latest_observation_at ?? "none in retained history"}`,
    result.manifest.counts ? `- Public observations: ${result.manifest.counts.map_24h} in 24 hours; ${result.manifest.counts.history_30d} in 30 days` : ""
  ].filter(Boolean).join("\n") + "\n";
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  process.stdout.write(summary);
  if (!result.published) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`FIRMS feed publication failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
