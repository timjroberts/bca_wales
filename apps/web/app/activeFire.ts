export type ActiveFireHealth = "loading" | "current" | "degraded" | "stale" | "outage" | "withdrawn" | "error";

export type ActiveFireObservation = Readonly<{
  observation_key: string;
  source: "VIIRS_NOAA21_NRT" | "VIIRS_NOAA20_NRT";
  sensor: "NOAA-21" | "NOAA-20";
  observed_at: string;
  latitude: number;
  longitude: number;
  confidence: string;
  frp_mw: number;
  daynight: "D" | "N";
  nominal_pixel_metres: 375;
}>;

export type ActiveFireFeatureCollection = Readonly<{
  type: "FeatureCollection";
  features: readonly Readonly<{
    type: "Feature";
    id: string;
    geometry: Readonly<{ type: "Point"; coordinates: readonly [number, number] }>;
    properties: Omit<ActiveFireObservation, "latitude" | "longitude">;
  }>[];
}>;

type AssetReference = Readonly<{ key: string; url: string; sha256: string }>;

type ActiveFirePointer = Readonly<{
  schema_version: "1.0.0";
  status: "current" | "degraded" | "stale" | "withdrawn";
  source_state?: "complete" | "degraded";
  map?: AssetReference;
  history?: AssetReference;
  accessible_table?: AssetReference;
  contract?: AssetReference;
  last_attempted_at?: string;
  last_complete_success_at?: string | null;
  published_at?: string;
  latest_observation_at?: string | null;
  source_observation_times?: Readonly<Record<string, string | null>>;
  stale_after?: string;
  hide_default_after?: string;
  counts?: Readonly<{ map_24h: number; history_30d: number }>;
  allow_healthy_empty_message?: boolean;
}>;

type ActiveFireStatusDocument = Readonly<{
  status?: ActiveFireHealth;
  last_attempted_at?: string;
}>;

type ActiveFireContract = Readonly<{
  title: Readonly<{ en: string; cy: string }>;
  attribution: string;
  healthy_empty_message: Readonly<{ en: string; cy: string }> | null;
  limitations: Readonly<{ en: readonly string[]; cy: readonly string[] }>;
}>;

export type ActiveFireState = Readonly<{
  health: ActiveFireHealth;
  sourceState: "complete" | "degraded" | null;
  map: ActiveFireFeatureCollection;
  history: readonly ActiveFireObservation[];
  mapVisible: boolean;
  counts: Readonly<{ map24h: number; history30d: number }>;
  lastAttemptedAt: string | null;
  lastCompleteSuccessAt: string | null;
  publishedAt: string | null;
  latestObservationAt: string | null;
  sourceObservationTimes: Readonly<Record<string, string | null>>;
  accessibleTableUrl: string | null;
  contract: ActiveFireContract | null;
  error: string | null;
}>;

const EMPTY_MAP: ActiveFireFeatureCollection = { type: "FeatureCollection", features: [] };

export const INITIAL_ACTIVE_FIRE_STATE: ActiveFireState = {
  health: "loading",
  sourceState: null,
  map: EMPTY_MAP,
  history: [],
  mapVisible: false,
  counts: { map24h: 0, history30d: 0 },
  lastAttemptedAt: null,
  lastCompleteSuccessAt: null,
  publishedAt: null,
  latestObservationAt: null,
  sourceObservationTimes: {},
  accessibleTableUrl: null,
  contract: null,
  error: null
};

function isDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function safeReferenceUrl(origin: string, reference: AssetReference | undefined, prefix: string): string {
  if (!reference || !reference.key.startsWith(prefix) || !/^[0-9a-f]{64}$/.test(reference.sha256)) {
    throw new Error("The feed pointer contains an invalid asset reference.");
  }
  const base = new URL(origin);
  const url = new URL(reference.url);
  if (![base.origin, "https://assets.bca.wales"].includes(url.origin) || url.pathname !== `/${reference.key}`) {
    throw new Error("The feed pointer refers to an unexpected asset origin.");
  }
  return new URL(`/${reference.key}`, base).toString();
}

async function fetchJson<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url, {
    headers: { accept: "application/json, application/geo+json" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Feed request failed with HTTP ${response.status}.`);
  return await response.json() as T;
}

function effectiveHealth(pointer: ActiveFirePointer, status: ActiveFireStatusDocument, now: Date): ActiveFireHealth {
  if (pointer.status === "withdrawn" || status.status === "withdrawn") return "withdrawn";
  if (status.status === "outage") return "outage";
  if (!isDate(pointer.stale_after) || now >= new Date(pointer.stale_after)) return "stale";
  if (pointer.status === "stale" || status.status === "stale") return "stale";
  if (pointer.source_state === "degraded" || pointer.status === "degraded" || status.status === "degraded") return "degraded";
  return "current";
}

function assertPointer(value: ActiveFirePointer): void {
  if (value.schema_version !== "1.0.0" || !["current", "degraded", "stale", "withdrawn"].includes(value.status)) {
    throw new Error("The feed pointer schema is not recognised.");
  }
}

function assertMap(value: ActiveFireFeatureCollection): void {
  if (value.type !== "FeatureCollection" || !Array.isArray(value.features)) throw new Error("The 24-hour map has an invalid schema.");
  for (const feature of value.features) {
    if (feature.geometry?.type !== "Point" || !["NOAA-20", "NOAA-21"].includes(feature.properties?.sensor)) {
      throw new Error("The 24-hour map contains an invalid observation.");
    }
  }
}

export async function loadActiveFireFeed({
  origin,
  currentPath,
  statusPath,
  fetchImpl = fetch,
  now = new Date()
}: {
  origin: string;
  currentPath: string;
  statusPath: string;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<ActiveFireState> {
  const base = origin.replace(/\/$/, "");
  try {
    const [pointer, status] = await Promise.all([
      fetchJson<ActiveFirePointer>(`${base}${currentPath}`, fetchImpl),
      fetchJson<ActiveFireStatusDocument>(`${base}${statusPath}`, fetchImpl)
    ]);
    assertPointer(pointer);
    const health = effectiveHealth(pointer, status, now);
    if (health === "withdrawn") return { ...INITIAL_ACTIVE_FIRE_STATE, health, error: "The operational feed has been withdrawn." };

    const mapUrl = safeReferenceUrl(base, pointer.map, "active-fire/runs/");
    const historyUrl = safeReferenceUrl(base, pointer.history, "active-fire/runs/");
    const contractUrl = safeReferenceUrl(base, pointer.contract, "active-fire/runs/");
    const accessibleTableUrl = safeReferenceUrl(base, pointer.accessible_table, "active-fire/runs/");
    const [mapDocument, historyDocument, contract] = await Promise.all([
      fetchJson<ActiveFireFeatureCollection>(mapUrl, fetchImpl),
      fetchJson<{ observations?: ActiveFireObservation[] }>(historyUrl, fetchImpl),
      fetchJson<ActiveFireContract>(contractUrl, fetchImpl)
    ]);
    assertMap(mapDocument);
    if (!Array.isArray(historyDocument.observations)) throw new Error("The 30-day history has an invalid schema.");
    const mapVisible = isDate(pointer.hide_default_after) && now < new Date(pointer.hide_default_after);

    return {
      health,
      sourceState: pointer.source_state ?? null,
      map: mapVisible ? mapDocument : EMPTY_MAP,
      history: historyDocument.observations,
      mapVisible,
      counts: { map24h: pointer.counts?.map_24h ?? mapDocument.features.length, history30d: pointer.counts?.history_30d ?? historyDocument.observations.length },
      lastAttemptedAt: status.last_attempted_at ?? pointer.last_attempted_at ?? null,
      lastCompleteSuccessAt: pointer.last_complete_success_at ?? null,
      publishedAt: pointer.published_at ?? null,
      latestObservationAt: pointer.latest_observation_at ?? null,
      sourceObservationTimes: pointer.source_observation_times ?? {},
      accessibleTableUrl,
      contract,
      error: null
    };
  } catch (error) {
    return {
      ...INITIAL_ACTIVE_FIRE_STATE,
      health: "error",
      error: error instanceof Error ? error.message : "The operational feed could not be loaded."
    };
  }
}
