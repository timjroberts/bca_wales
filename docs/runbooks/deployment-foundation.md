# Deployment foundation runbook

This foundation keeps application deployment and evidence publication as two
separate operations. It contains no production evidence and does not make the
prototype's illustrative geometry or values publishable.

## Environments and accounts

The public site uses Cloudflare Pages. Immutable public display assets and the
small current-release pointer use Cloudflare R2 through first-party asset
domains. Preview and production use different Pages projects, R2 buckets,
credentials and hostnames; their non-secret identifiers are recorded in
`config/environments/`.

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

## Security headers and CORS

Cloudflare Pages serves `apps/web/public/_headers`. R2 applies
`config/cloudflare/r2-cors.json`, which permits read-only range requests from
the two first-party site origins. Re-check headers and CORS after any new
browser runtime or external source is proposed. No analytics or client-side
telemetry is enabled.

## Deferred launch operations

Domain provisioning, Cloudflare project and bucket creation, synthetic checks,
production smoke tests, billing alerts and the launch rollback rehearsal remain
with the final integration ticket. The repository now contains the immutable
release upload, verification, promotion and withdrawal path, but it does not
provision Cloudflare resources or publish a placeholder release.
