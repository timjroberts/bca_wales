import assert from "node:assert/strict";
import test from "node:test";
import {
  CURRENT_KEY,
  STATUS_KEY,
  publishOperationalFeed,
  restoreOperationalFeed,
  withdrawOperationalFeed
} from "../tooling/firms/operational-feed.mjs";
import { REQUIRED_FIELDS } from "../tooling/firms/validate-signal.mjs";

class MemoryStore {
  constructor() {
    this.objects = new Map();
    this.failPattern = null;
  }

  async get(key) {
    const value = this.objects.get(key);
    return value ? Buffer.from(value) : null;
  }

  async put(key, bytes) {
    if (this.failPattern?.test(key)) throw new Error(`simulated upload failure for ${key}`);
    this.objects.set(key, Buffer.from(bytes));
  }
}

const aoi = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[[-3.1, 51.7], [-2.9, 51.7], [-2.9, 51.9], [-3.1, 51.9], [-3.1, 51.7]]]
    },
    properties: {}
  }]
};

const metadata = {
  schema_version: "1.0.0",
  core: { version: "2026-08-21.1", sha256: "a".repeat(64) },
  aoi: { bbox: [-3.1, 51.7, -2.9, 51.9], sha256: "b".repeat(64) },
  derivation: { buffer_distance_metres: 2000, projected_crs: "EPSG:27700" }
};

function csvRow({ satellite, latitude = "51.8", longitude = "-3", date = "2026-08-22", time = "0500" }) {
  const values = {
    latitude,
    longitude,
    bright_ti4: "321.1",
    scan: "0.4",
    track: "0.4",
    acq_date: date,
    acq_time: time,
    satellite,
    instrument: "VIIRS",
    confidence: "nominal",
    version: "2.0NRT",
    bright_ti5: "289.4",
    frp: "4.2",
    daynight: "D"
  };
  return REQUIRED_FIELDS.map((field) => values[field]).join(",");
}

function csv(...rows) {
  return `${REQUIRED_FIELDS.join(",")}\n${rows.join("\n")}${rows.length ? "\n" : ""}`;
}

function provider({ failedSources = [], malformedSources = [], sourceRows = {} } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes("mapkey_status")) {
      return new Response(JSON.stringify({ current_transactions: 100, transaction_limit: 5000, transaction_interval: "10 minutes" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (url.includes("data_availability")) {
      return new Response("data_id,min_date,max_date\nVIIRS_NOAA21_NRT,2026-01-01,2026-08-22\nVIIRS_NOAA20_NRT,2026-01-01,2026-08-22\n", {
        status: 200,
        headers: { "content-type": "text/plain;charset=UTF-8" }
      });
    }
    const source = url.includes("VIIRS_NOAA21_NRT") ? "VIIRS_NOAA21_NRT" : "VIIRS_NOAA20_NRT";
    if (failedSources.includes(source)) return new Response("provider failure", { status: 500, headers: { "content-type": "text/plain" } });
    if (malformedSources.includes(source)) return new Response("wrong,header\n1,2\n", { status: 200, headers: { "content-type": "text/csv" } });
    const defaults = source === "VIIRS_NOAA21_NRT"
      ? [csvRow({ satellite: "N21" }), csvRow({ satellite: "N21", latitude: "52.1" })]
      : [];
    return new Response(csv(...(sourceRows[source] ?? defaults)), { status: 200, headers: { "content-type": "text/plain;charset=UTF-8" } });
  };
  return { fetchImpl, calls };
}

function clock(iso) {
  return () => new Date(iso);
}

function parse(store, key) {
  return JSON.parse(store.objects.get(key).toString("utf8"));
}

test("healthy publication exact-clips, verifies immutable assets, and excludes Suomi NPP", async () => {
  const store = new MemoryStore();
  const nasa = provider();
  const result = await publishOperationalFeed({
    store,
    mapKey: "protected-test-key",
    aoi,
    aoiMetadata: metadata,
    fetchImpl: nasa.fetchImpl,
    clock: clock("2026-08-22T06:00:00Z")
  });

  assert.equal(result.published, true);
  assert.equal(result.pointer.status, "current");
  assert.equal(result.pointer.source_state, "complete");
  assert.deepEqual(result.pointer.counts, { map_24h: 1, history_30d: 1 });
  assert.equal(result.pointer.allow_healthy_empty_message, true);
  assert.equal(nasa.calls.some((url) => url.includes("VIIRS_SNPP_NRT")), false);
  assert.equal(parse(store, result.pointer.history.key).observations.length, 1);
  assert.equal(parse(store, result.pointer.map.key).features[0].geometry.type, "Point");
  assert.equal(parse(store, STATUS_KEY).last_complete_success_at, "2026-08-22T06:00:00.000Z");
  assert.ok([...store.objects.keys()].some((key) => key.endsWith("/raw/VIIRS_NOAA21_NRT.bin")));
  assert.ok([...store.objects.keys()].some((key) => key.endsWith("/normalized/VIIRS_NOAA20_NRT.json")));
});

test("one-source success publishes degraded without a reassuring empty claim", async () => {
  const store = new MemoryStore();
  await publishOperationalFeed({
    store,
    mapKey: "protected-test-key",
    aoi,
    aoiMetadata: metadata,
    fetchImpl: provider().fetchImpl,
    clock: clock("2026-08-22T06:00:00Z")
  });
  const degraded = await publishOperationalFeed({
    store,
    mapKey: "protected-test-key",
    aoi,
    aoiMetadata: metadata,
    fetchImpl: provider({ failedSources: ["VIIRS_NOAA20_NRT"] }).fetchImpl,
    clock: clock("2026-08-22T12:00:00Z")
  });

  assert.equal(degraded.pointer.status, "degraded");
  assert.equal(degraded.pointer.source_state, "degraded");
  assert.equal(degraded.pointer.allow_healthy_empty_message, false);
  assert.equal(parse(store, degraded.pointer.contract.key).healthy_empty_message, null);
  assert.equal(degraded.pointer.last_complete_success_at, "2026-08-22T06:00:00.000Z");
});

test("total source failure records outage while preserving the verified current pointer", async () => {
  const store = new MemoryStore();
  await publishOperationalFeed({
    store,
    mapKey: "protected-test-key",
    aoi,
    aoiMetadata: metadata,
    fetchImpl: provider().fetchImpl,
    clock: clock("2026-08-22T06:00:00Z")
  });
  const previous = Buffer.from(store.objects.get(CURRENT_KEY));
  const outage = await publishOperationalFeed({
    store,
    mapKey: "protected-test-key",
    aoi,
    aoiMetadata: metadata,
    fetchImpl: provider({ failedSources: ["VIIRS_NOAA21_NRT", "VIIRS_NOAA20_NRT"] }).fetchImpl,
    clock: clock("2026-08-22T18:00:00Z")
  });

  assert.equal(outage.published, false);
  assert.equal(outage.status.status, "outage");
  assert.deepEqual(store.objects.get(CURRENT_KEY), previous);
  assert.equal(parse(store, STATUS_KEY).last_attempted_at, "2026-08-22T18:00:00.000Z");
});

test("schema drift in one source degrades and never publishes its rows", async () => {
  const store = new MemoryStore();
  await publishOperationalFeed({
    store,
    mapKey: "protected-test-key",
    aoi,
    aoiMetadata: metadata,
    fetchImpl: provider().fetchImpl,
    clock: clock("2026-08-22T06:00:00Z")
  });
  const result = await publishOperationalFeed({
    store,
    mapKey: "protected-test-key",
    aoi,
    aoiMetadata: metadata,
    fetchImpl: provider({ malformedSources: ["VIIRS_NOAA21_NRT"] }).fetchImpl,
    clock: clock("2026-08-22T10:00:00Z")
  });
  assert.equal(result.pointer.status, "degraded");
  assert.match(result.manifest.acquisitions.find((item) => item.id === "VIIRS_NOAA21_NRT").error, /header changed/);
});

test("asset upload failure cannot replace the current pointer", async () => {
  const store = new MemoryStore();
  await publishOperationalFeed({
    store,
    mapKey: "protected-test-key",
    aoi,
    aoiMetadata: metadata,
    fetchImpl: provider().fetchImpl,
    clock: clock("2026-08-22T06:00:00Z")
  });
  const previous = Buffer.from(store.objects.get(CURRENT_KEY));
  store.failPattern = /2026-08-22T12-00-00Z\/history\.json$/;
  await assert.rejects(
    publishOperationalFeed({
      store,
      mapKey: "protected-test-key",
      aoi,
      aoiMetadata: metadata,
      fetchImpl: provider().fetchImpl,
      clock: clock("2026-08-22T12:00:00Z")
    }),
    /simulated upload failure/
  );
  assert.deepEqual(store.objects.get(CURRENT_KEY), previous);
});

test("withdrawal preserves a recovery record and restore verifies every referenced asset", async () => {
  const store = new MemoryStore();
  const published = await publishOperationalFeed({
    store,
    mapKey: "protected-test-key",
    aoi,
    aoiMetadata: metadata,
    fetchImpl: provider().fetchImpl,
    clock: clock("2026-08-22T06:00:00Z")
  });
  const withdrawn = await withdrawOperationalFeed({
    store,
    reason: "Controlled recovery rehearsal",
    clock: clock("2026-08-22T07:00:00Z")
  });
  assert.equal(parse(store, CURRENT_KEY).status, "withdrawn");
  const restored = await restoreOperationalFeed({ store, withdrawalKey: withdrawn.pointer.recovery_record.key });
  assert.deepEqual(restored, published.pointer);
  assert.deepEqual(parse(store, CURRENT_KEY), published.pointer);
});
