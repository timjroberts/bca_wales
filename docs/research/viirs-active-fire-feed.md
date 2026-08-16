# A safe high-cadence VIIRS thermal-anomaly feed for the Blorenge explorer

**Research date:** 16 August 2026  
**Decision question:** Should the second public data release add a separately processed VIIRS active-fire feed, and can GitHub Actions refresh it safely every 6 or 12 hours?

## Decision

**Include it, conditionally, as “Recent satellite thermal anomalies”, refreshed every six hours from NASA FIRMS. Do not call it “current hottest areas”, an incident feed, a fire perimeter, or an emergency warning.**

The required upstreams should be NASA FIRMS Area API sources `VIIRS_NOAA21_NRT` and `VIIRS_NOAA20_NRT`. They expose the original VIIRS observations with clearer provenance and less added latency than Copernicus EFFIS or GWIS. `VIIRS_SNPP_NRT` may be retained as a separately identified optional source only until its announced retirement: NASA says delivery of Suomi NPP products will cease on **1 November 2026** and directs users to NOAA-21 and NOAA-20 ([NASA LANCE](https://www.earthdata.nasa.gov/data/projects/lance)). The feed must remain healthy when S-NPP is absent.

The release is conditional on one pre-production acquisition test using a BCA-owned FIRMS map key: backfill the July 2026 event and 30 quiet days, verify the fields and response behaviour described below, and record actual feature counts. A project key was not available during this research, so an exact historic Blorenge detection count could not be obtained. That is an access/provisioning acceptance gate, not a reason to use an undocumented surrogate.

The layer's value is narrow but real: it can show that a polar-orbiting satellite detected a thermal anomaly in or near the selected Blorenge area at a stated UTC time. It can help BCA and the public notice a possible event and follow its satellite observation history. It cannot establish that a wildfire exists, locate it precisely, rank the mountain by temperature, show areas currently burning between satellite passes, or replace 999/112, South Wales Fire and Rescue Service, field reports, or an incident perimeter. NASA's own FIRMS map says: **“Do not use for the preservation of life or property”** and warns that satellite-derived anomalies have limited accuracy ([FIRMS map](https://firms.modaps.eosdis.nasa.gov/map/index.html)).

## Why NASA FIRMS, not an EFFIS/GWIS feed

| Candidate | What it actually supplies | Latency/cadence | Decision |
|---|---|---|---|
| **NASA FIRMS Area API** | Per-sensor VIIRS thermal-anomaly rows for an exact bounding box, including observation time, brightness temperatures, FRP, confidence, scan/track, version and day/night | FIRMS says global data are normally available within three hours; its WFS is refreshed every 15 minutes | **Primary source.** Query NOAA-21 and NOAA-20 independently so a sensor outage is visible |
| **Copernicus EFFIS active fires** | A knowledge-filtered subset of NASA FIRMS hotspots for Europe, using land cover, distance from urban/artificial surfaces and confidence | Normally updated six times daily and shown within 2–3 hours of image acquisition | **Comparison only.** Filtering can reduce obvious false alarms, but hides source rows and policy choices while adding another dependency |
| **Copernicus/JRC GWIS active fires** | Global MODIS/VIIRS observations sourced from FIRMS | Normally updated daily and available within one day | **Reject for this high-cadence use.** It is useful regional context, not a six-hour Blorenge source |

FIRMS currently lists `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT` and `VIIRS_SNPP_NRT` as Area API sources and requires a free map key. The documented allowance is 5,000 transactions per ten-minute interval; a five-day query is the maximum Area API window ([FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/)). Two small bounding-box calls every six hours are negligible against that limit, though the provider can change quotas and availability.

EFFIS explicitly says its active-fire layer is a filtered FIRMS subset and documents a 375 m VIIRS pixel, missed fires under smoke/cloud or when too small, and non-fire heat sources ([EFFIS active-fire detection](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/active-fire-detection)). GWIS says its active fires are normally updated daily and can miss considerable burning activity because a fire is observed only at overpass time ([GWIS active-fire detection](https://gwis.jrc.ec.europa.eu/about-gwis/technical-background/active-fire-detection)). Direct FIRMS is therefore the more transparent and timely contract.

A live check on 16 August 2026 also found the documented EFFIS WFS endpoint did not return `GetCapabilities` within 30 seconds. A single timeout does not prove chronic unavailability, but it reinforces the architectural rule: never make the public current state a pass-through to EFFIS. EFFIS remains useful for visual comparison and its separately produced burnt-area products.

## What a VIIRS row means

Each row is an observation, not a fire object. NASA explains that the point is the centre of a pixel flagged as containing one or more fires **or another thermal anomaly**. The fire may occupy only a small part of that pixel; its exact location and size cannot be recovered from the point. VIIRS nominal resolution is 375 m, while actual pixel dimensions vary with viewing geometry ([FIRMS detection meaning](https://forum.earthdata.nasa.gov/viewtopic.php?t=5155); [VIIRS Collection 2 user guide](https://www.earthdata.nasa.gov/s3fs-public/2024-07/VIIRS_C2_AF-375m_User_Guide_1.0.pdf)).

The fields must be presented as follows:

- `bright_ti4` and `bright_ti5` are channel brightness temperatures in kelvin: radiance at particular wavelengths expressed as an equivalent temperature. They are not an in-situ surface-temperature reading, a maximum flame temperature, or a safe basis for colouring the mountain “hotter” and “cooler”.
- `frp` is pixel-integrated fire radiative power in megawatts. It is related to radiative energy release at the instant of observation, but varies with fire fraction, view angle, saturation, atmospheric conditions and sensor/pass. It is not burned area, flame temperature, incident severity, future risk, or a clean cross-pass ranking.
- `confidence` is the algorithm's categorical detection confidence (`low`, `nominal`, `high`), not the probability that a reported public wildfire exists. It does not measure location accuracy, fire size or urgency.
- `daynight` states whether the acquisition was a day or night observation. VIIRS has useful day and night coverage and better nighttime sensitivity than its coarser 750 m counterpart, but observations remain discrete polar-orbit passes rather than continuous monitoring ([NASA FIRMS VIIRS FAQ](https://forum.earthdata.nasa.gov/viewtopic.php?t=5189)).
- `scan` and `track` describe the observation footprint dimensions. A map symbol may be placed at the reported centroid, but a tooltip and legend must explain the approximate pixel support. Do not draw an invented circular fire radius or merge points into an asserted perimeter.

NASA's Collection 2 guide identifies independent products for S-NPP (`VNP14IMG`), NOAA-20 (`VJ114IMG`) and NOAA-21 (`VJ214IMG`) and documents acquisition date/time, coordinates, I4/I5 brightness temperatures, FRP, confidence, day/night, geometry and anomaly type in the science product ([VIIRS Collection 2 user guide](https://www.earthdata.nasa.gov/s3fs-public/2024-07/VIIRS_C2_AF-375m_User_Guide_1.0.pdf)). The lighter FIRMS Area API schema does not provide a durable upstream detection ID or all science-product context. BCA must not invent one that implies an incident identity.

## Errors, omissions and Blorenge fitness

Possible omissions include a fire that is too small or cool at overpass, is hidden by cloud or dense smoke, burns between passes, or falls in missing/degraded sensor data. A clear response with zero rows means only **“no qualifying anomaly was returned for these sources, passes and query window”**. It must never render as “no fire”. FIRMS notes that its point data do not describe cloud or missing pixels and that ignoring those states can produce misleading conclusions ([FIRMS caveats](https://forum.earthdata.nasa.gov/viewtopic.php?t=5188)).

Possible commissions include hot smoke, agricultural or prescribed burning, industrial/static heat, bright reflective surfaces and algorithm/geolocation artefacts. Parallax can displace detections from tall super-heated smoke plumes. EFFIS's land-cover/urban/confidence filtering is evidence that `confidence` alone does not turn an anomaly into a verified wildfire, but BCA should not silently copy that undocumented-at-row-level classification into a direct-source layer.

The current SSSI-plus-2-km discovery envelope is only about 7.5 by 9.4 km (`[-3.1134, 51.7440, -3.0049, 51.8285]`), and the planned BCA working boundary plus 2 km is expected to remain a similarly small upland AOI. A 375 m observation is therefore useful as a conspicuous time-stamped lead, but too coarse for a route choice, land parcel, fire edge or “which patch is hottest” conclusion. Normal volume will likely be zero; an event can produce multiple nearby rows from successive passes and sensors. Storage and API cost are negligible. The acceptance backfill must quantify the actual July burst and quiet-day false-positive background before release.

## Identity, de-duplication and revisions

Do not spatially deduplicate observations from different satellites or passes. They are independent measurements. Do not count their points as separate fires either.

For idempotent ingestion, retain two identifiers:

1. `observation_key = sha256(source_code | satellite | instrument | acq_date | acq_time | latitude_as_received | longitude_as_received | scan | track)`. This identifies a logical source observation only within BCA's pipeline.
2. `row_fingerprint = sha256(canonical complete source row)`. A changed fingerprint under the same observation key is a provider revision, preserved as a new version rather than overwritten.

The `version` source field must also be retained, but is not a unique record ID. Do not collapse NOAA-20 and NOAA-21 points merely because they are close in space/time. A derived `display_group_id` may cluster nearby observations for UI convenience, but it must be explicitly non-authoritative, expand to its member observations, and never be labelled an incident or fire count.

FIRMS removes real-time/ultra-real-time rows when corresponding NRT detections arrive or when those provisional rows are older than six hours. Its archive later replaces NRT data with standard science-quality data, usually after 2–3 months but potentially after five months; NASA advises standard products for scientific analysis ([FIRMS active-fire downloads](https://firms.modaps.eosdis.nasa.gov/active_fire/)). Therefore the live feed must preserve every fetched response, identify removals/replacements in later snapshots, and never silently rewrite historical claims. A later analytical history job may reconcile observations to standard processing, but that is separate from the live layer.

## Exact acquisition and publication recipe

### Source and query

1. Register a BCA-owned free FIRMS map key as the GitHub Actions repository secret `FIRMS_MAP_KEY`. Never place it in source, artifacts, cache keys, logs or published manifests.
2. At each run read the canonical release-2 AOI geometry (BCA working area plus exactly 2 km), calculate its WGS84 bounding box, and call these endpoints independently with a five-day overlap:

   ```text
   https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/VIIRS_NOAA21_NRT/{west},{south},{east},{north}/5
   https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/VIIRS_NOAA20_NRT/{west},{south},{east},{north}/5
   ```

   The optional S-NPP call, if enabled before 1 November 2026, uses `VIIRS_SNPP_NRT` and never participates in required-source health.
3. Reject redirects, HTML/login pages, non-2xx responses, responses over a conservative byte limit, and an unexpected header. Require the documented fields `latitude`, `longitude`, `bright_ti4`, `scan`, `track`, `acq_date`, `acq_time`, `satellite`, `instrument`, `confidence`, `version`, `bright_ti5`, `frp`, `daynight`. Preserve the exact response bytes, HTTP metadata, request source/window (with key redacted), retrieval UTC time and SHA-256.
4. Parse strictly: finite/range-valid coordinates; valid UTC date/time; allowed confidence and day/night values; finite non-negative FRP; finite brightness values; known source/satellite mapping. Reject future observations beyond a small clock-skew tolerance. Clip centroid points to the **exact buffered AOI geometry** after the bounding-box query while retaining the footprint fields. Do not use the bounding box as the public area.
5. Normalize to GeoJSON plus an accessible JSON/CSV-equivalent table containing source, satellite, acquisition UTC, centroid, scan/track, brightness values, FRP, confidence, day/night, source version, BCA observation key and a direct FIRMS methodology link. Keep source values; do not calculate a “hotness” score.

### Immutable snapshot and current pointer

Publish to an operationally separate R2 bucket or equally isolated object-store namespace, not into the manually governed evidence-release pointer and not as four Git commits per day:

```text
active-fire/raw/{retrieved_utc}/{source}.csv.bin
active-fire/snapshots/{retrieved_utc}/observations.geojson
active-fire/snapshots/{retrieved_utc}/observations.table.json
active-fire/snapshots/{retrieved_utc}/manifest.json
active-fire/current.json
```

Every versioned key is write-once. The manifest records request windows, redacted URLs, source status, row counts before/after AOI clipping, parser/schema version, AOI geometry ID/checksum, source response checksums, normalized checksums, warnings and the previous pointer checksum. Upload and read back every versioned object before replacing the small `current.json` pointer. Never advance the pointer to unverified bytes.

Use a dedicated R2 credential restricted to this bucket, separate from the manually promoted evidence-release credential. The workflow needs `contents: read` only; it does not need to push repository changes. GitHub recommends least privilege and warns that automatic secret redaction is not guaranteed, so the acquisition program must construct the key-bearing URL in memory and scrub errors rather than print request URLs ([GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use); [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)).

### Schedule and failure behaviour

Use:

```yaml
on:
  schedule:
    - cron: "23 1,7,13,19 * * *"
  workflow_dispatch:
concurrency:
  group: active-fire-publication
  cancel-in-progress: false
```

This is every six hours at minute 23 UTC, deliberately away from the top-of-hour load peak. Twelve-hour polling can leave a globally available FIRMS observation unseen by BCA for roughly 15 hours (up to three hours source latency plus almost twelve hours until the next poll); six-hour polling halves the acquisition component with trivial extra cost. More frequent polling would not create extra satellite passes and is unnecessary for this release.

GitHub states that scheduled workflows run from the default branch, can be delayed during high load, and may even be dropped; public-repository schedules are disabled after 60 days without repository activity ([GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)). The site must therefore treat schedule time as a request, not a service-level guarantee. Keep `workflow_dispatch`, alert on pointer age, and run an independent daily check against the public pointer.

Retry each source up to three times with bounded exponential backoff. Then publish according to these rules:

- **Healthy:** both NOAA-21 and NOAA-20 responses validate. Empty result sets are valid data, not failures.
- **Degraded:** exactly one required source validates. Publish the new snapshot with the missing source named prominently. Never state “no anomalies” for a degraded window.
- **Failed:** neither required source validates or normalized validation fails. Do not advance the pointer; alert the maintainers and retain diagnostic metadata without secrets.
- **Stale:** the client computes this when the selected pointer is more than 12 hours old. Keep the last successful observations only with a visible stale banner. At 24 hours, hide them from the default map and show a status-only panel plus history link; do not imply that old points are current.

Provider availability is part of the data. Check the FIRMS `data_availability`/missing-data service and current alert page during acceptance and when a sensor response disappears. NASA and NOAA do issue anomaly/outage notices; for example, NOAA's operational status identifies NOAA-21 as primary, NOAA-20 as secondary and S-NPP as tertiary, while NASA has already announced the S-NPP delivery end ([NOAA JPSS status](https://www.ospo.noaa.gov/operations/jpss/status.html); [FIRMS API index](https://firms.modaps.eosdis.nasa.gov/api/)). Absence of rows must never be substituted for a source-health check.

### Expiry and history

- Default map: observations acquired in the preceding **24 hours**, styled by age and confidence without a temperature ranking.
- Accessible recent table: the same 24-hour window, including a genuine empty state and source health.
- Public history: filterable observations for **30 days**, grouped by date/pass with all source rows available.
- Public immutable snapshots: retain for at least **90 days**; internal raw responses, manifests and checksums: retain indefinitely while the service remains within BCA's evidence-retention policy because they are small, open, non-personal records.
- Long-term scientific comparisons: use reconciled standard-processing products rather than accumulated NRT rows, preserving links between live and replacement observations.

NASA Earth science data from NASA-led missions are CC0 unless specifically marked otherwise, with NASA strongly requesting citation and forbidding implication of endorsement ([NASA data use and citation](https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy)). Display: **“Data: NASA FIRMS, VIIRS NOAA-21 and NOAA-20. Clipped and reformatted by Blorenge Commoners Association.”** Link to FIRMS, the retrieval time, snapshot manifest, methodology and limitations. If EFFIS is ever republished rather than merely linked, its EU CC BY 4.0 terms require attribution and indication of changes, while third-party rights still need checking ([EFFIS licence](https://forest-fire.emergency.copernicus.eu/about-effis/data-license)).

## Public contract and safety wording

English layer title: **Recent satellite thermal anomalies**  
Welsh layer title: **Anomaleddau thermol lloeren diweddar**

English legend:

> Points show where VIIRS detected a thermal anomaly within an approximately 375 m observation pixel during a satellite pass. They may reflect fire, hot smoke, managed burning or another heat source. The point is not an exact fire location or perimeter. Cloud, smoke, timing, fire size and data outages can cause fires to be missed. Confidence describes the satellite algorithm, not confirmation by the fire service. Do not use this layer to protect life or property. For an emergency call 999 or 112.

Welsh legend:

> Mae'r pwyntiau'n dangos lle canfu VIIRS anomaledd thermol o fewn picsel arsylwi tua 375 m yn ystod taith lloeren. Gallant adlewyrchu tân, mwg poeth, llosgi dan reolaeth neu ffynhonnell wres arall. Nid yw'r pwynt yn lleoliad nac yn berimedr tân manwl. Gall cymylau, mwg, amseriad, maint y tân a thoriadau data olygu bod tanau'n cael eu methu. Mae hyder yn disgrifio algorithm y lloeren, nid cadarnhad gan y gwasanaeth tân. Peidiwch â defnyddio'r haen hon i ddiogelu bywyd nac eiddo. Mewn argyfwng ffoniwch 999 neu 112.

The Welsh wording requires review by a competent Welsh-language reviewer before publication. The non-map status must state retrieval time, observation window, source health and feature count; list every point with UTC time, sensor, confidence, FRP and brightness values plus plain-language definitions; and remain usable when the map cannot load. Colour must not be the only carrier of age/confidence.

## Release acceptance tests

The layer is ready for the second release only when all of these pass:

1. A project-owned `FIRMS_MAP_KEY` works from GitHub Actions without appearing in logs or artifacts, and quota/status responses are recorded.
2. The July 2026 incident plus 30 quiet days are backfilled for NOAA-20 and NOAA-21; exact inside-AOI counts, duplicates, confidence distribution and likely false positives are manually reviewed against FIRMS and known incident timing.
3. Repeated overlapping five-day pulls prove exact-row idempotency and revision capture; a simulated changed row creates a new fingerprint without erasing the old snapshot.
4. Empty healthy, one-sensor degraded, both-sensor failed, malformed HTML/CSV, delayed schedule, stale pointer and provider revision cases all produce the specified public states.
5. Versioned objects cannot be overwritten; pointer replacement occurs only after checksum readback; the website can recover from a failed pointer update.
6. Default, stale and historical states work in the map and the bilingual accessible table; the final Welsh text is reviewed.
7. Every screen containing the layer retains the NASA attribution and emergency limitation; no UI string says “current hottest”, “live fire”, “confirmed fire”, “fire edge”, “safe”, or “no fire”.

With those gates, the feature adds useful situational evidence without pretending that a coarse, intermittent remote-sensing observation is an emergency-monitoring system.
