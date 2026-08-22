# Recent satellite thermal anomalies runbook

This feed is operational state, not part of an immutable landscape-evidence
release. The protected `Publish FIRMS thermal-anomaly feed` workflow runs at
`23 1,7,13,19 * * *` UTC and supports a manual publish. It queries only NASA
FIRMS `VIIRS_NOAA21_NRT` and `VIIRS_NOAA20_NRT`; Suomi NPP is excluded from
acquisition, publication and health.

## Publication and health

Each run checks the protected map-key quota and NASA data-availability response,
then makes independent five-day Area API requests for both required sources over
the pinned bounding box and exact-clips every centroid to the canonical BCA-area
of interest plus exactly 2 km. Exact response bytes, request metadata,
source-normalized observations, 24-hour GeoJSON, 30-day JSON/CSV, bilingual
contract and manifest use write-once `active-fire/runs/<UTC run>/` keys. Every
upload is read back and checksum-verified before `active-fire/current.json` is
replaced. No scheduled workflow commits to the repository or invokes the manual
evidence publisher.

Both valid sources produce `current`. One valid source may publish as
`degraded`, but its public contract forbids the reassuring healthy-empty
message. No complete success for 12 hours is `stale`; after 24 hours the client
must hide old points from its default map while retaining status and history.
When both sources or a provider preflight fails, the workflow writes an outage
status and fails, while leaving the last verified current pointer untouched.
The failed workflow is the acquisition alert. The production monitor separately
fails when a complete success is 12 hours old.

Public immutable run objects must be retained for at least 90 days. Do not add
an R2 lifecycle rule for `active-fire/runs/` with a shorter expiry. Raw objects
remain internal to the bucket path contract unless an explicit delivery rule
makes them public; the explorer consumes only URLs named by the verified current
pointer.

## Credentials and quota

`FIRMS_MAP_KEY` is a repository secret. `CLOUDFLARE_R2_PUBLICATION_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` are exposed only by the protected production
environment; the token is restricted to the production publication bucket.
Values must never enter source, logs, manifests, artifacts or issue comments.
The publisher stops before acquisition when fewer than 20 FIRMS transactions
remain in the provider's 5,000-per-10-minute allowance.

Rotate or revoke the FIRMS key through NASA FIRMS, replace `FIRMS_MAP_KEY`, then
run a manual publish and the monitor. Rotate the R2 token in Cloudflare, replace
the protected environment secret and run the same checks before revoking the
old token.

## Withdrawal and recovery

Use manual workflow operation `withdraw` with a specific public-safety or data
integrity reason. It preserves the entire previous pointer in a write-once
`active-fire/withdrawals/<UTC>.json` recovery record, then replaces current and
status with a withdrawn pointer. Do not delete immutable run objects.

To recover, first inspect the named withdrawal record and its previous run.
Dispatch `restore` with that exact object key. Recovery re-reads the manifest,
24-hour map, 30-day history, accessible CSV and bilingual contract and verifies
every checksum before restoring the pointer. Run the public feed monitor after
withdrawal or recovery and retain the workflow URL in the incident record.

## Public meaning

A point is the centre of a nominal approximately 375 m VIIRS observation pixel,
not an exact heat or fire location or extent. Detections are not verified
incidents, perimeters, warnings, severity measures or forecasts. Empty data is
never evidence that no fire exists. Cloud, smoke, overpass timing and outages
can cause omissions; non-fire sources and artefacts can cause detections. Do not
travel to investigate. Report immediate danger through 999 or 112.
