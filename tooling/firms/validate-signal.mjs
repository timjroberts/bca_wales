#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const REQUIRED_FIELDS = [
  "latitude",
  "longitude",
  "bright_ti4",
  "scan",
  "track",
  "acq_date",
  "acq_time",
  "satellite",
  "instrument",
  "confidence",
  "version",
  "bright_ti5",
  "frp",
  "daynight"
];

export const SOURCES = ["VIIRS_NOAA21_NRT", "VIIRS_NOAA20_NRT"];
const SOURCE_SATELLITES = {
  VIIRS_NOAA21_NRT: new Set(["N21", "NOAA-21", "NOAA21"]),
  VIIRS_NOAA20_NRT: new Set(["N20", "NOAA-20", "NOAA20"])
};
const PERIODS = [
  {
    id: "quiet",
    label: "30-day pre-event quiet comparison",
    windows: ["2026-06-15", "2026-06-20", "2026-06-25", "2026-06-30", "2026-07-05", "2026-07-10"]
  },
  {
    id: "event",
    label: "July 2026 event window with margins",
    windows: ["2026-07-15", "2026-07-20", "2026-07-25", "2026-07-30"]
  }
];
const MAXIMUM_RESPONSE_BYTES = 5_000_000;
const USER_AGENT = "bca-wales-firms-validation/1.0";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
  }
  return value;
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(stableObject(value), null, 2)}\n`, { flag: "wx" });
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field");
  if (field.length > 0 || row.length > 0) {
    row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  return rows;
}

function pointOnSegment([x, y], [x1, y1], [x2, y2]) {
  const cross = (y - y1) * (x2 - x1) - (x - x1) * (y2 - y1);
  if (Math.abs(cross) > 1e-12) return false;
  return x >= Math.min(x1, x2) && x <= Math.max(x1, x2) && y >= Math.min(y1, y2) && y <= Math.max(y1, y2);
}

function pointInRing(point, ring) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const a = ring[current];
    const b = ring[previous];
    if (pointOnSegment(point, a, b)) return true;
    const crosses = (a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

export function pointInGeometry(point, geometry) {
  const inPolygon = (coordinates) => pointInRing(point, coordinates[0]) &&
    !coordinates.slice(1).some((ring) => pointInRing(point, ring));
  if (geometry.type === "Polygon") return inPolygon(geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some(inPolygon);
  throw new Error(`Unsupported AOI geometry: ${geometry.type}`);
}

function finiteNumber(value, label, { minimum = -Infinity, maximum = Infinity } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${label} is outside its accepted numeric range`);
  }
  return parsed;
}

function acquisitionTime(row) {
  if (!/^\d{4}$/.test(row.acq_time) || !/^\d{4}-\d{2}-\d{2}$/.test(row.acq_date)) {
    throw new Error("acquisition date/time has an unexpected format");
  }
  const timestamp = new Date(`${row.acq_date}T${row.acq_time.slice(0, 2)}:${row.acq_time.slice(2)}:00Z`);
  if (!Number.isFinite(timestamp.getTime())) throw new Error("acquisition date/time is invalid");
  return timestamp;
}

export function normalizeRow(row, source, geometry, retrievedAt) {
  const latitude = finiteNumber(row.latitude, "latitude", { minimum: -90, maximum: 90 });
  const longitude = finiteNumber(row.longitude, "longitude", { minimum: -180, maximum: 180 });
  const brightTi4 = finiteNumber(row.bright_ti4, "bright_ti4");
  const brightTi5 = finiteNumber(row.bright_ti5, "bright_ti5");
  const scan = finiteNumber(row.scan, "scan", { minimum: 0 });
  const track = finiteNumber(row.track, "track", { minimum: 0 });
  const frp = finiteNumber(row.frp, "frp", { minimum: 0 });
  const observedAt = acquisitionTime(row);
  if (observedAt.getTime() > retrievedAt.getTime() + 10 * 60 * 1000) {
    throw new Error("acquisition time is unexpectedly in the future");
  }
  if (!SOURCE_SATELLITES[source]?.has(row.satellite)) throw new Error("satellite does not match requested source");
  if (row.instrument !== "VIIRS") throw new Error("instrument is not VIIRS");
  if (!new Set(["low", "nominal", "high", "l", "n", "h"]).has(row.confidence.toLowerCase())) {
    throw new Error("confidence class is unknown");
  }
  if (!new Set(["D", "N"]).has(row.daynight)) throw new Error("daynight class is unknown");
  if (!row.version) throw new Error("source version is empty");

  const observationKey = sha256([
    source,
    row.satellite,
    row.instrument,
    row.acq_date,
    row.acq_time,
    row.latitude,
    row.longitude,
    row.scan,
    row.track
  ].join("|"));
  const rowFingerprint = sha256(JSON.stringify(REQUIRED_FIELDS.map((field) => row[field])));
  return {
    source,
    satellite: row.satellite,
    instrument: row.instrument,
    observed_at: observedAt.toISOString(),
    latitude,
    longitude,
    scan,
    track,
    bright_ti4: brightTi4,
    bright_ti5: brightTi5,
    frp,
    confidence: row.confidence.toLowerCase(),
    daynight: row.daynight,
    version: row.version,
    inside_aoi: pointInGeometry([longitude, latitude], geometry),
    observation_key: observationKey,
    row_fingerprint: rowFingerprint
  };
}

function parseDetectionResponse(bytes, source, geometry, retrievedAt) {
  const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
  if (/^\s*</.test(text)) throw new Error("provider returned HTML instead of CSV");
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error("provider returned an empty body without a CSV header");
  const header = rows[0];
  if (header.length !== REQUIRED_FIELDS.length || header.some((field, index) => field !== REQUIRED_FIELDS[index])) {
    throw new Error(`provider CSV header changed: ${header.join(",")}`);
  }
  return rows.slice(1).map((values, rowIndex) => {
    if (values.length !== header.length) throw new Error(`CSV row ${rowIndex + 2} has an unexpected field count`);
    return normalizeRow(Object.fromEntries(header.map((field, index) => [field, values[index]])), source, geometry, retrievedAt);
  });
}

function redactedTemplate(source, bbox, days, start) {
  const suffix = start ? `/${start}` : "";
  return `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/${source}/${bbox}/${days}${suffix}`;
}

async function readResponseBytes(response, maximumBytes) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximumBytes) throw new Error("declared response is oversized");
  if (!response.body) throw new Error("provider returned no response body");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new Error("response exceeded the byte limit");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function pause(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function acquire({ id, url, template, rawPath, key, expectOk = true, fetchImpl = globalThis.fetch }) {
  let lastFailure;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const started = performance.now();
    try {
      const response = await fetchImpl(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
        headers: { "user-agent": USER_AGENT, accept: "text/csv,application/json;q=0.9,*/*;q=0.1" }
      });
      const latencyMs = Math.round(performance.now() - started);
      if (response.status >= 300 && response.status < 400) throw new Error("provider returned a redirect");
      const bytes = await readResponseBytes(response, MAXIMUM_RESPONSE_BYTES);
      if (key && bytes.includes(Buffer.from(key))) throw new Error("provider response echoed the protected key");
      if (expectOk && !response.ok) throw new Error(`provider returned HTTP ${response.status}`);
      await mkdir(path.dirname(rawPath), { recursive: true });
      await writeFile(rawPath, bytes, { flag: "wx" });
      return {
        id,
        endpoint_template: template,
        attempt,
        retrieved_at: new Date().toISOString(),
        latency_ms: latencyMs,
        response: {
          status: response.status,
          content_type: response.headers.get("content-type"),
          content_length: response.headers.get("content-length"),
          etag: response.headers.get("etag"),
          last_modified: response.headers.get("last-modified")
        },
        bytes: bytes.length,
        sha256: sha256(bytes),
        raw_path: rawPath,
        body: bytes
      };
    } catch (error) {
      lastFailure = new Error(`${id}: ${error.message}`);
      if (attempt < 3) await pause(attempt * 250);
    }
  }
  throw lastFailure;
}

function responseRecord(acquisition) {
  const record = { ...acquisition };
  delete record.body;
  return { ...record, raw_path: path.relative(process.cwd(), acquisition.raw_path) };
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function numericSummary(values) {
  if (values.length === 0) return { minimum: null, median: null, maximum: null };
  return { minimum: Math.min(...values), median: median(values), maximum: Math.max(...values) };
}

function countsBy(rows, field) {
  return Object.fromEntries([...rows.reduce((counts, row) => {
    counts.set(row[field], (counts.get(row[field]) ?? 0) + 1);
    return counts;
  }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))));
}

function sourceCounts(rows) {
  return Object.fromEntries(SOURCES.map((source) => [source, rows.filter((row) => row.source === source).length]));
}

function uniqueRows(rows) {
  return [...new Map(rows.map((row) => [row.observation_key, row])).values()];
}

export function haversineMetres(left, right) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const lat1 = radians(left.latitude);
  const lat2 = radians(right.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = radians(right.longitude - left.longitude);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 6_371_008.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function crossSensorCandidates(rows) {
  const candidates = [];
  for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
      const left = rows[leftIndex];
      const right = rows[rightIndex];
      if (left.source === right.source) continue;
      const hours = Math.abs(new Date(left.observed_at) - new Date(right.observed_at)) / 3_600_000;
      if (hours > 12) continue;
      const distance = haversineMetres(left, right);
      if (distance <= 750) {
        candidates.push({
          left_observation_key: left.observation_key,
          right_observation_key: right.observation_key,
          distance_metres: Math.round(distance),
          time_difference_hours: Number(hours.toFixed(3))
        });
      }
    }
  }
  return candidates;
}

function persistentQuietCandidates(rows) {
  const clusters = [];
  for (const row of rows) {
    const cluster = clusters.find((candidate) => haversineMetres(candidate.anchor, row) <= 500);
    if (cluster) cluster.rows.push(row);
    else clusters.push({ anchor: row, rows: [row] });
  }
  return clusters.map((cluster) => ({
    latitude: cluster.rows.reduce((sum, row) => sum + row.latitude, 0) / cluster.rows.length,
    longitude: cluster.rows.reduce((sum, row) => sum + row.longitude, 0) / cluster.rows.length,
    observations: cluster.rows.length,
    distinct_days: [...new Set(cluster.rows.map((row) => row.observed_at.slice(0, 10)))].sort(),
    sources: [...new Set(cluster.rows.map((row) => row.source))].sort()
  })).filter((cluster) => cluster.distinct_days.length >= 3);
}

async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(candidate));
    else if (entry.isFile()) files.push(candidate);
  }
  return files;
}

async function assertSecretAbsent(directory, key) {
  const needle = Buffer.from(key);
  for (const file of await filesUnder(directory)) {
    if ((await readFile(file)).includes(needle)) throw new Error(`Protected key found in output ${path.basename(file)}`);
  }
}

function markdownReport(report) {
  const lines = [
    "# FIRMS signal validation for the release-two Blorenge AOI",
    "",
    `Retrieved: ${report.retrieved_at}`,
    "",
    "## Result",
    "",
    `- Validation status: **${report.validation_status}**`,
    `- Implementation recommendation: **${report.implementation_recommendation}**`,
    `- Exact buffered AOI: \`${report.aoi.sha256}\` (${report.aoi.bbox.join(", ")})`,
    `- NASA quota at start: ${report.quota.current_transactions}/${report.quota.transaction_limit} per ${report.quota.transaction_interval}`,
    "",
    "## Measured signal",
    "",
    `- Event window (15 July–3 August 2026): ${report.periods.event.inside_aoi_unique} unique inside-AOI observations.`,
    `- Quiet comparison (15 June–14 July 2026): ${report.periods.quiet.inside_aoi_unique} unique inside-AOI observations.`,
    `- Recent five-day check: ${report.periods.current.inside_aoi_unique} unique inside-AOI observations.`,
    `- Cross-sensor proximity candidates (≤750 m and ≤12 h): ${report.cross_sensor_proximity_candidates.length}. These remain independent observations, not duplicates or fires.`,
    `- Persistent quiet-period clusters (≥3 days within 500 m): ${report.persistent_quiet_candidates.length}.`,
    `- Provider revisions observed across repeated pulls: ${report.revisions.length}.`,
    "",
    "## Required interpretation",
    "",
    "Keep every source observation. Deduplicate only exact repeated pulls by BCA observation key; preserve a changed row fingerprint as a provider revision. Do not spatially merge NOAA-21 and NOAA-20 observations or count points as fires. Empty healthy responses mean only that no qualifying anomaly was returned for the queried sensors and window.",
    ""
  ];
  return lines.join("\n");
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    if (!name?.startsWith("--") || argv[index + 1] === undefined) throw new Error("Arguments must be --name value pairs");
    values[name.slice(2)] = argv[index + 1];
  }
  if (!values.aoi || !values.output) throw new Error("--aoi and --output are required");
  return values;
}

export async function validateSignal({ aoiPath, outputRoot, key, fetchImpl = globalThis.fetch }) {
  if (typeof key !== "string" || key.length < 16 || /\s/.test(key)) throw new Error("FIRMS_MAP_KEY is missing or malformed");
  const aoiDocument = JSON.parse(await readFile(aoiPath, "utf8"));
  if (aoiDocument.features?.length !== 1) throw new Error("Buffered AOI must contain exactly one feature");
  const geometry = aoiDocument.features[0].geometry;
  const bboxValues = aoiDocument.bbox;
  if (!Array.isArray(bboxValues) || bboxValues.length !== 4) throw new Error("Buffered AOI bbox is missing");
  const bbox = bboxValues.map((value) => Number(value.toFixed(7))).join(",");
  const aoiSha = sha256(await readFile(aoiPath));
  await mkdir(path.join(outputRoot, "raw"), { recursive: true });

  const requests = [];
  const observations = [];
  const quotaUrl = `https://firms.modaps.eosdis.nasa.gov/mapserver/mapkey_status/?MAP_KEY=${encodeURIComponent(key)}`;
  const quotaAcquisition = await acquire({
    id: "mapkey-status-start",
    url: quotaUrl,
    template: "https://firms.modaps.eosdis.nasa.gov/mapserver/mapkey_status/?MAP_KEY={MAP_KEY}",
    rawPath: path.join(outputRoot, "raw/mapkey-status-start.json.bin"),
    key,
    fetchImpl
  });
  requests.push(responseRecord(quotaAcquisition));
  const quota = JSON.parse(quotaAcquisition.body.toString("utf8"));
  for (const field of ["transaction_limit", "current_transactions", "transaction_interval"]) {
    if (!(field in quota)) throw new Error(`Map-key status response is missing ${field}`);
  }

  const availabilityUrl = `https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/${encodeURIComponent(key)}/all`;
  const availabilityAcquisition = await acquire({
    id: "data-availability",
    url: availabilityUrl,
    template: "https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/{MAP_KEY}/all",
    rawPath: path.join(outputRoot, "raw/data-availability.csv.bin"),
    key,
    fetchImpl
  });
  requests.push(responseRecord(availabilityAcquisition));
  const availabilityRows = parseCsv(availabilityAcquisition.body.toString("utf8"));
  if (availabilityRows.length < 2 || availabilityRows[0].join(",") !== "data_id,min_date,max_date") {
    throw new Error("Data-availability response schema changed");
  }
  const availability = availabilityRows.slice(1).map(([dataId, minDate, maxDate]) => ({ data_id: dataId, min_date: minDate, max_date: maxDate }));
  for (const source of SOURCES) {
    const record = availability.find((row) => row.data_id === source);
    if (!record || record.min_date > "2026-06-15" || record.max_date < "2026-08-03") {
      throw new Error(`${source} does not advertise the required validation dates`);
    }
  }

  for (const period of PERIODS) {
    for (const source of SOURCES) {
      for (const start of period.windows) {
        const id = `${period.id}-${source}-${start}`;
        const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${source}/${bbox}/5/${start}`;
        const result = await acquire({
          id,
          url,
          template: redactedTemplate(source, bbox, 5, start),
          rawPath: path.join(outputRoot, `raw/${period.id}/${source}/${start}-5.csv.bin`),
          key,
          fetchImpl
        });
        const retrievedAt = new Date(result.retrieved_at);
        const rows = parseDetectionResponse(result.body, source, geometry, retrievedAt);
        requests.push({ ...responseRecord(result), row_count: rows.length });
        for (const row of rows) observations.push({ ...row, period: period.id, query_id: id });
      }
    }
  }

  for (const source of SOURCES) {
    const id = `current-${source}`;
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${source}/${bbox}/5`;
    const result = await acquire({
      id,
      url,
      template: redactedTemplate(source, bbox, 5),
      rawPath: path.join(outputRoot, `raw/current/${source}/recent-5.csv.bin`),
      key,
      fetchImpl
    });
    const rows = parseDetectionResponse(result.body, source, geometry, new Date(result.retrieved_at));
    requests.push({ ...responseRecord(result), row_count: rows.length });
    for (const row of rows) {
      observations.push({ ...row, period: "current", query_id: id });
    }
  }

  for (const source of SOURCES) {
    const start = "2026-07-20";
    const id = `repeat-${source}-${start}`;
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${source}/${bbox}/5/${start}`;
    const result = await acquire({
      id,
      url,
      template: redactedTemplate(source, bbox, 5, start),
      rawPath: path.join(outputRoot, `raw/repeat/${source}/${start}-5.csv.bin`),
      key,
      fetchImpl
    });
    const rows = parseDetectionResponse(result.body, source, geometry, new Date(result.retrieved_at));
    requests.push({ ...responseRecord(result), row_count: rows.length });
    for (const row of rows) {
      observations.push({ ...row, period: "repeat", query_id: id });
    }
  }

  const failureUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/invalid-map-key/VIIRS_NOAA21_NRT/${bbox}/1/2026-07-20`;
  const failureAcquisition = await acquire({
    id: "invalid-key-failure-shape",
    url: failureUrl,
    template: "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{INVALID_MAP_KEY}/VIIRS_NOAA21_NRT/{BBOX}/1/2026-07-20",
    rawPath: path.join(outputRoot, "raw/failure-shapes/invalid-key.bin"),
    key,
    expectOk: false,
    fetchImpl
  });
  requests.push(responseRecord(failureAcquisition));

  const primaryRows = observations.filter((row) => row.period !== "repeat" && row.inside_aoi);
  const periodReports = {};
  for (const period of ["quiet", "event", "current"]) {
    const periodAll = observations.filter((row) => row.period === period);
    const periodInside = uniqueRows(periodAll.filter((row) => row.inside_aoi));
    periodReports[period] = {
      bounding_box_rows: periodAll.length,
      inside_aoi_unique: periodInside.length,
      by_source: sourceCounts(periodInside),
      confidence: countsBy(periodInside, "confidence"),
      daynight: countsBy(periodInside, "daynight"),
      frp: numericSummary(periodInside.map((row) => row.frp)),
      bright_ti4: numericSummary(periodInside.map((row) => row.bright_ti4)),
      bright_ti5: numericSummary(periodInside.map((row) => row.bright_ti5))
    };
  }

  const occurrences = new Map();
  for (const row of observations.filter((candidate) => candidate.inside_aoi)) {
    if (!occurrences.has(row.observation_key)) occurrences.set(row.observation_key, []);
    occurrences.get(row.observation_key).push(row);
  }
  const revisions = [...occurrences.entries()].flatMap(([observationKey, rows]) => {
    const fingerprints = [...new Set(rows.map((row) => row.row_fingerprint))];
    return fingerprints.length > 1 ? [{ observation_key: observationKey, row_fingerprints: fingerprints }] : [];
  });
  const repeatedPullDuplicates = [...occurrences.values()].filter((rows) => rows.length > 1).length;
  const eventRows = uniqueRows(primaryRows.filter((row) => row.period === "event"));
  const quietRows = uniqueRows(primaryRows.filter((row) => row.period === "quiet"));
  const currentRows = uniqueRows(primaryRows.filter((row) => row.period === "current"));
  const latencyValues = requests.filter((request) => request.id !== "invalid-key-failure-shape").map((request) => request.latency_ms);
  const retrievedAt = new Date();
  const currentObservationLagHours = currentRows.map(
    (row) => (retrievedAt.getTime() - new Date(row.observed_at).getTime()) / 3_600_000
  );
  const implementationRecommendation = eventRows.length > 0 ? "go" : "no-go: documented event produced no inside-AOI signal";
  const report = {
    schema_version: "1.0.0",
    retrieved_at: retrievedAt.toISOString(),
    validation_status: "passed",
    implementation_recommendation: implementationRecommendation,
    aoi: { sha256: aoiSha, bbox: bboxValues, clip_rule: "centroid intersects exact EPSG:27700 2 km buffer" },
    sources: SOURCES,
    excluded_sources: ["VIIRS_SNPP_NRT"],
    validation_windows: {
      quiet: { start: "2026-06-15", end: "2026-07-14", days: 30 },
      event: { start: "2026-07-15", end: "2026-08-03", days: 20 },
      current: { days: 5 }
    },
    quota,
    availability: availability.filter((row) => SOURCES.includes(row.data_id)),
    request_latency_ms: numericSummary(latencyValues),
    current_observation_lag_hours: numericSummary(currentObservationLagHours),
    empty_csv_responses: requests.filter((request) => request.row_count === 0).map((request) => request.id),
    periods: periodReports,
    repeated_pull_duplicate_keys: repeatedPullDuplicates,
    revisions,
    cross_sensor_proximity_rule: "different required source, <=750 m and <=12 hours; comparison only, never deduplication",
    cross_sensor_proximity_candidates: crossSensorCandidates(eventRows),
    persistent_quiet_rule: ">=3 distinct days within 500 m; candidates require manual interpretation",
    persistent_quiet_candidates: persistentQuietCandidates(quietRows),
    provider_failure_shape: {
      probe: "deliberately invalid non-secret map key",
      status: failureAcquisition.response.status,
      content_type: failureAcquisition.response.content_type,
      bytes: failureAcquisition.bytes,
      sha256: failureAcquisition.sha256
    },
    recommendation: {
      sources: SOURCES,
      filtering: "Strict schema/value validation and exact AOI centroid clip; retain low-confidence rows and expose confidence without treating it as incident confirmation.",
      deduplication: "Use observation_key only for repeated pulls. Preserve changed row_fingerprint values as revisions. Never spatially deduplicate sensors or passes.",
      public_claim: "A point is a recent satellite thermal-anomaly observation, not a verified incident, exact fire location, perimeter, warning, or evidence that no fire exists when absent."
    }
  };

  const publicObservations = uniqueRows(primaryRows).sort((left, right) => left.observed_at.localeCompare(right.observed_at));
  await writeJson(path.join(outputRoot, "observations.json"), { schema_version: "1.0.0", observations: publicObservations });
  await writeJson(path.join(outputRoot, "report.json"), report);
  await writeFile(path.join(outputRoot, "report.md"), markdownReport(report), { flag: "wx" });
  await writeJson(path.join(outputRoot, "manifest.json"), {
    schema_version: "1.0.0",
    generated_at: report.retrieved_at,
    aoi_sha256: aoiSha,
    requests,
    outputs: {
      observations_sha256: sha256(await readFile(path.join(outputRoot, "observations.json"))),
      report_json_sha256: sha256(await readFile(path.join(outputRoot, "report.json"))),
      report_markdown_sha256: sha256(await readFile(path.join(outputRoot, "report.md")))
    }
  });
  await assertSecretAbsent(outputRoot, key);
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arguments_ = parseArguments(process.argv.slice(2));
  await validateSignal({
    aoiPath: path.resolve(arguments_.aoi),
    outputRoot: path.resolve(arguments_.output),
    key: process.env.FIRMS_MAP_KEY
  });
}
