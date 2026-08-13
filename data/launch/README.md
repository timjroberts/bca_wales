# Blorenge launch data candidates

These files turn the settled launch-layer decisions into a reviewable source registry, a representative acquisition manifest, and a deliberately blocked candidate publication manifest.

They are inputs to the publication-toolchain and factual-release tickets. They are not a promoted release, and they must not be wired to the public explorer as if they were one.

## What was validated

- The Blorenge SSSI is exactly `NRW_SSSI.13108`, provider code `33WFL`.
- The Bannau Brycheiniog National Park feature is exactly `NRW_NATIONAL_PARK.2`, provider `isis_id` `2449`.
- Direct NRW WFS acquisition works for the SSSI, park, Main Rivers and the selected historical Phase 1 polygon layer.
- The Welsh Government LiDAR tile catalogue resolves to directly retrievable 1 m GeoTIFFs. A representative DTM tile was downloaded and hashed.
- A fixed 6 August 2026 Geofabrik Wales PBF was downloaded and hashed for the community basemap/place/path context.
- Exact Copernicus Sentinel-2 and USGS Landsat STAC candidates were pinned through 9 August 2026. Their catalogue records expose immutable product IDs and per-asset provider multihashes.
- The EFFIS current database contains candidate feature `592404`: 155 ha, provider dates 20–29 July 2026, last updated 3 August 2026. It is a provisional provider record, not incident-authority truth.

## Why publication is blocked

The launch boundary is now the authoritative Blorenge SSSI feature `NRW_SSSI.13108`, buffered by 2 km for the area of interest. Blorenge Common `CL18` is deferred until Torfaen supplies its maintained register-map boundary and confirms reuse terms. The explorer must label the SSSI accurately and must not imply that it represents the legal common-land boundary.

The EFFIS candidate is useful corroboration but does not establish the authoritative incident identity, ignition, control or end chronology. Those facts are required before satellite scenes can be bound to pre-fire, immediate-post and latest roles or before the site can name a primary July 2026 perimeter.

The publication manifest therefore remains fail-closed only on the incident-authority chronology. Exact output checksums and release URLs belong only in a later immutable release manifest after that blocker, AOI-level scene QA, processing, accessibility checks and release-authority promotion are complete.

## Files

- `source-registry.json` records source identity, acquisition method, licence, attribution, CRS/schema, cadence, transformation, limitations and public-safety classification.
- `acquisition-manifest-2026-08-09.json` records the exact representative responses and binary snapshots checked during acquisition, including byte lengths and SHA-256 values.
- `candidate-publication-manifest.json` maps launch layers to sources and makes the hard publication failures machine-visible.

The source registry now uses the validated `1.0.0` contract and includes the
processing, refresh, retention and withdrawal policy fields consumed by the
publication toolchain. Its licence-term snapshot checksums remain deliberately
unset, so it cannot pass the publication gate prematurely. The representative
acquisition and blocked publication manifests remain `0.1.0-candidate`
historical inputs; the toolchain generates new `1.0.0` acquisition, lineage,
QA and release manifests from exact snapshots during a real release build.
