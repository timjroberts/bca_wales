# Evidence publication runbook

The public site and evidence releases have separate delivery paths. This
runbook covers evidence only. It does not provision R2, change the site build or
turn the historical candidate manifests into evidence.

## Contracts and directories

Every build starts from a schema-valid source registry and release recipe. The
recipe names exact inputs, maximum acquisition sizes, a shell-free ordered
command graph, public and private outputs, dataset metadata and material-change
thresholds. Maintained contracts live under `schemas/`; the pinned processing
environment is `config/publication/toolchain.lock.json` and
`tooling/geodata/Containerfile`.

The tool creates a new `<workspace>/<release_id>` directory and refuses to
reuse it. It contains:

- `quarantine/` — exact acquired inputs;
- `snapshots/` — canonical source-registry and recipe snapshots;
- `outputs/` — public-safe display and accessible assets;
- `private/` — retained COGs and other non-public reproducibility products;
- `manifests/` — acquisition, lineage, candidate and final release records;
- `reports/` — machine-readable and human-readable QA and withdrawal records.

Keep a completed published directory in private durable storage. Do not place
raw provider inputs, COGs or rejected candidates in the public bucket.

## Build a candidate

Build the pinned image once for the checked-in lock:

```bash
docker build --file tooling/geodata/Containerfile --tag bca/geodata-toolchain:1.0.0 .
npm run geodata -- validate --registry data/launch/source-registry.json --recipe PATH_TO_RECIPE
npm run geodata -- acquire --registry data/launch/source-registry.json --recipe PATH_TO_RECIPE --workspace .geodata-work --commit FULL_GIT_SHA --allow-network
npm run geodata -- build --release-root .geodata-work/RELEASE_ID
```

Network access is opt-in for acquisition. Transformation is always run with
the container network disabled. An acquisition records resolved URLs, response
metadata, byte counts and SHA-256 checksums. A checksum change is a review event,
not proof that the source contract remains valid.

The build refuses overwritten artifacts and input drift. It records ordered
arguments, tool versions and checksums for each input and output. QA validates
GeoJSON fields and feature counts, CSV columns and row counts, PMTiles v3
headers plus `pmtiles verify`, TIFF signatures plus GDAL's `LAYOUT=COG`, asset
sizes, licence snapshots, public-safety status, accessible alternatives and
cross-release thresholds. Any hard failure produces a candidate manifest that
cannot be uploaded or promoted.

Review both `reports/qa.md` and `reports/qa.json`. Tim Roberts is the sole launch
release authority. Warnings always prevent automatic promotion and require his
manual decision. A changed contract, licence, schema, tool, presentation or
public meaning remains manual even when all hard checks pass.

## Reproduce before promotion

From the private candidate archive, rebuild in a fresh workspace:

```bash
npm run geodata -- verify-archive --release-root PRIVATE_ARCHIVE/RELEASE_ID
npm run geodata -- reproduce --archive PRIVATE_ARCHIVE/RELEASE_ID --workspace .geodata-reproduction
```

Reproduction copies only the recorded snapshots, acquisition manifest and exact
quarantined inputs, reruns the pinned offline graph, and fails unless every
output checksum equals the archived lineage. No live upstream source is used.

## Stage, then promote

Use a dedicated `CLOUDFLARE_API_TOKEN` restricted to object read/write on the
target evidence bucket and `CLOUDFLARE_ACCOUNT_ID`. Site-deployment tokens must
not have this permission. Production runs in the protected GitHub `production`
environment and the workflow concurrency group prevents two pointer changes at
once.

```bash
npm run geodata -- stage --release-root PRIVATE_ARCHIVE/RELEASE_ID --bucket bca-wales-public-releases --jurisdiction eu --identity timjroberts
npm run geodata -- publish --release-root PRIVATE_ARCHIVE/RELEASE_ID --bucket bca-wales-public-releases --jurisdiction eu --identity timjroberts --mode manual
```

`stage` uploads only versioned keys, refuses a different object already present
at an immutable key, and downloads every object to verify its checksum. It does
not read or write `releases/current.json`. After launch acceptance, `publish`
checks the current release against `supersedes`, re-verifies the immutable
objects, then replaces `releases/current.json`. A failed upload or verification
leaves the current pointer untouched. R2's single-object replacement makes that
small final pointer change atomic for readers.

Cloudflare applies special R2 Data Catalog handling to object keys ending in
`.csv`. Accessible CSV assets therefore use a non-`.csv` terminal suffix while
retaining the `text/csv` media type and an explicit CSV description in the
release manifest.

Automatic mode is accepted only when there are no warnings and every used
source is explicitly registered as a routine candidate. The launch registry is
manual by default.

## Withdraw or roll back

To remove the current release without deleting its audit history:

```bash
npm run geodata -- withdraw --release-root PRIVATE_ARCHIVE/RELEASE_ID --bucket bca-wales-evidence-production --release-id RELEASE_ID --identity timjroberts --reason "PUBLIC EXPLANATION"
```

The command verifies the expected current release, writes an immutable
withdrawal record, then replaces `current.json` with an explanatory withdrawn
pointer. Versioned assets and manifests remain untouched. For rollback, first
construct and independently verify a `current-release.schema.json` pointer to a
known-good retained manifest, then pass it with `--replacement FILE`. Never
rebuild during an incident or silently substitute a different dataset.

After promotion, withdrawal or rollback, fetch `current.json`, its manifest and
one representative asset through the public asset hostname and verify the
recorded SHA-256. Confirm the homepage and `/evidence/` show the same state.
