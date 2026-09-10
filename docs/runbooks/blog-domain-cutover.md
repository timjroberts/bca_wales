# BCA Wales domain cutover proposal

Prepared on 10 September 2026 for [Prepare the production Meta app and domain configuration](https://github.com/timjroberts/bca_wales/issues/132). **Proposal only: no production deployment, DNS mutation or public authentication is authorized by this document.**

## Intended result

Attach exactly `bca.wales` and `www.bca.wales` as Custom Domains of `bca-wales-blog-production`. The existing Worker serves the apex and redirects ordinary GET/HEAD requests from www to `https://bca.wales`, preserving path and query. Its wrong-origin checks reject writes and `/auth/`, `/api/`, `/preview/` and `/media/` requests with 400 instead of forwarding credentials. Do not add a blanket www redirect that overrides that behavior.

The owner confirmed that the domain is unused apart from the explorer. Replace the apex/www hosting; preserve all other DNS records, `explore.bca.wales`, `assets.bca.wales`, the explorer Pages project and evidence infrastructure. Do not use a wildcard domain or route.

Custom Domains make the Worker the origin for every path on each exact hostname, with Cloudflare-managed DNS and certificates. The existing www CNAME must be removed before attaching that hostname. [Cloudflare Custom Domains documentation](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

## Inspected baseline

| Setting | Observed value |
| --- | --- |
| Apex A | `13.248.213.45`, proxied, Auto TTL |
| Apex A | `76.223.67.189`, proxied, Auto TTL |
| www CNAME | `bca.wales`, proxied, Auto TTL |
| Worker routes | None |
| Legacy Page Rules | 0 of 3 used |
| Cache Rules / Cache Response Rules | None / none |
| SSL/TLS mode | Full; automatic mode enabled |
| Universal edge certificate | Active for `*.bca.wales` and `bca.wales`, expires 12 November 2026 |
| Backup edge certificate | Issued, same host coverage and expiry |
| Always Use HTTPS | Off |
| Minimum TLS | TLS 1.0 (default) |
| TLS 1.3 / Automatic HTTPS Rewrites | On / on |

Earlier HEAD probes returned 200, while later GET probes produced apex 525 and a www JavaScript redirect to `/lander`. Restoring these records would restore the old configuration, not a known healthy site.

The general and filtered redirect Rules pages displayed templates rather than an explicit complete inventory. Cloudflare Traces for GET `https://bca.wales/privacy` and `https://www.bca.wales/blog/` showed URL normalization, bot-management evaluation and cache-key processing; no redirect or origin-routing stage was shown. The apex normalization action does not propagate to the origin. Trace is a configuration simulation, not a real successful origin response, and these requests do not rule out path-, method- or client-specific rules. Capture exact rule inventories or representative traces again immediately before execution; stop if an unexpected redirect, origin override, challenge or cache override applies.

## Exact change set for future approval

1. Provision and deploy the separately approved production Worker, D1 and private EU R2 resources using the existing deployment runbook. Set `ORIGIN=https://bca.wales`, `RESTRICTED=true`, `AUTH_ENABLED=false`, `PUBLISH_PAUSED=true`; keep the database recovery switch restricted. Do not copy staging test deadlines, capabilities, identities or secrets. Keep workers.dev and preview URLs disabled.
2. Record the deployed version, resource IDs, health result, recovery evidence and current configuration. Recheck the baseline above and export DNS/rule settings privately. Record the IDs of the three apex/www records so every mutation is scoped precisely. Confirm both hostnames are eligible for a Custom Domain and inspect Cloudflare's proposed DNS/certificate changes before committing them.
3. During the approved window, remove only the two listed apex A records and attach `bca.wales` to `bca-wales-blog-production` through **Worker → Settings → Domains & Routes → Add → Custom Domain**. Allow only the exact apex DNS/certificate changes. Wait for the binding and certificate to become active, then validate the restricted apex responses below.
4. Remove only the www CNAME and attach `www.bca.wales` to the same Worker. Verify its certificate/binding and canonical behavior. Record Cloudflare-created DNS, domain and certificate identifiers for rollback. A failed step may cause temporary apex/www unavailability; schedule accordingly.
5. Leave zone-wide TLS mode, minimum TLS, HTTPS toggles, HSTS, normalization, bot settings and all unrelated records unchanged. The Worker handles canonical redirects. Any later TLS hardening or rule changes require a separately scoped proposal because they can affect the explorer/evidence hosts.
6. Do not add Page Rules, a zone-wide redirect, cache-everything behavior or wildcard Worker routes. The Worker sets `Cache-Control: private, no-store` on responses and runs before static assets. Verify the edge honors that behavior; if it does not, stop and prepare an exact-host cache correction before reopening.

Manage the two domain bindings separately from routine code deployment. The generator deliberately omits routes. Inspection of pinned Wrangler 4.121.0 shows domain publication is called only when a nonempty custom-domain list is supplied. Recheck binding persistence after the first subsequent approved code deployment and whenever Wrangler changes; do not add route management to a credential intended only for code deployment.

## Restricted cutover acceptance

Use synthetic query values only; never put real OAuth codes, tokens or deletion receipts into shared logs. Verify GET as well as HEAD and inspect status, Location, content type, cache headers and certificate validity. Do not bypass TLS errors.

| Request | Required result while restricted |
| --- | --- |
| `https://bca.wales/privacy` | 200; BCA privacy content/contact; no login script |
| `https://bca.wales/static/blog.css` | 200 CSS |
| `https://bca.wales/blog/` | 503, Retry-After 60 |
| `https://bca.wales/auth/callback` | 503; no authentication enabled |
| `https://bca.wales/api/session` | 503 |
| `https://bca.wales/staging/login` | 503; no staging bypass |
| `https://www.bca.wales/blog/?tag=wales` | 308 to `https://bca.wales/blog/?tag=wales` |
| `http://bca.wales/privacy` | 308 to `https://bca.wales/privacy` |
| `http://www.bca.wales/privacy` | 308 directly to `https://bca.wales/privacy` |
| www `/auth/callback`, `/api/session`, `/preview/example`, `/media/example` | 400, no Location |
| POST to www `/blog/` | 400, no Location |

Worker responses must carry `private, no-store`; repeat requests to ensure no old `/lander` HTML or edge cache bypass appears. Confirm the authenticated aggregate health endpoint with its private production monitor credential, without logging that credential. Verify explorer HTML/assets and the existing evidence current-release pointer against a pre-cutover baseline. Do not purge the whole zone.

A local source-level probe of the existing Worker confirmed representative www/HTTP 308 responses, wrong-origin 400 responses, privacy 200 and restricted blog 503 without accessing storage; all returned `private, no-store`. This is local behavior evidence only. Hosted bindings, HTTP handling, certificates and cache behavior still require the live checks above.

## Rollback

For an application defect, keep the domains attached and restore the last verified production code version with restriction enabled, authentication disabled and publication paused. Preserve production D1/R2 and recovery state; do not run down-migrations or restore a database merely to undo routing. If writes have ever been opened, use the recovery/erasure runbook before any restore or reopening.

If the domain attachment itself must be undone, detach only the new apex/www bindings, inspect their generated DNS records, remove only those records attributable to this cutover, and restore the three baseline records exactly. Recheck DNS and explorer/evidence immediately. Do not delete the production Worker, database, buckets or secrets as part of routing rollback. Custom-domain certificates may remain after detachment; inventory them and remove only newly created unused certificates if separately approved, never the existing universal/backup coverage. [Cloudflare certificate lifecycle](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/#certificates)

Rollback to the recorded DNS can reproduce parking/525 behavior. Prefer a restricted Worker maintenance response when the edge binding is healthy. Do not describe old-host restoration as service recovery.

## Release gates

The proposal is ready to review; execution awaits approval of production resources, costs and this exact domain change set, together with the staging Images and scheduled-backup evidence. Domain attachment initially exposes only restricted responses and the public privacy page. Portfolio verification, the unresolved Meta terms field, production App Review and real non-role login remain separate gates before public authentication. Crawler first-share/edit/withdrawal and ongoing backup/recovery checks also remain launch evidence, not consequences of merging this document.
