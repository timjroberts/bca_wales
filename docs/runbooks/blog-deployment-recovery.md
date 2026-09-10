# Blog deployment and recovery

The implementation is reviewed in [Implement the independent BCA Wales blog](https://github.com/timjroberts/bca_wales/pull/117). Its specification is [Review the implementation-ready BCA Wales blog design](https://github.com/timjroberts/bca_wales/issues/107). Tim Roberts owns deployment approval, provider configuration, incidents, privacy requests and recovery.

**No blog resources, production deployment, DNS changes or paid activation were performed during implementation.** Local tests do not clear the [staging and provider launch gates](https://github.com/timjroberts/bca_wales/issues/118). Obtain those approvals before executing remote commands below. Merging also requires separate approval.

## Boundaries

`apps/blog` is an independent Worker workspace. It owns apex landing/blog HTML, `/api/`, `/auth/`, `/account/`, `/admin/`, `/preview/`, `/media/` and its public `/static/` assets. Browser navigation uses the public article API; direct requests serve the same sanitized article body with neutral Open Graph metadata. There is no crawler-only response or public draft URL.

The existing `apps/web` static Next.js export stays on explorer Pages. `explore.bca.wales`, `assets.bca.wales`, `bca-wales-public-releases` (EU) and the existing Pages/evidence/FIRMS workflows are not blog resources. Do not reuse their tokens, buckets, current-release pointer or DNS routes. The new deployment workflow does not create domain routes.

D1 primary is authoritative for publication, revisions, ownership, allowlisting, revocation, comments, receipts and recovery fences. No replica sessions, KV authority, edge content cache, service worker or public R2 URLs are used. Dynamic responses are no-store; private/error responses are also private. R2 sources and render manifests are checksummed; publication stages and verifies objects before a guarded transactional pointer/receipt commit. Save never changes public metadata. Stale writes return 409. Withdrawal advances the same version, fencing a publication already in preparation.

A failed/missing authority or object returns 503; unknown/private/withdrawn resources return 404. HEAD and media variants obey the same current-state rules. Already delivered screens, downloads and third-party caches cannot be recalled. Unsupported ranges and archival-original variants are rejected.

## Local commands and evidence

Use the repository Node 22 version, not a shell-default Node 23:

```sh
npm ci
npm run check:blog
npm run check
npm run build --workspace @bca/blog
cd apps/blog
npx playwright install chromium
npm run test:browser
```

On a Mac with Chrome installed, `BCA_BROWSER_EXECUTABLE` can point to the existing Chrome executable instead of installing a Playwright browser. Browser tests use isolated local HTTPS Workers, synthetic identities and test-only cookies inserted by the test driver. There is **no fake-login HTTP endpoint or production authentication bypass**. `npm run dev --workspace @bca/blog` serves the local public application with authentication disabled. Apply the local migration first with `npx wrangler d1 migrations apply bca-wales-blog-local --local --config apps/blog/wrangler.jsonc`.

Tests use the pinned Wrangler-compatible Miniflare v5 alpha through `convertV4MiniflareOptions`; the assets test explicitly sets `has_user_worker`. Tests cover the actual bundled Worker as well as adversarial storage races. The image adapter in tests uses sharp to exercise real raster decoding and the output contract. It does not prove the hosted Images binding works. The production renderer/editor does not import the throwaway prototype or that image test adapter.

The browser script writes screenshots and a concise result to `/tmp/bca-blog-*`; they contain synthetic data. It demonstrates rich-text/list/callout round trips, saved-public separation, stale-conflict preservation, mobile controls, SPA navigation and deliberate versioned reveals. See [blog acceptance evidence](../validation/blog-acceptance.md) for the test-to-contract mapping and unperformed gates.

## Provisioning and configuration — requires approval

Create separate staging and production resources only after approval:

| Resource | Staging | Production |
| --- | --- | --- |
| Worker | `bca-wales-blog-staging` | `bca-wales-blog-production` |
| D1 | `bca-wales-blog-staging` | `bca-wales-blog-production` |
| Private EU R2 content | `bca-wales-blog-staging-content` | `bca-wales-blog-production-content` |
| Private EU R2 recovery | `bca-wales-blog-staging-recovery` | `bca-wales-blog-production-recovery` |

Disable r2.dev and custom-domain public access for both buckets. Do not enable public CORS. Worker bindings are the application access path. Use independent recovery credentials, retained outside a D1 restore. Set provider lifecycle rules on recovery prefixes: `backups/` expire in at most 30 days; `journal/` expire in at most 37 days. Do not expire `journal-head.json`; its sequence must remain continuous. Application cleanup is a retry path, not a substitute for provider backup-expiry enforcement. Verify any provider Time Travel/backups also fit the published horizon before setting `BACKUP_RETENTION_CONFIRMED=true`.

`tooling/configure.mjs staging|production` generates an ignored Wrangler file from explicit identifiers and reviewed environment variables. It defaults to restricted mode, paused publication, disabled authentication/backups and no Images binding. It writes neither secrets nor domain routes. Production origin is fixed to `https://bca.wales`; staging rejects the production/explorer/evidence origins.

Required configuration variables are documented by the script and the manual deployment workflow. To enable authentication, supply a numeric app ID, actual reviewed Graph version and active session key ID. Use the actual app dashboard's version; do not treat the synthetic test version as provider approval. Enable Images and backups only after their resource/spending/retention gates pass.

Store these secrets with `wrangler secret put --config <generated-config>` or an approved secret-management process; never echo them, commit them or put them in frontend environment variables:

- `FACEBOOK_APP_SECRET` — Meta app secret, different apps for staging/production.
- `SESSION_KEYS` — JSON object mapping key IDs to independent 32-byte base64url keys; `SESSION_ACTIVE_KID` selects issuance.
- `TRANSACTION_KEY` — separate 32-byte base64url key for ten-minute OAuth transactions.
- `CSRF_KEY` — separate 32-byte base64url HMAC key.
- `RATE_KEY` — independent high-entropy secret (at least 32 characters) for temporary subject/IP counter tags.

Use a cryptographic generator, such as Node's `randomBytes(32).toString('base64url')`, in a private terminal/secret manager. Do not paste values into issue comments, PRs or command logs.

Routine rotation keeps old session keys only for their maximum eight-hour lifetime plus the operator's 60-second retirement margin. Session validation does not extend expiry. Emergency removal of old keys logs everyone out. Changing transaction keys invalidates in-progress logins. Replacing the Meta app requires a deliberate app-scoped identity migration; IDs are not portable email addresses.

## Facebook gate and operator enrollment

For an owner-approved role-user login rehearsal, the isolated `bca-wales-blog-staging.<account>.workers.dev` Worker supports `/staging/login`. Keep `RESTRICTED=true`, `AUTH_ENABLED=false` and `PUBLISH_PAUSED=true`. Install a separate random 32-byte base64url `STAGING_LOGIN_TEST_TOKEN` secret and deliberately set `STAGING_LOGIN_TEST_UNTIL` to a Unix timestamp no more than one hour ahead. Both are omitted from normal generated deployment configuration. The database `restricted` setting must be explicitly `false`; active database recovery still blocks the tester.

Enter the test token in the password form, never a URL. Its secure HttpOnly SameSite=Lax cookie admits only the test page/script, `/auth/login`, `/auth/callback` and `/staging/logout`. These invoke the regular OAuth/session handlers with authentication enabled only within the rehearsal. A successful callback returns to the test page to show the name and session expiry; it does not enroll an administrator. Content, administration, comments and lifecycle callbacks remain fenced. The normal application still has authentication disabled. This is role-user login evidence only, not public access or lifecycle evidence.

The server checks the absolute deadline on every request. After the rehearsal, remove `STAGING_LOGIN_TEST_UNTIL` from the ignored config, redeploy, and delete `STAGING_LOGIN_TEST_TOKEN`. Expiry, token rotation, missing flags, an unexpected origin or the database recovery switch stops access. Record actual provider results separately from synthetic tests; never include access codes, cookies, provider tokens or private identifiers in the evidence.

The app uses server code exchange and inspected token app/type/subject/scopes/expiry, then a matching `/me` identity. It discards the user token. One-time browser-bound state protects the callback. All other mutations require the exact Origin and a session-bound custom CSRF header. Configure only `<origin>/auth/callback` as the login callback, `<origin>/auth/deletion` for signed deletion and `<origin>/auth/deauthorize` for signed deauthorization.

Demonstrate non-role public login and the actual access, business verification, publishing and ongoing checkup requirements. Test provider callback payloads, token/data-access expiry and code-injection defenses; PKCE support has not been established. Optional `user_link` stays disabled until approved/tested. Missing optional fields fall back to a plain name/neutral avatar. No email permission is requested and there is no authenticated-user account table.

The public privacy and deletion page is `/privacy`, with `bca@timjroberts.com` as the owner-approved contact. `/privacy/` and the former `/blog/privacy/` address redirect there. The policy and its fixed stylesheet remain readable during restriction without D1/R2 access; the policy loads no application JavaScript. Configure Meta with the actual staging origin plus `/privacy` and verify reachability. Before public authentication, validate the published privacy/retention process against the actual Meta requirements. Neither local tests nor this runbook assert legal/provider certification.

An authenticated person obtains their private identifier from `/account/`. Verify them out of band, then use the operator-only CLI. Every active administrator can manage every post. There is no web enrollment endpoint and no trusted role in the cookie.

```sh
node apps/blog/tooling/operator.mjs help
node apps/blog/tooling/operator.mjs status apps/blog/operator.local.json --remote
node apps/blog/tooling/operator.mjs grant-admin apps/blog/operator.local.json --remote 'facebook:APP_ID:SUBJECT_ID'
node apps/blog/tooling/operator.mjs remove-admin apps/blog/operator.local.json --remote 'facebook:APP_ID:SUBJECT_ID'
```

Copy `operator.example.json` to an ignored operator configuration and fill the isolated resource identifiers. Use scoped `BCA_BLOG_D1_TOKEN`, `BCA_BLOG_R2_ACCESS_KEY_ID`, `BCA_BLOG_R2_SECRET_ACCESS_KEY` and, for erasure-counter cleanup, `BCA_BLOG_RATE_KEY`. R2 S3 credentials and the D1 management token are operator credentials, not Worker secrets or browser data. The [restricted staging rehearsal](../validation/blog-staging-recovery.md) verifies the remote adapters and a small paired restore, including the corrected D1 REST batch envelope. It does not establish scheduled-backup reliability or load limits. D1 token permissions were account-wide in the inspected dashboard; the owner explicitly approved a short-lived D1-only operator token. R2 object credentials were restricted to the three blog buckets. Recheck and approve actual permission scope when issuing replacements.

Administrator removal journals its action. Granting is an explicit independently verified operator decision; after restore, all historical grants are discarded and require reapproval. If the last administrator is lost, the same operator path restores access. Do not weaken session validation or enroll by matching a name/email.

## Deployment and cutover

The `Deploy approved blog Worker code` workflow is manual. Staging uses the `blog-staging` environment; production reuses the owner-reviewed `production` approval gate with **a separate `BCA_BLOG_DEPLOY_TOKEN`**. Configure Tim Roberts as required reviewer and restrict production to main. `BCA_BLOG_CODE_DEPLOY_APPROVED=true` must be explicitly recorded in the selected environment. The token must be scoped to the blog Worker/D1 and required blog bindings, with no evidence-publication or DNS permissions. Confirm the actual provider scope granularity before installing it.

The workflow validates/builds, applies the reviewed blog migrations and deploys code without domain routes. It does not provision resources or secrets. For later schema changes, use forward-compatible migrations and a tested rollback/restore plan; do not overwrite an applied migration. The initial migration is only for a new database.

After staging gates pass, obtain separate production/spending and DNS/cutover approval. On 8 September 2026, apex HTTPS served a JavaScript redirect to `/lander`; www returned 525. Both already resolved through Cloudflare. Identify the existing apex owner/service, reconcile the conflict and www TLS, and then explicitly attach only the approved apex/www Worker routes. Leave explorer/evidence hostnames unchanged. Review cache rules so no HTML/API/auth/preview/media response can bypass the Worker. A temporary DNS/route workaround is not launch acceptance.

Before reopening: check canonical HTTPS and www redirects, all public/private status codes and HEAD, login/logout/removal, drafts and hidden-original absence, image initial requests and metadata, publish/unpublish races, deletion status, health/backup alerts and real Facebook first-share/edit/withdrawal behavior. Record actual Worker version/database migration/backup pairing in the linked launch ticket. No automated workflow here merges a PR or changes DNS.

## Content operation failures

Save/publish/comment clients send stable operation keys with actor/target/action/input digest. Identical retries recover the committed result; reusing a key for different input returns 409. Keep local drafts/comment text after errors. Private source is never stored in browser localStorage. A downloaded rescue document is private user data and needs deliberate handling.

Unpublish clears the public pointer and advances the version. Permanent deletion requires unpublish first and sets a fence before cleanup. Reversible hiding retains the original privately; deletion removes it permanently and later restore cannot recover it. Private inspection itself is audited. Public comment projections omit hidden attribution, reason and original text.

Uploads default sensitive, require approved derivatives and never expose originals. Source sensitivity cannot downgrade the asset floor. Replacement uses a fresh asset ID; reclassification of a sensitive asset requires replacement/review. Changes to warning/sensitivity are included in the exact reveal key. Pixelation can still be recognizable: inspect the safe preview and choose the neutral placeholder when necessary. Do not substitute a CSS blur or public original URL if processing fails.

Current public/draft revisions are retained; noncurrent revisions expire after at most 30 days. Orphan staging has a 24-hour grace period and fresh reference checks. Durable in-flight staging records protect cleanup. **An expired staging lease is an alert, not proof the writer is dead:** it is not silently discarded. Stop/verify the old execution has terminated before an operator removes its staging row, then rerun maintenance. This can keep an erasure pending, deliberately, instead of falsely declaring completion while a late object write remains possible.

## Daily backup and restricted recovery

The hourly scheduled handler retries maintenance and, with `BACKUPS_ENABLED=true`, creates a paired backup when the previous snapshot is at least 24 hours old (on the next successful hourly invocation). It takes a D1 transactional snapshot, copies referenced R2 sources/renders/media, verifies checksums and writes the completed manifest last. Failed copying leaves no successful backup pointer. Sources may change during copying; missing objects fail the backup rather than manufacturing consistency. The independent journal reconciles later withdrawals, moderation, erasure and revocation.

The v1 synchronous backup has explicit 100,000-row/table and 20 MiB serialized-D1 guards. Measure actual staging time/memory at the expected retained-content size. Reaching a guard or runtime budget is an operator alert and requires a durable/chunked-job design before further growth. Do not raise bounds blindly or claim infinite synchronous capacity.

Recovery journal records receive monotonic D1 sequence numbers. The independent R2 head advances only through contiguous verified receipts with conditional updates. Mutation fences happen first, but operations needing journal durability do not report full success before the receipt is stored. A failed acknowledgement can therefore mean the original operation committed; retry it instead of assuming no action occurred.

Target recovery point: 24 hours for content. Target recovery time: one working day. Rehearse in **separate restricted resources**:

1. Stop new writes and preserve the incident's independently observed journal head and any outstanding-operation evidence. Set `RESTRICTED=true` in the Worker environment, not only a D1 setting. Do not attach public routes to recovery resources.
2. Identify the paired backup manifest and its checksum. Confirm it is within 30 days and the independent recovery journal covers all subsequent security/visibility actions. Missing receipts, uncertain last sequence or an unacknowledged action whose disposition cannot be established blocks reopening. A contiguous file sequence alone does not prove there were no unjournaled in-flight actions.
3. Use a separate recovery D1/content bucket and the independently retained recovery bucket. Apply the compatible migration first. The CLI refuses a non-recovery/nonrestricted configuration. Example, with values obtained from verified private receipts:

   ```sh
   node apps/blog/tooling/operator.mjs restore apps/blog/operator.recovery.json --remote BACKUP_MANIFEST_KEY MANIFEST_SHA256 JOURNAL_SEQUENCE JOURNAL-COMPLETE-AND-WORKER-RESTRICTED
   ```

4. Restore verifies every paired object and journal entry before replacing authority. It imports the database/objects, replays later hide/delete/withdraw/revoke/erase actions, advances the outbox sequence and clears administrators. It never reopens service. Retire session keys independently; copied historical cookies must not work.
5. Reconcile historical pending staging with evidence the original writers terminated. Run maintenance to finish erasure and deletion. Review media uploaded by an erased contributor in another author's post before any corrected publication. Reapprove administrators independently, never from the old snapshot.
6. Check hidden/deleted/private projections and old-media bypasses from separate clients. Confirm recovery/backup lifecycle expiry and operational alerts. Only an explicitly approved reopening may clear the D1 restricted switch and deploy an unrestricted Worker configuration. If evidence is incomplete, keep uncertain content unavailable.

A code rollback uses a compatible earlier Worker build while keeping current D1 authority; never restore a database merely to roll back frontend code. Content rollback means loading a compatible retained source, saving it as a **new** draft and explicitly publishing under current permissions/fences, not pointing a public URL at an old object.

## Monitoring, retention and budget

The scheduled handler records `maintenance_success` or `maintenance_failure` in D1 settings and throws only a generic message on failure. If the database itself is unavailable or an execution is terminated before recording failure, the last-success timestamp eventually becomes overdue. `/api/ops/health` provides authenticated aggregate monitoring while the application remains restricted; it cannot read content or grant administrator access. Install an independent, random 32-byte `MONITOR_TOKEN` Worker secret and send it only as an HTTPS `Authorization: Bearer` header. Do not put the credential in query strings, configuration variables, source control or logs. Missing/invalid credentials receive 404; only GET/HEAD are accepted. Responses remain private/no-store.

The endpoint returns 503 for a maintenance failure at or after the last success, no successful maintenance in three hours, a backup older than 26 hours, disabled backups/unconfirmed retention, or pending erasure/recovery/stale staging records. These thresholds assume the hourly maintenance schedule. Future/invalid timestamps fail closed. A later successful invocation clears a previous failure; an overdue backup needs a completed paired snapshot. `/api/admin/health` and the operator `status` command remain available for their existing operator uses.

The inspected staging account offered no Workers notification option, so `.github/workflows/monitor-blog.yml` independently checks restricted staging at minutes 17 and 47. Store the same narrow credential as repository secret `BLOG_STAGING_MONITOR_TOKEN`; the workflow receives no D1, R2 or deployment credentials. It rejects redirects, unexpected responses and stale timestamps without printing provider responses. Rotate both copies together. To check manually, securely supply `BLOG_HEALTH_URL` and `BLOG_MONITOR_TOKEN` to `node apps/blog/tooling/monitor.mjs`; exit 1 requires investigation.

Recurring GitHub execution requires this workflow on the default branch. GitHub schedules can be delayed or dropped under load, and public-repository schedules disable after 60 days without repository activity; this is a best-effort watchdog, not a guaranteed alert deadline. Enable GitHub Actions notifications for the owner who controls the schedule, confirm the intended email/web destination, and demonstrate a failed workflow followed by recovery and actual receipt before treating notification delivery as passed. Inspect the workflow's own recent runs as well. See [GitHub scheduling behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) and [workflow notification settings](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs). A successful local checker invocation alone does not prove hosted scheduling or delivery. Staging evidence is recorded in [scheduled backup and watchdog validation](../validation/blog-staging-monitoring.md). Observe authentication/callback error rates and missing-artifact 503s without logging URL queries, request bodies, cookies, tokens, provider subjects or private content. Automatic full request logging is disabled in generated configs; use metadata-only metrics. The repository validation workflow is not a substitute for hosted monitoring.

Target live erasure within 24 hours; investigate pending work before that deadline. Completed jobs require enforced backup expiry. Security nonces/counters/operation receipts expire as designed; moderation audits at 90 days, identifying fields sooner upon erasure; deletion/recovery receipts at 37 days. Apply provider lifecycle rules so outages in application cleanup cannot make backups indefinite.

Measure up to 10 new/updated posts, 100 images, 10,000 page views and 2,000 comments/month, including retained revisions/backups and existing account use. The combined target is GBP 10/month; at GBP 25, pause new publication/uploads pending review:

```sh
node apps/blog/tooling/operator.mjs pause apps/blog/operator.local.json --remote
```

Pausing does not disable deletion/moderation. Billing alerts are not a provider-enforced spending cap. Include Images transformations (four per uploaded image in the initial pipeline), R2 operations/storage/backups, D1, Worker usage, taxes and currency movement. Actual plan/quotas/costs were not established by local testing. Paid activation and exceeding the envelope require approval.
