import assert from "node:assert/strict";
import process from "node:process";

const [, , commit, releaseId] = process.argv;
assert.match(commit ?? "", /^[0-9a-f]{40}$/, "application commit must be a full Git SHA");
assert.match(releaseId ?? "", /^release-[a-z0-9][a-z0-9._-]+$/, "release id is invalid");

process.stdout.write(`${JSON.stringify({ application_commit: commit, evidence_release_id: releaseId })}\n`);
