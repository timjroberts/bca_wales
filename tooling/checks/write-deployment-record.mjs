import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [, , commit, releaseId, manifestSha256] = process.argv;
assert.match(commit ?? "", /^[0-9a-f]{40}$/, "application commit must be a full Git SHA");
assert.match(releaseId ?? "", /^release-[a-z0-9][a-z0-9._-]+$/, "release id is invalid");
assert.match(manifestSha256 ?? "", /^[0-9a-f]{64}$/, "manifest SHA-256 is invalid");

const policy = JSON.parse(await readFile(new URL("../../config/launch/acceptance-policy.json", import.meta.url), "utf8"));
const createdAt = new Date().toISOString();
const record = {
  schema_version: "1.0.0",
  service: "Blorenge landscape explorer",
  application_commit: commit,
  evidence_release_id: releaseId,
  evidence_manifest_sha256: manifestSha256,
  candidate_created_at: createdAt,
  finalised_at: null,
  approval: { authority: policy.release_authority, status: "pending", approved_at: null, evidence: null },
  promotion: {
    site_url: "https://explore.bca.wales",
    asset_origin: "https://assets.bca.wales",
    pages_deployment: null,
    current_pointer: null,
    promoted_at: null,
    production_verification: null
  },
  rollback: { site_target: null, evidence_target: null, rehearsed_at: null, result: "pending", evidence: null },
  expected_monthly_cost_gbp: 0,
  results: policy.checks.map((check) => ({ id: check.id, tier: check.tier, result: "pending", evidence: check.description, waiver: null }))
};

process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
