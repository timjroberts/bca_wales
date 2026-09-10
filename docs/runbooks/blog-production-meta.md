# Production Facebook Login preparation

Preparation for [Prepare the production Meta app and domain configuration](https://github.com/timjroberts/bca_wales/issues/132). This is a configuration handoff, not evidence of production deployment or Meta approval.

## App ownership and separation

Use a separate **BCA Wales** Meta app for production, connected to the existing **BCA Wales** portfolio. App contact and privacy contact: **bca@timjroberts.com**. Keep **BCA Wales Staging** (app ID `1274604161387297`) for the completed role-user and lifecycle rehearsals. Staging credentials and identities must not become production credentials or administrator grants.

The owner will complete portfolio verification using the association's available bank details. Portfolio verification and production App Review are separate gates. Do not submit staging for review as a substitute for production review.

## Production settings

The canonical production origin is fixed by `apps/blog/tooling/configure.mjs` to `https://bca.wales`.

| Meta setting | Intended production value |
| --- | --- |
| App name | BCA Wales |
| Contact email | bca@timjroberts.com |
| App domain | bca.wales |
| Website URL | https://bca.wales/ |
| Privacy policy URL | https://bca.wales/privacy |
| Valid OAuth redirect URI | https://bca.wales/auth/callback |
| Deauthorize callback | https://bca.wales/auth/deauthorize |
| Data deletion callback | https://bca.wales/auth/deletion |
| App category | Community and government |
| Requested permission | public_profile |

The approved icon source and 1024×1024 export are `apps/blog/branding/meta-app-icon.svg` and `meta-app-icon.png`. This table is the intended configuration; persisted dashboard settings must be checked and recorded in the task. Do not infer them from the table.

Use strict HTTPS redirect matching and server-side login. Do not request email or optional user_link. Record the production app ID and its actual Graph API version after creation. Store its app secret privately; never reuse the staging secret or put it in this document. Terms of service must point to a real approved policy if supplied, not Meta's default URL.

## Domain readiness

On 10 September 2026, read-only HEAD requests to both apex and www returned HTTP 200. Subsequent GET requests returned HTTP 525 at the apex and a JavaScript redirect to `/lander` at www. These inconsistent responses do not establish working production hosting or callback endpoints.

The existing Wrangler credential returned HTTP 403 when listing the `bca.wales` zone. DNS records, Worker routes and cache rules therefore remain uninspected in this preparation step. Inspect them through authorized dashboard access before proposing exact mutations; do not expand token permissions just to complete this document.

Before cutover:

1. Identify the current apex/www hosting owner and capture existing DNS, routes, redirects and cache rules for rollback.
2. Resolve the current origin/TLS conflict and choose an explicit www-to-apex redirect. Preserve `explore.bca.wales`, `assets.bca.wales`, their Pages project and evidence resources.
3. Review cache behavior so HTML, authentication, API, preview and media requests cannot bypass the blog Worker. Keep private responses uncacheable.
4. Obtain separate approval for the exact DNS/route changes. Then validate canonical redirects, HTTPS, `/privacy`, static assets and restricted responses using GET requests, not HEAD alone.

## Deployment and review sequence

1. Complete outstanding staging provider gates, including real scheduled backups/recovery and hosted Images validation. Confirm account-wide costs and spending approval.
2. Obtain production resource/deployment approval. Provision separate `bca-wales-blog-production` Worker/D1 and private EU content/recovery buckets as described in the deployment/recovery runbook.
3. Configure independent production secrets and reviewed resource IDs. Generate the ignored production config with authentication disabled, restriction enabled and publication paused. The generator intentionally writes no domain routes; the workflow does not provision resources.
4. Verify the existing production environment approval gate, main-only deployment and separate blog deployment credential. Keep release authorization disabled until the owner approves it.
5. Deploy the approved code and complete the separately approved domain cutover. Verify the real privacy and lifecycle URLs before treating the app as review-ready.
6. Configure and read back the production app settings. Prepare accurate reviewer instructions and a demonstration of the production app. Any reviewer access must have an explicit, bounded access plan; staging test switches reject the production origin.
7. Complete portfolio verification and production App Review. Demonstrate non-role Facebook Login on the production app before opening authentication/publication. Staging role-user success does not establish production approval.

See [the deployment and recovery runbook](blog-deployment-recovery.md) for credential, backup, rollback and erasure requirements.
