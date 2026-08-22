import assert from "node:assert/strict";
import test from "node:test";
import {
  haversineMetres,
  normalizeRow,
  parseCsv,
  pointInGeometry,
  REQUIRED_FIELDS
} from "../tooling/firms/validate-signal.mjs";

const square = {
  type: "Polygon",
  coordinates: [[
    [-3.1, 51.7],
    [-2.9, 51.7],
    [-2.9, 51.9],
    [-3.1, 51.9],
    [-3.1, 51.7]
  ]]
};

test("FIRMS CSV parser preserves quoted fields and trailing empty fields", () => {
  assert.deepEqual(parseCsv('a,b,c\r\n1,"two, too",\r\n'), [
    ["a", "b", "c"],
    ["1", "two, too", ""]
  ]);
});

test("exact AOI clipping handles interior, boundary, exterior, and holes", () => {
  assert.equal(pointInGeometry([-3, 51.8], square), true);
  assert.equal(pointInGeometry([-3.1, 51.8], square), true);
  assert.equal(pointInGeometry([-3.2, 51.8], square), false);
  const withHole = {
    type: "Polygon",
    coordinates: [square.coordinates[0], [[-3.01, 51.79], [-2.99, 51.79], [-2.99, 51.81], [-3.01, 51.81], [-3.01, 51.79]]]
  };
  assert.equal(pointInGeometry([-3, 51.8], withHole), false);
});

test("NOAA-21 rows receive stable BCA identities without implying incident identity", () => {
  const values = {
    latitude: "51.8000",
    longitude: "-3.0000",
    bright_ti4: "321.1",
    scan: "0.4",
    track: "0.4",
    acq_date: "2026-07-20",
    acq_time: "1337",
    satellite: "N21",
    instrument: "VIIRS",
    confidence: "nominal",
    version: "2.0NRT",
    bright_ti5: "289.4",
    frp: "4.2",
    daynight: "D"
  };
  assert.deepEqual(Object.keys(values), REQUIRED_FIELDS);
  const first = normalizeRow(values, "VIIRS_NOAA21_NRT", square, new Date("2026-07-21T00:00:00Z"));
  const second = normalizeRow(values, "VIIRS_NOAA21_NRT", square, new Date("2026-07-21T00:00:00Z"));
  assert.equal(first.inside_aoi, true);
  assert.equal(first.observation_key, second.observation_key);
  assert.equal(first.row_fingerprint, second.row_fingerprint);
  assert.match(first.observation_key, /^[0-9a-f]{64}$/);
});

test("source-to-satellite mismatch fails closed", () => {
  const row = {
    latitude: "51.8", longitude: "-3", bright_ti4: "320", scan: "0.4", track: "0.4",
    acq_date: "2026-07-20", acq_time: "1337", satellite: "N20", instrument: "VIIRS",
    confidence: "low", version: "2.0NRT", bright_ti5: "290", frp: "1", daynight: "D"
  };
  assert.throws(
    () => normalizeRow(row, "VIIRS_NOAA21_NRT", square, new Date("2026-07-21T00:00:00Z")),
    /satellite does not match requested source/
  );
});

test("FIRMS early-UTC times may omit leading zeroes without changing raw identity inputs", () => {
  const row = {
    latitude: "51.8", longitude: "-3", bright_ti4: "320", scan: "0.4", track: "0.4",
    acq_date: "2026-07-20", acq_time: "35", satellite: "N20", instrument: "VIIRS",
    confidence: "low", version: "2.0NRT", bright_ti5: "290", frp: "1", daynight: "N"
  };
  const normalized = normalizeRow(row, "VIIRS_NOAA20_NRT", square, new Date("2026-07-21T00:00:00Z"));
  assert.equal(normalized.observed_at, "2026-07-20T00:35:00.000Z");
});

test("haversine comparison is symmetric and appropriately local", () => {
  const left = { latitude: 51.8, longitude: -3 };
  const right = { latitude: 51.8, longitude: -2.99 };
  assert.equal(haversineMetres(left, left), 0);
  assert.equal(haversineMetres(left, right), haversineMetres(right, left));
  assert.ok(haversineMetres(left, right) > 600 && haversineMetres(left, right) < 800);
});
