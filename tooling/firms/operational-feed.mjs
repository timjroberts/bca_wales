import { createHash } from "node:crypto";
import { SOURCES, REQUIRED_FIELDS, normalizeRow, parseCsv } from "./validate-signal.mjs";

export const CURRENT_KEY = "active-fire/current.json";
export const STATUS_KEY = "active-fire/status.json";
export const HISTORY_DAYS = 30;
export const MAP_WINDOW_HOURS = 24;
export const STALE_HOURS = 12;
export const HIDE_DEFAULT_HOURS = 24;
export const MAXIMUM_RESPONSE_BYTES = 5_000_000;
export const ATTRIBUTION = "Data: NASA FIRMS, VIIRS NOAA-21 and NOAA-20. Clipped and reformatted by Blorenge Commoners Association.";

const SOURCE_LABELS = {
  VIIRS_NOAA21_NRT: "NOAA-21",
  VIIRS_NOAA20_NRT: "NOAA-20"
};

function canonicalise(value) {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalise(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return `${JSON.stringify(canonicalise(value), null, 2)}\n`;
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function addHours(iso, hours) {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function safeError(error) {
  return String(error?.message ?? error)
    .replace(/MAP_KEY=[^&\s]+/gi, "MAP_KEY={REDACTED}")
    .replace(/\/api\/area\/csv\/[^/\s]+\//g, "/api/area/csv/{REDACTED}/")
    .slice(0, 500);
}

function isCsvContentType(value) {
  const contentType = value?.toLowerCase() ?? "";
  return contentType.startsWith("text/csv") || contentType.startsWith("text/plain");
}

function runId(attemptedAt) {
  return attemptedAt.replace(/\.\d{3}Z$/, "Z").replaceAll(":", "-");
}

function assertObjectKey(key) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]+$/.test(key) || key.includes("..")) {
    throw new Error(`Unsafe object key: ${key}`);
  }
}

async function readJsonObject(store, key) {
  assertObjectKey(key);
  const bytes = await store.get(key);
  if (bytes === null) return null;
  return JSON.parse(bytes.toString("utf8"));
}

async function putImmutable(store, key, bytes, contentType) {
  assertObjectKey(key);
  const expected = sha256(bytes);
  const existing = await store.get(key);
  if (existing !== null) {
    if (sha256(existing) !== expected) throw new Error(`${key}: immutable object differs`);
    return { key, bytes: bytes.length, sha256: expected, uploaded: false, content_type: contentType };
  }
  await store.put(key, bytes, contentType);
  const verified = await store.get(key);
  if (verified === null || sha256(verified) !== expected) throw new Error(`${key}: upload verification failed`);
  return { key, bytes: bytes.length, sha256: expected, uploaded: true, content_type: contentType };
}

async function putMutable(store, key, value) {
  const bytes = Buffer.from(canonicalJson(value));
  await store.put(key, bytes, "application/json");
  const verified = await store.get(key);
  if (verified === null || sha256(verified) !== sha256(bytes)) throw new Error(`${key}: pointer verification failed`);
  return { key, bytes: bytes.length, sha256: sha256(bytes) };
}

async function readLimitedBody(response) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAXIMUM_RESPONSE_BYTES) throw new Error("declared response is oversized");
  if (!response.body) throw new Error("provider returned no response body");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAXIMUM_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("response exceeded the byte limit");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function fetchWithRetry(url, { fetchImpl, accept, attempts = 3 }) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const started = performance.now();
    try {
      const response = await fetchImpl(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
        headers: { accept, "user-agent": "bca-wales-firms-feed/1.0" }
      });
      if (response.status >= 300 && response.status < 400) throw new Error("provider returned a redirect");
      const bytes = await readLimitedBody(response);
      return {
        bytes,
        attempt,
        latency_ms: Math.round(performance.now() - started),
        response: {
          status: response.status,
          content_type: response.headers.get("content-type"),
          content_length: response.headers.get("content-length"),
          etag: response.headers.get("etag"),
          last_modified: response.headers.get("last-modified")
        }
      };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

export function parseSourceCsv(bytes, source, geometry, retrievedAt) {
  const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
  if (/^\s*</.test(text)) throw new Error("provider returned HTML instead of CSV");
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error("provider returned an empty body without a CSV header");
  const header = rows[0];
  if (header.length !== REQUIRED_FIELDS.length || header.some((field, index) => field !== REQUIRED_FIELDS[index])) {
    throw new Error(`provider CSV header changed: ${header.join(",")}`);
  }
  return rows.slice(1).map((values, index) => {
    if (values.length !== header.length) throw new Error(`CSV row ${index + 2} has an unexpected field count`);
    const row = Object.fromEntries(header.map((field, fieldIndex) => [field, values[fieldIndex]]));
    return normalizeRow(row, source, geometry, retrievedAt);
  }).filter((row) => row.inside_aoi).map((row) => {
    const normalized = { ...row };
    delete normalized.inside_aoi;
    return normalized;
  });
}

function validateAvailability(bytes, attemptedAt) {
  const rows = parseCsv(bytes.toString("utf8"));
  if (rows.length < 2 || rows[0].join(",") !== "data_id,min_date,max_date") {
    throw new Error("data-availability response schema changed");
  }
  const latestAcceptable = new Date(new Date(attemptedAt).getTime() - 72 * 60 * 60 * 1000);
  const required = new Map(rows.slice(1).map(([source, minimum, maximum]) => [source, { minimum, maximum }]));
  for (const source of SOURCES) {
    const availability = required.get(source);
    if (!availability || !/^\d{4}-\d{2}-\d{2}$/.test(availability.maximum)) {
      throw new Error(`${source}: missing provider availability`);
    }
    if (new Date(`${availability.maximum}T23:59:59Z`) < latestAcceptable) {
      throw new Error(`${source}: provider availability is more than 72 hours behind`);
    }
  }
  return Object.fromEntries(SOURCES.map((source) => [source, required.get(source)]));
}

function validateQuota(bytes) {
  const quota = JSON.parse(bytes.toString("utf8"));
  for (const field of ["current_transactions", "transaction_limit", "transaction_interval"]) {
    if (!(field in quota)) throw new Error(`map-key status is missing ${field}`);
  }
  if (!Number.isFinite(Number(quota.current_transactions)) || !Number.isFinite(Number(quota.transaction_limit))) {
    throw new Error("map-key status contains invalid counts");
  }
  if (Number(quota.transaction_limit) - Number(quota.current_transactions) < 20) {
    throw new Error("FIRMS transaction quota has less than 20 requests remaining");
  }
  return {
    current_transactions: Number(quota.current_transactions),
    transaction_limit: Number(quota.transaction_limit),
    transaction_interval: String(quota.transaction_interval)
  };
}

async function acquireProviderInputs({ key, bbox, geometry, attemptedAt, fetchImpl }) {
  const encodedKey = encodeURIComponent(key);
  const bboxText = bbox.join(",");
  const requests = [
    {
      id: "mapkey-status",
      template: "https://firms.modaps.eosdis.nasa.gov/mapserver/mapkey_status/?MAP_KEY={MAP_KEY}",
      url: `https://firms.modaps.eosdis.nasa.gov/mapserver/mapkey_status/?MAP_KEY=${encodedKey}`,
      accept: "application/json"
    },
    {
      id: "data-availability",
      template: "https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/{MAP_KEY}/all",
      url: `https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/${encodedKey}/all`,
      accept: "text/csv"
    },
    ...SOURCES.map((source) => ({
      id: source,
      source,
      template: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/${source}/${bboxText}/5`,
      url: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodedKey}/${source}/${bboxText}/5`,
      accept: "text/csv"
    }))
  ];
  const acquisitions = await Promise.all(requests.map(async (request) => {
    try {
      const acquisition = await fetchWithRetry(request.url, { fetchImpl, accept: request.accept });
      if (acquisition.bytes.includes(Buffer.from(key))) throw new Error("provider response echoed the protected key");
      return { ...request, ...acquisition, ok: acquisition.response.status >= 200 && acquisition.response.status < 300 };
    } catch (error) {
      return { ...request, ok: false, error: safeError(error), bytes: null };
    }
  }));

  const byId = new Map(acquisitions.map((acquisition) => [acquisition.id, acquisition]));
  let quota = null;
  let availability = null;
  try {
    const acquisition = byId.get("mapkey-status");
    if (!acquisition.ok) throw new Error(acquisition.error ?? `provider returned HTTP ${acquisition.response?.status}`);
    if (!acquisition.response.content_type?.toLowerCase().includes("json")) throw new Error("map-key status returned an unexpected content type");
    quota = validateQuota(acquisition.bytes);
  } catch (error) {
    byId.get("mapkey-status").validation_error = safeError(error);
  }
  try {
    const acquisition = byId.get("data-availability");
    if (!acquisition.ok) throw new Error(acquisition.error ?? `provider returned HTTP ${acquisition.response?.status}`);
    if (!isCsvContentType(acquisition.response.content_type)) throw new Error("data availability returned an unexpected content type");
    availability = validateAvailability(acquisition.bytes, attemptedAt);
  } catch (error) {
    byId.get("data-availability").validation_error = safeError(error);
  }

  const retrievedAt = new Date(attemptedAt);
  for (const source of SOURCES) {
    const acquisition = byId.get(source);
    try {
      if (!acquisition.ok) throw new Error(acquisition.error ?? `provider returned HTTP ${acquisition.response?.status}`);
      if (!isCsvContentType(acquisition.response.content_type)) throw new Error("provider returned an unexpected content type");
      acquisition.rows = parseSourceCsv(acquisition.bytes, source, geometry, retrievedAt);
      acquisition.valid = true;
    } catch (error) {
      acquisition.valid = false;
      acquisition.validation_error = safeError(error);
      acquisition.rows = [];
    }
  }
  return { acquisitions, quota, availability };
}

function observationForPublic(row) {
  return {
    observation_key: row.observation_key,
    row_fingerprint: row.row_fingerprint,
    source: row.source,
    sensor: SOURCE_LABELS[row.source],
    observed_at: row.observed_at,
    latitude: row.latitude,
    longitude: row.longitude,
    confidence: row.confidence,
    frp_mw: row.frp,
    daynight: row.daynight,
    nominal_pixel_metres: 375,
    revision_count: row.revision_count ?? 0,
    previous_row_fingerprint: row.previous_row_fingerprint ?? null
  };
}

function mergeHistory(previous, fresh, attemptedAt) {
  const cutoff = new Date(new Date(attemptedAt).getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const merged = new Map(previous.map((row) => [row.observation_key, row]));
  for (const row of fresh) {
    const old = merged.get(row.observation_key);
    if (old && old.row_fingerprint !== row.row_fingerprint) {
      merged.set(row.observation_key, {
        ...observationForPublic(row),
        revision_count: (old.revision_count ?? 0) + 1,
        previous_row_fingerprint: old.row_fingerprint
      });
    } else if (!old) merged.set(row.observation_key, observationForPublic(row));
  }
  return [...merged.values()]
    .filter((row) => new Date(row.observed_at) >= cutoff && new Date(row.observed_at) <= new Date(attemptedAt))
    .sort((left, right) => left.observed_at.localeCompare(right.observed_at) || left.observation_key.localeCompare(right.observation_key));
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function accessibleCsv(rows) {
  const fields = ["observed_at", "sensor", "confidence", "frp_mw", "daynight", "latitude", "longitude", "nominal_pixel_metres", "observation_key"];
  return `${[fields.join(","), ...rows.map((row) => fields.map((field) => csvCell(row[field])).join(","))].join("\r\n")}\r\n`;
}

function buildGeoJson(rows) {
  return {
    type: "FeatureCollection",
    features: rows.map((row) => ({
      type: "Feature",
      id: row.observation_key,
      geometry: { type: "Point", coordinates: [row.longitude, row.latitude] },
      properties: Object.fromEntries(Object.entries(row).filter(([key]) => !["latitude", "longitude"].includes(key)))
    }))
  };
}

function bilingualContract({ allowHealthyEmpty }) {
  return {
    title: { en: "Recent satellite thermal anomalies", cy: "Anomaleddau thermol lloeren diweddar" },
    attribution: ATTRIBUTION,
    healthy_empty_message: allowHealthyEmpty ? {
      en: "No qualifying satellite thermal anomalies were returned for this area and time window.",
      cy: "Ni ddychwelwyd unrhyw anomaleddau thermol lloeren cymwys ar gyfer yr ardal a'r cyfnod hwn."
    } : null,
    limitations: {
      en: [
        "A point is the centre of a nominal approximately 375 m observation pixel, not an exact heat or fire location or extent.",
        "A detection is not a verified incident, perimeter, warning, severity measure or forecast.",
        "Cloud, smoke, overpass timing, outages and anomaly size or temperature can cause omissions; non-fire sources and artefacts can cause detections.",
        "Absence of detections is not evidence that no fire exists. Do not travel to investigate. Report immediate danger through 999 or 112."
      ],
      cy: [
        "Canol picsel arsylwi enwol tua 375 m yw pwynt, nid union leoliad nac arwynebedd gwres neu dân.",
        "Nid digwyddiad wedi'i gadarnhau, terfyn, rhybudd, mesur difrifoldeb na rhagolwg yw canfyddiad.",
        "Gall cymylau, mwg, amser pasio, toriadau a maint neu dymheredd anomaledd achosi bylchau; gall ffynonellau nad ydynt yn dân ac arteffactau achosi canfyddiadau.",
        "Nid yw diffyg canfyddiadau'n dystiolaeth nad oes tân. Peidiwch â theithio i ymchwilio. Rhowch wybod am berygl uniongyrchol drwy 999 neu 112."
      ]
    }
  };
}

function acquisitionRecord(acquisition, prefix) {
  return {
    id: acquisition.id,
    source: acquisition.source ?? null,
    endpoint_template: acquisition.template,
    ok: acquisition.ok,
    valid: acquisition.valid ?? null,
    attempt: acquisition.attempt ?? null,
    latency_ms: acquisition.latency_ms ?? null,
    response: acquisition.response ?? null,
    bytes: acquisition.bytes?.length ?? 0,
    sha256: acquisition.bytes ? sha256(acquisition.bytes) : null,
    raw_key: acquisition.bytes ? `${prefix}/raw/${acquisition.id}.bin` : null,
    row_count_inside_aoi: acquisition.rows?.length ?? null,
    error: acquisition.validation_error ?? acquisition.error ?? null
  };
}

async function previousState(store) {
  const pointer = await readJsonObject(store, CURRENT_KEY);
  if (!pointer || pointer.status === "withdrawn") return { pointer, history: [] };
  if (!pointer.history?.key || !/^[0-9a-f]{64}$/.test(pointer.history.sha256)) {
    throw new Error("current feed pointer has an invalid history reference");
  }
  const bytes = await store.get(pointer.history.key);
  if (bytes === null || sha256(bytes) !== pointer.history.sha256) throw new Error("current feed history failed checksum validation");
  const history = JSON.parse(bytes.toString("utf8"));
  if (!Array.isArray(history.observations)) throw new Error("current feed history has an invalid schema");
  return { pointer, history: history.observations };
}

export async function publishOperationalFeed({
  store,
  mapKey,
  aoi,
  aoiMetadata,
  assetOrigin = "https://assets.bca.wales",
  fetchImpl = globalThis.fetch,
  clock = () => new Date()
}) {
  if (!mapKey) throw new Error("FIRMS_MAP_KEY is required");
  const attemptedAt = clock().toISOString();
  const id = runId(attemptedAt);
  const prefix = `active-fire/runs/${id}`;
  const geometry = aoi?.features?.[0]?.geometry;
  if (!geometry || !Array.isArray(aoiMetadata?.aoi?.bbox) || aoiMetadata.core?.version !== "2026-08-21.1") {
    throw new Error("pinned release-two AOI contract is invalid");
  }
  const { pointer: previousPointer, history: previousHistory } = await previousState(store);
  const acquired = await acquireProviderInputs({
    key: mapKey,
    bbox: aoiMetadata.aoi.bbox,
    geometry,
    attemptedAt,
    fetchImpl
  });
  const rawUploads = [];
  for (const acquisition of acquired.acquisitions) {
    if (acquisition.bytes) rawUploads.push(await putImmutable(store, `${prefix}/raw/${acquisition.id}.bin`, acquisition.bytes, "application/octet-stream"));
  }
  const acquisitions = acquired.acquisitions.map((item) => acquisitionRecord(item, prefix));
  const sourceAcquisitions = acquired.acquisitions.filter((item) => SOURCES.includes(item.id));
  const validSources = sourceAcquisitions.filter((item) => item.valid);
  const providerChecksPassed = acquired.quota !== null && acquired.availability !== null;
  const statusBase = {
    schema_version: "1.0.0",
    feed: "recent-satellite-thermal-anomalies",
    last_attempted_at: attemptedAt,
    last_successful_at: previousPointer?.last_complete_success_at ?? null,
    last_complete_success_at: previousPointer?.last_complete_success_at ?? null,
    last_published_at: previousPointer?.published_at ?? null,
    current_pointer_url: `${assetOrigin.replace(/\/$/, "")}/${CURRENT_KEY}`,
    stale_after_hours: STALE_HOURS,
    hide_default_after_hours: HIDE_DEFAULT_HOURS
  };

  if (!providerChecksPassed || validSources.length === 0) {
    const manifest = {
      schema_version: "1.0.0",
      run_id: id,
      outcome: "outage",
      attempted_at: attemptedAt,
      aoi: aoiMetadata,
      quota: acquired.quota,
      availability: acquired.availability,
      acquisitions,
      immutable_retention_days_minimum: 90
    };
    const manifestUpload = await putImmutable(store, `${prefix}/manifest.json`, Buffer.from(canonicalJson(manifest)), "application/json");
    const status = { ...statusBase, status: "outage", run_manifest: manifestUpload, message: "Latest acquisition failed; the last verified feed pointer remains unchanged." };
    await putMutable(store, STATUS_KEY, status);
    return { status, manifest, pointer: previousPointer, published: false };
  }

  const fresh = validSources.flatMap((item) => item.rows);
  const historyRows = mergeHistory(previousHistory, fresh, attemptedAt);
  const mapCutoff = new Date(new Date(attemptedAt).getTime() - MAP_WINDOW_HOURS * 60 * 60 * 1000);
  const mapRows = historyRows.filter((row) => new Date(row.observed_at) >= mapCutoff);
  const sourceState = validSources.length === SOURCES.length ? "complete" : "degraded";
  const completeSuccessAt = sourceState === "complete" ? attemptedAt : previousPointer?.last_complete_success_at ?? null;
  const stale = completeSuccessAt === null || new Date(attemptedAt).getTime() - new Date(completeSuccessAt).getTime() >= STALE_HOURS * 60 * 60 * 1000;
  const health = stale ? "stale" : sourceState === "complete" ? "current" : "degraded";
  const sourceTimes = Object.fromEntries(SOURCES.map((source) => {
    const rows = historyRows.filter((row) => row.source === source);
    return [source, rows.at(-1)?.observed_at ?? null];
  }));
  const contract = bilingualContract({ allowHealthyEmpty: sourceState === "complete" });
  const historyDocument = {
    schema_version: "1.0.0",
    title: contract.title,
    generated_at: attemptedAt,
    window_days: HISTORY_DAYS,
    observations: historyRows
  };
  const mapDocument = {
    ...buildGeoJson(mapRows),
    metadata: {
      schema_version: "1.0.0",
      title: contract.title,
      generated_at: attemptedAt,
      window_hours: MAP_WINDOW_HOURS,
      health,
      source_state: sourceState,
      observation_count: mapRows.length,
      attribution: ATTRIBUTION,
      healthy_empty_message: contract.healthy_empty_message,
      limitations: contract.limitations
    }
  };
  const artifacts = [
    ["history.json", Buffer.from(canonicalJson(historyDocument)), "application/json"],
    ["history.csv", Buffer.from(accessibleCsv(historyRows)), "text/csv; charset=utf-8"],
    ["map-24h.geojson", Buffer.from(canonicalJson(mapDocument)), "application/geo+json"],
    ["contract.json", Buffer.from(canonicalJson(contract)), "application/json"]
  ];
  const uploads = [...rawUploads];
  const references = {};
  for (const [name, bytes, contentType] of artifacts) {
    const upload = await putImmutable(store, `${prefix}/${name}`, bytes, contentType);
    uploads.push(upload);
    references[name] = { key: upload.key, url: `${assetOrigin.replace(/\/$/, "")}/${upload.key}`, bytes: upload.bytes, sha256: upload.sha256 };
  }
  const normalizedUploads = {};
  for (const acquisition of validSources) {
    const bytes = Buffer.from(canonicalJson({ schema_version: "1.0.0", source: acquisition.source, retrieved_at: attemptedAt, observations: acquisition.rows.map(observationForPublic) }));
    const upload = await putImmutable(store, `${prefix}/normalized/${acquisition.source}.json`, bytes, "application/json");
    uploads.push(upload);
    normalizedUploads[acquisition.source] = upload;
  }
  const manifest = {
    schema_version: "1.0.0",
    run_id: id,
    outcome: health,
    source_state: sourceState,
    attempted_at: attemptedAt,
    published_at: attemptedAt,
    aoi: aoiMetadata,
    quota: acquired.quota,
    availability: acquired.availability,
    acquisitions,
    normalized: normalizedUploads,
    assets: references,
    counts: { map_24h: mapRows.length, history_30d: historyRows.length },
    latest_observation_at: historyRows.at(-1)?.observed_at ?? null,
    source_observation_times: sourceTimes,
    immutable_retention_days_minimum: 90
  };
  const manifestUpload = await putImmutable(store, `${prefix}/manifest.json`, Buffer.from(canonicalJson(manifest)), "application/json");
  uploads.push(manifestUpload);
  const pointer = {
    schema_version: "1.0.0",
    status: health,
    source_state: sourceState,
    run_id: id,
    manifest: { key: manifestUpload.key, url: `${assetOrigin.replace(/\/$/, "")}/${manifestUpload.key}`, sha256: manifestUpload.sha256 },
    map: references["map-24h.geojson"],
    history: references["history.json"],
    accessible_table: references["history.csv"],
    contract: references["contract.json"],
    last_attempted_at: attemptedAt,
    last_complete_success_at: completeSuccessAt,
    last_successful_at: completeSuccessAt,
    published_at: attemptedAt,
    latest_observation_at: historyRows.at(-1)?.observed_at ?? null,
    source_observation_times: sourceTimes,
    stale_after: completeSuccessAt ? addHours(completeSuccessAt, STALE_HOURS) : attemptedAt,
    hide_default_after: completeSuccessAt ? addHours(completeSuccessAt, HIDE_DEFAULT_HOURS) : attemptedAt,
    counts: manifest.counts,
    allow_healthy_empty_message: sourceState === "complete"
  };
  await putMutable(store, CURRENT_KEY, pointer);
  const status = {
    ...statusBase,
    status: health,
    source_state: sourceState,
    last_complete_success_at: completeSuccessAt,
    last_successful_at: completeSuccessAt,
    last_published_at: attemptedAt,
    latest_observation_at: pointer.latest_observation_at,
    source_observation_times: sourceTimes,
    stale_after: pointer.stale_after,
    hide_default_after: pointer.hide_default_after,
    run_manifest: pointer.manifest
  };
  await putMutable(store, STATUS_KEY, status);
  return { status, manifest, pointer, uploads, published: true };
}

export async function withdrawOperationalFeed({ store, reason, clock = () => new Date() }) {
  if (!reason?.trim()) throw new Error("A withdrawal reason is required");
  const current = await readJsonObject(store, CURRENT_KEY);
  if (!current || current.status === "withdrawn") throw new Error("There is no active feed pointer to withdraw");
  const withdrawnAt = clock().toISOString();
  const record = { schema_version: "1.0.0", withdrawn_at: withdrawnAt, reason: reason.trim(), previous_pointer: current };
  const key = `active-fire/withdrawals/${runId(withdrawnAt)}.json`;
  const upload = await putImmutable(store, key, Buffer.from(canonicalJson(record)), "application/json");
  const pointer = { schema_version: "1.0.0", status: "withdrawn", withdrawn_at: withdrawnAt, reason: reason.trim(), recovery_record: upload };
  await putMutable(store, CURRENT_KEY, pointer);
  await putMutable(store, STATUS_KEY, { ...pointer, last_attempted_at: withdrawnAt });
  return { record, pointer };
}

export async function restoreOperationalFeed({ store, withdrawalKey }) {
  const current = await readJsonObject(store, CURRENT_KEY);
  if (current?.status !== "withdrawn") throw new Error("Feed is not withdrawn");
  const record = await readJsonObject(store, withdrawalKey);
  const replacement = record?.previous_pointer;
  if (!replacement?.manifest?.key || !replacement.manifest.sha256) throw new Error("Withdrawal record has no valid recovery pointer");
  const manifest = await store.get(replacement.manifest.key);
  if (manifest === null || sha256(manifest) !== replacement.manifest.sha256) throw new Error("Recovery manifest failed checksum verification");
  for (const reference of [replacement.map, replacement.history, replacement.accessible_table, replacement.contract]) {
    const bytes = await store.get(reference.key);
    if (bytes === null || sha256(bytes) !== reference.sha256) throw new Error(`${reference.key}: recovery asset failed checksum verification`);
  }
  await putMutable(store, CURRENT_KEY, replacement);
  await putMutable(store, STATUS_KEY, {
    schema_version: "1.0.0",
    status: replacement.status,
    source_state: replacement.source_state,
    last_attempted_at: replacement.last_attempted_at,
    last_complete_success_at: replacement.last_complete_success_at,
    last_successful_at: replacement.last_complete_success_at,
    last_published_at: replacement.published_at,
    latest_observation_at: replacement.latest_observation_at,
    source_observation_times: replacement.source_observation_times,
    stale_after: replacement.stale_after,
    hide_default_after: replacement.hide_default_after,
    run_manifest: replacement.manifest
  });
  return replacement;
}
