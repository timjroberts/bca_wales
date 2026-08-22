# Deployment foundation runbook

Application deployment and evidence publication are two separate operations.
The explorer is built against the validated factual presentation contract in
`data/launch/explorer-release-2026-08-13.json`; the older illustrative fixture
remains a quarantined design record and is never served by the production app.

## Environments and accounts

The public site uses Cloudflare Pages. Immutable production display assets and
the small current-release pointer use Cloudflare R2 through a first-party asset
domain. Pull-request previews use a separate Pages project and package a pinned,
checksum-verified copy of the staged public release into each Pages deployment.
Their non-secret identifiers and delivery modes are recorded in
`config/environments/`.

The production Pages project is `bca-wales-explorer` and the EU-jurisdiction R2
bucket is `bca-wales-public-releases`. The intended public origins are
`https://explore.bca.wales` and `https://assets.bca.wales`. They must both
resolve before first promotion because the immutable release manifest records
the first-party asset origin. The R2 development hostname may be used for
candidate review, but it is not a valid substitute for publishing the current
pointer.

Tim Roberts owns the Cloudflare account, GitHub repository, production
environment and release approval. Secret values belong in GitHub environment
or repository secrets, never in source, builds, logs or R2.

## Credential scopes

- `CLOUDFLARE_PAGES_PREVIEW_TOKEN`: edit only the preview Pages project. It
  needs no R2 access: preview evidence is downloaded from immutable public
  production keys, verified, and uploaded as part of the Pages artifact.
- `CLOUDFLARE_PAGES_PRODUCTION_TOKEN`: edit only the production Pages project;
  expose it only through the protected `production` GitHub environment.
- Evidence-publication credentials are deliberately absent from the site
  workflows. The separate evidence workflow uses a token restricted to the
  correct R2 bucket, as detailed in the
  [evidence publication runbook](evidence-publication.md).
- `CLOUDFLARE_ACCOUNT_ID` is an identifier, not a secret, but keep its workflow
  configuration alongside the scoped tokens.

Rotate a token immediately after suspected disclosure or a responsibility
change. Revoke the old token in Cloudflare, replace the corresponding GitHub
secret, run a preview or controlled production deployment, and record the
change in the repository's operational log.

## Preview and production

Every pull request validates and builds an isolated Pages branch preview. The
build fetches the exact immutable release manifest named by the checked-in
explorer contract, verifies its SHA-256, downloads every allowlisted asset from
its versioned public key, verifies byte counts and checksums, and then places
the files under `/releases/<release-id>/` in the static export. Browser asset
URLs are same-origin, so both the branch alias and Cloudflare's immutable
hash-addressed deployment remain self-contained and require no R2 CORS rule or
preview evidence credential. Because Pages static delivery does not honour
PMTiles byte ranges, the staging step also adds a preview-only advanced-mode
Pages Function. It forwards ordinary assets unchanged and returns bounded `206`
responses only for range requests to versioned `.pmtiles` paths. This Function
is generated after the production build and is never part of a production site
deployment. The workflow exercises the deployed homepage, semantic route,
PMTiles byte ranges, GeoJSON and accessible download before it succeeds. It
never reads or creates `releases/current.json`, and it cannot write the
production bucket. Forked pull requests receive no Pages credential and
therefore validate and stage the public bytes without creating a hosted preview.

Production deployment is manual, runs in the protected `production`
environment and requires the evidence release identifier paired with the site
commit. Configure Tim Roberts as the required environment reviewer. The site
workflow cannot write to R2 or change the current evidence pointer.

When a static HTML route is removed, add each public path variant to
`config/cloudflare/retired-pages-routes.json` in the same change. The production
workflow validates that this allowlist contains only extensionless routes
outside `/_next` and `/releases`, then stages a minimal Pages Worker ahead of
the static asset binding. The worker serves the site's current not-found page
with `404`, `no-store` and `noindex` for those exact paths; every other request
continues to the normal static asset delivery. The preview workflow installs
the same guard alongside its PMTiles range support.

This tombstone is deliberate. Pages can retain a removed static object in a
datacentre for up to one week, and zone-level URL or prefix purges do not evict
that internal Pages object reliably. Keep retired paths in the allowlist while
an older deployment remains a supported rollback target. The production check
runs after deployment, so a stale retired response fails the workflow. The
guard uses the existing project-scoped Pages deployment credential and cannot
modify DNS, R2 or zone cache; it never purges hash-addressed `/_next` files or
immutable evidence assets.

For a controlled release, use this order:

1. Confirm both production hostnames, R2 CORS, Pages security headers and the
   restrictive Cloudflare credentials.
2. Stage the exact checksum-verified public bundle with `Stage evidence release`.
   This uploads and reads back only immutable versioned objects, retains the
   completed staged release as a private workflow artifact, and does not read or
   write `releases/current.json`. Record its run and final manifest SHA-256.
3. Merge the reviewed application commit. Dispatch `Deploy production site`
   with the exact staged evidence release identifier and final immutable
   manifest SHA-256; approve the protected environment only after its checks
   pass. Its post-deployment check verifies the versioned release directly and
   permits the current pointer to remain on the prior release.
4. Review the retained launch-acceptance candidate and the factual release's
   manual QA warnings. Tim Roberts records the explicit release decision.
5. Dispatch `Publish evidence release` with the successful staging run, exact
   release identifier and final manifest SHA-256. This is the single atomic
   change to `releases/current.json`; it downloads the retained staged artifact
   instead of rebuilding or reacquiring the approved candidate.
6. Retain the publication workflow's `npm run check:production` JSON output in
   the final launch record. Confirm the map, source details and accessible CSV
   journeys manually, then finalise the schema-valid acceptance record.

Never publish evidence first: a deployed site can safely report an unavailable
release, while a current pointer whose site or immutable URLs are not ready is
a public integrity failure.

## Rollback and recovery

Roll back the site to a known-good Cloudflare Pages deployment without changing
the evidence pointer. Roll back evidence by atomically restoring a previously
verified current-release manifest without redeploying the site. After either
operation, check the homepage map, source details, accessible CSV, current
manifest and one representative asset plus its checksum.

The target is restoration within one working day. Before launch, record the
known-good Pages deployment, current evidence release, asset checksum and the
result of one complete rollback/restore rehearsal. Do not rely on rebuilding
during the incident.

Rehearse rollback before approval by deploying the candidate, recording its
Pages deployment identifier, restoring the prior known-good Pages deployment,
and then restoring the candidate. Rehearse the evidence half without exposing
an invalid pointer: verify a retained replacement pointer and its immutable
manifest, exercise the guarded replacement path against the preview bucket,
and record the exact production target. A first production release has no
earlier factual release, so its emergency evidence action is withdrawal rather
than substitution.

## Security headers and CORS

Cloudflare Pages serves `apps/web/public/_headers`. Production R2 applies
`config/cloudflare/r2-cors.json`, which permits read-only range requests only
from the production Pages and first-party site origins. Pull-request previews
serve evidence from their own Pages origin and therefore do not widen the R2
CORS allowlist. Re-check headers and CORS after any new browser runtime or
external source is proposed. No analytics or client-side telemetry is enabled.

## Monitoring and hand-off

The `Monitor production` workflow runs every six hours and checks the
homepage, retired evidence route, service-information routes, security headers,
current pointer, immutable manifest and a representative PMTiles checksum. A
failed workflow run is the operational alert. Tim Roberts owns
release approval, Cloudflare, GitHub production access, incident response and
the within-one-working-day restoration target.

Routine factual updates follow the evidence publication runbook. Application
changes follow the protected site workflow and do not move the evidence
pointer. For an incident, first preserve the failing URLs, timestamps and
workflow output; then choose site rollback, evidence withdrawal, or verified
evidence replacement according to the failing component. Re-run the production
check after recovery and retain the output with the incident record.

Cloudflare's free Pages and R2 allowances are expected to keep the initial
service at GBP 0 per month. The owner should review Cloudflare usage monthly;
GBP 10 is the operating target and GBP 25 is the hard monthly ceiling at which
new publishing pauses pending a cost review.
