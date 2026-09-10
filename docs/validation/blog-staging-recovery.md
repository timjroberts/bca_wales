# Restricted blog staging recovery evidence

Executed on 10 September 2026 against the isolated resources in
[Demonstrate BCA Wales blog staging and provider launch gates](https://github.com/timjroberts/bca_wales/issues/118).
The owner approved provisioning, restricted deployment, and the two short-lived
operator credentials. Application access and production rollout remain gated.

## Live adapter defect and correction

Single D1 queries and S3 object write/read/list/delete checks passed in both
staging and recovery. The first live D1 batch checks returned HTTP 400: the
operator serialized a bare array instead of the provider's `{ "batch": [...] }`
request envelope. The corrected adapter sends one request with separate SQL and
parameters for each statement, and rejects unsuccessful statement results.

The [D1 query contract](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/)
documents this envelope. Live checks confirmed parameter preservation and
rollback: a batch that inserted a marker and then violated its unique constraint
failed, and a separate read found no marker in either database. Local regression
tests cover the envelope, parameters, and safe failure without retrying individual
writes. All 31 blog tests and focused ESLint checks pass.

## Credentials and resource boundaries

- D1 operator: only D1 Write, scoped to the account because the dashboard offered
  no individual database scope. The owner explicitly approved that broader scope.
  Token verification reports active, expiring `2026-09-17T23:59:59Z`.
- R2 operator: Object Read & Write for only the three EU blog staging/recovery
  buckets; the dashboard reports expiry on 17 September 2026. A real attempt to
  list the existing evidence bucket returns HTTP 403.
- Both tokens are stored in a Git-ignored local directory with mode 0700 and a
  credential file with mode 0600. No token values are recorded in source or issues.
- The deployed Worker stays at version
  `8e8f688c-4f61-48f4-89fc-3f1cd9378af3`, built from merged main
  `61910165c429d584cbd5784020700c56a25dbe17`. This operator-only fix does not
  require a Worker deployment.

## Paired backup and restricted restore

The operator rehearsal ran from Node 22.18.0 using the real D1 management API and
EU R2 S3 endpoint. It required empty staging/recovery stores, verified restricted
and publication-paused settings, and seeded two explicitly synthetic posts, two
comments and four source/render objects. Fixture setup used operator SQL; it did
not enable public access, sign in through Facebook, or demonstrate user actions.

The paired backup contains 4,015 serialized database bytes and four verified
objects. Receipt:

```text
manifest: backups/1789039909-7169f1bb-c452-4446-85c0-134cceaf1105/manifest.json
SHA-256: f1f9d403340681e8ca4b7c59e3cb3a14e6bc8b2b68c1f18638df6fbf87776794
```

Six later actions were journaled: hide comment, delete comment, withdraw post,
remove administrator, revoke session, and erase the second author. The independent
head was observed at sequence 6, with hash
`353fe3d7ba315050cbfa3eedb6c273aaeaf72e37ddfbd8231eba4206483af54e`.
The only fixture writer was the sequential rehearsal driver; HTTP access remained
503, with no staging leases or undelivered outbox rows. These observations establish
completeness for this controlled rehearsal, not for an arbitrary future incident.

Both negative checks refused restoration before inserting any posts into the
recovery database: unconfirmed journal completeness, and an actually missing R2
journal receipt. The synthetic missing receipt was restored from its independently
verified bytes and metadata before the successful recovery.

The successful restore copied and verified all four objects and replayed all six
actions. Hidden comments stayed hidden, deleted comment text and attribution stayed
absent even after an attempted replay of restoration, both article projections
returned 404, the session revocation survived, historical administrators were
cleared, and the outbox sequence remained 6. Both environments stayed restricted
and publication-paused.

Erasure maintenance removed the second author's live objects and attribution in
both stores, and correctly kept completion pending while retention confirmation
was false. The live recovery bucket rules were then rechecked: backups expire at
30 days, journal objects at 37 days, and the head has no object-expiry rule. The
dashboard confirms Workers Free, whose documented
[D1 Time Travel horizon is seven days](https://developers.cloudflare.com/d1/platform/limits/).
The private operator configs record that retention confirmation; maintenance then
completed the synthetic erasure in both stores. This verifies configured policy
and application behavior, not the passage of the full expiry period.

## Remaining limits

This small remote fixture proves operator transport and recovery semantics. It
does not prove scheduled Worker execution, daily backup reliability, large-dataset
time/memory bounds, real session-key retirement or independently verified human
administrator re-enrollment. No authentication keys are installed in the Worker.
Backup and journal evidence remains under the configured lifecycle. The remaining
live synthetic fixture stays private; no public content was enabled.

Workers Free and R2 Paid were already active; the displayed R2 cycle usage was
within its included allowance. An existing USD 10 budget alert is configured, but
its delivery was not tested. A supported scheduled-failure alert, complete account
cost sizing and the GBP 25 publication/upload pause remain launch requirements.
Real Meta login/callbacks, Images processing, crawler behavior and DNS/cache
reconciliation also remain open. No paid activation, DNS change, merge or
production release was performed.
