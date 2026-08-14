# Deployment foundation runbook

Application deployment and evidence publication are two separate operations.
The explorer is built against the validated factual presentation contract in
`data/launch/explorer-release-2026-08-13.json`; the older illustrative fixture
remains a quarantined design record and is never served by the production app.

## Environments and accounts

The public site uses Cloudflare Pages. Immutable public display assets and the
small current-release pointer use Cloudflare R2 through first-party asset
domains. Preview and production use different Pages projects, R2 buckets,
credentials and hostnames; their non-secret identifiers are recorded in
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

- `CLOUDFLARE_PAGES_PREVIEW_TOKEN`: edit only the preview Pages project.
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

Every pull request validates and builds an isolated Pages branch preview. It
can read only preview evidence through the preview asset origin. Forked pull
requests do not receive deployment credentials and therefore run validation
without a hosted preview.

Production deployment is manual, runs in the protected `production`
environment and requires the evidence release identifier paired with the site
commit. Configure Tim Roberts as the required environment reviewer. The site
workflow cannot write to R2 or change the current evidence pointer.

For the first release, use this order:

1. Confirm both production hostnames, R2 CORS, Pages security headers and the
   restrictive Cloudflare credentials.
2. Merge the reviewed application commit. Dispatch `Deploy production site`
   with the exact evidence release identifier and immutable manifest SHA-256;
   approve the protected environment only after its checks pass.
3. Review the retained launch-acceptance candidate and the factual release's
   manual QA warnings. Tim Roberts records the explicit release decision.
4. Run the manual evidence `publish` command in the evidence runbook. This is
   the single atomic change to `releases/current.json`.
5. Run `npm run check:production` through the public hostnames and save its JSON
   output in the final launch record. Confirm the map and semantic evidence
   journeys manually, then finalise the schema-valid acceptance record.

Never publish evidence first: a deployed site can safely report an unavailable
release, while a current pointer whose site or immutable URLs are not ready is
a public integrity failure.

## Rollback and recovery

Roll back the site to a known-good Cloudflare Pages deployment without changing
the evidence pointer. Roll back evidence by atomically restoring a previously
verified current-release manifest without redeploying the site. After either
operation, check the homepage, `/evidence/`, the current manifest and one
representative asset plus its checksum.

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

Cloudflare Pages serves `apps/web/public/_headers`. R2 applies
`config/cloudflare/r2-cors.json`, which permits read-only range requests from
the two first-party site origins. Re-check headers and CORS after any new
browser runtime or external source is proposed. No analytics or client-side
telemetry is enabled.

## Monitoring and hand-off

The `Monitor production` workflow runs every five minutes and checks the
homepage, semantic evidence route, service-information routes, security
headers, current pointer, immutable manifest and a representative PMTiles
checksum. A failed workflow run is the operational alert. Tim Roberts owns
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
