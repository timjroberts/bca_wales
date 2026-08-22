#!/usr/bin/env node

const STATUS_URL = process.env.FIRMS_STATUS_URL ?? "https://assets.bca.wales/active-fire/status.json";
const CURRENT_URL = process.env.FIRMS_CURRENT_URL ?? "https://assets.bca.wales/active-fire/current.json";

async function getJson(url) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20_000), headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  if (!response.headers.get("content-type")?.toLowerCase().includes("json")) throw new Error(`${url}: expected JSON content type`);
  return response.json();
}

async function main() {
  const [status, current] = await Promise.all([getJson(STATUS_URL), getJson(CURRENT_URL)]);
  if (status.schema_version !== "1.0.0" || current.schema_version !== "1.0.0") throw new Error("operational feed schema version changed");
  if (["outage", "withdrawn"].includes(status.status)) throw new Error(`operational feed status is ${status.status}`);
  if (current.status === "withdrawn") throw new Error("operational feed is withdrawn");
  if (!status.last_complete_success_at) throw new Error("operational feed has no complete success");
  const ageHours = (Date.now() - new Date(status.last_complete_success_at).getTime()) / 3_600_000;
  if (!Number.isFinite(ageHours) || ageHours >= 12) throw new Error(`operational feed is stale (${ageHours.toFixed(1)} hours since complete success)`);
  process.stdout.write(`${JSON.stringify({ status: status.status, last_complete_success_at: status.last_complete_success_at, age_hours: ageHours }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`FIRMS feed monitor failed: ${error.message}\n`);
  process.exitCode = 1;
});
