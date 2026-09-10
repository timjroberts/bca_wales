# Production Facebook Login preparation

Preparation for [Prepare the production Meta app and domain configuration](https://github.com/timjroberts/bca_wales/issues/132). This is a configuration handoff, not evidence of production deployment or Meta approval.

## App ownership and separation

The separate **BCA Wales** production app was created and verified in the dashboard on 10 September 2026: app ID `2069042727047389`, connected to the existing **BCA Wales** portfolio (`1997038300844373`). App contact and privacy contact: **bca@timjroberts.com**. Keep **BCA Wales Staging** (app ID `1274604161387297`) for the completed role-user and lifecycle rehearsals. Staging credentials and identities must not become production credentials or administrator grants.

The owner will complete portfolio verification using the association's available bank details. Portfolio verification and production App Review are separate gates. Do not submit staging for review as a substitute for production review.

## Production settings

The canonical production origin is fixed by `apps/blog/tooling/configure.mjs` to `https://bca.wales`.

| Meta setting | Saved production value |
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

The approved icon source and 1024×1024 export are `apps/blog/branding/meta-app-icon.svg` and `meta-app-icon.png`. The icon was uploaded to the production app and its preview inspected. Domain, privacy, website, category and deletion callback settings were read back after reload. OAuth and deauthorization settings also survived navigation away and back; Meta's exact-URI validator accepted the callback. This validates dashboard configuration only, not live endpoint delivery. The permissions page shows public_profile ready for testing; email and user_link remain unadded.

Both all-calls and app-role Graph API versions are **v26.0**. Client/Web OAuth are enabled; HTTPS and strict redirect matching are enforced. Embedded-browser, device and JavaScript SDK login remain disabled. The app remains unpublished. Its secret has not been revealed or installed in a production runtime.

The optional Terms of Service field restores `https://www.facebook.com/` after clearing, saving and reloading. This is an unresolved dashboard default, not an approved BCA terms policy. Resolve the field or supply an actual approved policy before review. No review was submitted.

## Domain readiness

On 10 September 2026, read-only HEAD requests to both apex and www returned HTTP 200. Subsequent GET requests returned HTTP 525 at the apex and a JavaScript redirect to `/lander` at www. These inconsistent responses do not establish working production hosting or callback endpoints.

The existing Wrangler credential returned HTTP 403 when listing the `bca.wales` zone. Subsequent read-only dashboard inspection confirmed two proxied apex A records, `13.248.213.45` and `76.223.67.189`, both with Auto TTL; www is a proxied CNAME to `bca.wales`, also Auto TTL. The Workers Routes page reports no configured routes. These DNS destinations are the current rollback baseline; the origin service's ownership has not been established.

The Page Rules page reports 0 of 3 used and no data. The caching page reports no Cache Rules and no Cache Response Rules. The general Rules overview displayed templates; it did not establish that all other rule types are absent. Redirect rules and other origin/transform settings still need an explicit cutover review.

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
