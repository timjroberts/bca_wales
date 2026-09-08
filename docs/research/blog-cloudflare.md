# Cloudflare blog publication and social previews

Research date: 8 September 2026. Ticket: [Establish Cloudflare publication and social preview options](https://github.com/timjroberts/bca_wales/issues/100). Parent: [Design the BCA Wales blog for implementation review](https://github.com/timjroberts/bca_wales/issues/98).

Research branch: `research/blog-cloudflare`; inspected repository base: `cefb1bd2caf93a55c1f1316ce187c9c4b548a664`. This is a feasibility investigation, not an approved design or implementation. Recommendations below are engineering proposals for the parent's decision discussions. No resources were provisioned or deployed. Facebook identity feasibility and the editor/component contract belong to sibling investigations.

## Result

A public SPA with correct initial per-post HTML is feasible on Cloudflare without an authenticated-user database. The strongest candidate is a separate blog Worker with static application assets, private R2 objects, and D1 for current publication metadata, comments and a small administrator allowlist. Preprocess approved content and image derivatives when publishing; serve a selected immutable revision only after checking current publication state. Preserve client-side navigation after the initial HTML response.

The critical qualification is withdrawal: immutable storage is useful, but publicly cacheable revision URLs cannot promise immediate disappearance. Draft privacy and reversible comment hiding require server-side checks and responses that exclude private text. Facebook preview refresh timing remains unverified because the official Meta pages were inaccessible.

## Existing deployment boundary

Repository evidence at the inspected commit:

- [Deployment foundation](https://github.com/timjroberts/bca_wales/blob/cefb1bd2caf93a55c1f1316ce187c9c4b548a664/docs/runbooks/deployment-foundation.md) defines Pages project `bca-wales-explorer`, production site `explore.bca.wales`, public EU-jurisdiction R2 bucket `bca-wales-public-releases`, and `assets.bca.wales`. Application deployment and evidence publication have separate credentials and approvals. Preview deployments contain pinned public evidence, not private drafts.
- [Next configuration](https://github.com/timjroberts/bca_wales/blob/cefb1bd2caf93a55c1f1316ce187c9c4b548a664/apps/web/next.config.ts) uses static export, trailing slashes and unoptimized images. [Wrangler configuration](https://github.com/timjroberts/bca_wales/blob/cefb1bd2caf93a55c1f1316ce187c9c4b548a664/config/cloudflare/wrangler.toml) describes the Pages adapter only.
- [Pages Worker](https://github.com/timjroberts/bca_wales/blob/cefb1bd2caf93a55c1f1316ce187c9c4b548a664/config/cloudflare/pages-worker.mjs) guards retired routes with `404`, `no-store` and `noindex`; preview machinery also supports bounded PMTiles ranges. The runbook records why deleted Pages assets cannot simply be trusted to disappear immediately. This is repository operational evidence, not a new live test of Pages.

Recommendation: keep explorer deployment and evidence buckets intact; introduce separate blog resources and scoped credentials. Either apex or `www` can be a Worker Custom Domain; Cloudflare manages associated DNS/certificates. Actual zone ownership, conflicting records, existing apex/WWW services and available account plans were not inspected. Domain choice remains the user's decision. See [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

## Feasible combinations

| Combination | Suitability and tradeoff |
| --- | --- |
| Worker + static assets + private R2 + D1 | Recommended candidate. Static JS/CSS deploy with code; R2 holds sources, revisions and media; SQL provides sorted indexes, concurrency checks, comment moderation and allowlist updates. Adds schema migrations and backup responsibilities, but no user-account table is necessary. |
| Pages + Functions/Worker + R2 + D1 | Feasible separate blog project; aligns with existing hosting, but per-post routing and draft protection still need server execution. Do not assume the existing explorer's static export is already a CMS backend. |
| Generated HTML/static deployment + Worker API + structured comments | Feasible for infrequent publication. Every post edit requires build/deployment orchestration. Draft outputs must be excluded, and removed routes need a guard. Dynamic comments and moderation still require a backend; static deployment alone does not satisfy the requirements. |
| Worker + private R2 manifests/JSON only | Feasible with conditional writes and an application-managed index, but concurrent edits, comment paging and multi-object consistency become bespoke storage engineering. Never append comments by uncontrolled read/modify/write of one JSON object. |
| Worker + R2 + SQLite Durable Object | Feasible alternative where a single authority serializes publication or moderation. Strongly consistent transactional storage is scoped to an object; cross-post querying and partitioning are more application work than a small D1 database. |
| Worker + R2 + KV as authority | Poor match for immediate moderation and administrator revocation. KV can be an optional disposable cache when stale reads are acceptable, not the sole current visibility/authorization authority. |

Provider basis: static asset routing can run a Worker first, including selected patterns, and fetch the asset shell through `ASSETS`. Use that for post HTML, APIs, admin, preview and controlled media routes; keep only genuinely public app assets eligible for direct delivery. An unconditional SPA fallback must not turn unknown posts into successful home-page responses. [Static asset bindings](https://developers.cloudflare.com/workers/static-assets/binding/).

R2 binding reads/writes/deletes/listing are strongly consistent, but cached custom-domain responses can retain overwritten or deleted bytes (and cached misses). Direct bindings bypass that cache. R2 is not a multi-object transaction engine. [R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/). Conditional `put` operations allow an ETag-based compare-and-swap design for an R2-only pointer. [R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).

D1 supports prepared statements and transactional batches with rollback on failure. [D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/). Queries without the Sessions API go to the primary; replication requires Sessions and maintains sequential consistency within a session. Recommendation: initially use primary reads for visibility, moderation and allowlist decisions; arbitrary replicated reads do not establish that every reader has observed the latest moderation. [D1 replication](https://developers.cloudflare.com/d1/best-practices/read-replication/).

Durable Object storage is transactional and strongly consistent within its instance. [Durable Object storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/). KV changes, including negative lookups, can take 60 seconds or more to become visible elsewhere; atomic transactions are not its strength. [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/).

## Proposed publication/storage contract

This section is a recommended design, not additional provider guarantees or an imposed editorial workflow.

Store post ID, unique slug, draft/published flag, current published revision, draft revision, title, safe excerpt, publication/update timestamps, author snapshot and share-image reference in D1. Index public listings by visibility/date/ID and comments by post/date/ID. Keep source and render format versions with each revision. A small D1 allowlist can contain only administrator provider identifiers (or validated email identifiers if the sibling research supports them); this is authorization configuration, not a registry of every authenticated reader. A secret/config allowlist is simpler when changes can wait for deployment, but makes revocation operationally slower. Check current membership for each privileged action, not just at login.

Comment records can store permitted author snapshots alongside text, hidden flag and moderation audit information. Public serializers must return only the visible text or the agreed “Comment hidden” placeholder. Never send hidden text in JSON, initial HTML, component props, search indexes, feeds or public revision archives. A hidden original remains private for restoration. Enforce validated identity and post visibility at write time; use mutation idempotency keys and optimistic revisions to prevent duplicated submissions or lost concurrent edits.

Keep R2 private with no public custom domain or `r2.dev` access for sources, originals, draft media, draft HTML/JSON and retained revisions. A random key, robots exclusion or private-looking prefix is not authorization. Use separate buckets if any objects are to be publicly served directly. Cloudflare documents private-by-default buckets and public-domain caching in [R2 cache configuration](https://developers.cloudflare.com/r2/buckets/public-buckets/#caching).

Suggested publication operation:

1. Validate the administrator, expected draft revision, schema and approved component set. Treat content as data; do not evaluate arbitrary submitted MDX imports/JavaScript in the serving Worker. The exact editor/compiler choice is deferred to its research ticket.
2. Preprocess once: generate sanitized body HTML, SPA payload, escaped metadata and bounded responsive/safe image outputs. Produce a manifest of exact content hashes, object keys and renderer version. Originals remain private.
3. Write immutable objects under new revision keys; verify all required objects exist and match the manifest. Do not expose staged URLs through the public handler.
4. Recheck authorization and expected revision. Atomically switch the D1 public pointer and metadata with an appropriate conditional mutation/transaction. All dependent SQL mutations must be conditional on that revision check; a zero-row update is a conflict, not successful publication. A SQL transaction does not encompass R2 uploads.
5. Acknowledge success only after commit. A failed stage leaves the previous publication intact (or the post private). A retry after uncertain acknowledgement checks the idempotency record. Retain old revisions privately for recovery; garbage-collect unreferenced uploads after a grace period.

Keep the user's draft/published flag simple. Technical operation IDs, retry records and renderer revisions do not require exposing an editorial state machine. Editing a published post can stage a replacement without changing current public bytes; whether the user wants that behavior should be confirmed in the parent design.

For indexes, use D1 queries initially so listings and visibility have one authority. A precomputed listing/feed is optional later, but introduces another invalidation surface. Never construct public indexes by listing a mixed private bucket.

## Cache, withdrawal and recovery

Recommended initial policy: no shared response cache for current HTML, post/list/comment APIs, admin or previews. Use `Cache-Control: no-store` (and `private` for authenticated responses). Keep the authorization/publication gateway uncached. Cache immutable body bytes internally only after a fresh current-state check, using a key containing post/revision/renderer version. Include current media ownership/publication checks before serving even a known old revision URL. Reserve long browser `immutable` caching for app assets and media explicitly accepted as permanently public.

This trades Worker/D1 requests for a clearer withdrawal guarantee: requests whose current-state check happens after the mutation commits cannot retrieve the withdrawn material from the origin. Already delivered bytes, in-flight responses, browser history and external copies cannot be recalled. Refresh SPA data on navigation/focus and after mutations; immediate removal from an already open screen would require polling or push, a separate product decision.

Cloudflare's current Workers Caching can satisfy requests without invoking application code. Disable it at the gateway; do not rely on cookies merely being present or omitted cache headers. `private`/`no-store` bypass storage; `no-cache` with stale-while-revalidate can still serve stale content. [Workers cache configuration](https://developers.cloudflare.com/workers/cache/configuration/). `cache.delete()` in the Cache API only purges the invoking data centre, not the world. [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/).

| Change | Required behavior in this proposal |
| --- | --- |
| Publish/edit | Commit new pointer plus metadata; HTML and SPA payload select the same revision. New content hashes avoid overwriting cached bytes. |
| Unpublish | Clear public visibility; public page, content JSON, media revisions, feeds and indexes stop exposing the post. Keep draft/recovery data private. |
| Hide/restore comment | Commit hidden flag and audit record; public projection changes on the next current read. Keep comment text out of immutable public post artifacts. |
| Remove administrator | Current allowlist check denies the next privileged operation even if the session still verifies cryptographically. |
| Public-CDN variant, if chosen | Purge exact changed HTML/index/media URLs and all relevant variants; record/retry failures. Set an explicit maximum stale window. Purge is not a substitute for access control or deletion of external copies. |

On R2/DB failure, fail closed with a temporary error rather than serve potentially withdrawn content. Do not convert an unavailable database into `404`. Keep previous known-good manifests and deployment versions. Rollback a post by switching to a verified retained revision; restore app code separately and maintain renderer/schema compatibility. D1 Time Travel covers seven days on Free and thirty on Paid; exports can extend retention. [D1 recovery](https://developers.cloudflare.com/d1/reference/time-travel/). Database restore can resurrect a hidden comment or withdrawn post: restore behind restricted access, reconcile subsequent moderation/revocation records, then reopen. Retaining private R2 revisions and testing a paired data/code restore are application responsibilities.

## Initial HTML, URLs and social previews

A direct request to a published post should return `200 text/html` with the correct head and preferably preprocessed article body. Serve the same representation to browsers and crawlers; no crawler-specific JavaScript execution is necessary. Hydrate the app or mount it using the selected revision, then use normal SPA navigation. On client navigation update the document title/head, but never rely on that for a share crawler's fresh HTTP request. Cloudflare provides a [SPA shell injection example](https://developers.cloudflare.com/workers/examples/spa-shell/). Google advises server/static rendering or prerendering, notes that not all bots run JavaScript, and documents meaningful HTTP status codes. [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

Emit escaped `og:title`, `og:type=article`, `og:url` and `og:image`, plus safe description, site name and image type/dimensions/alt text. Keep the canonical link and `og:url` identical to the selected HTTPS post URL. Publication/modification metadata is optional. These fields and head placement come from the [Open Graph protocol](https://ogp.me/); OG alone does not guarantee a platform's card rendering.

Recommended route behavior (domain and URL shape still require a human decision):

| Request | Response |
| --- | --- |
| Published canonical post | `200` with per-post initial HTML; `HEAD` has equivalent status/headers without body. |
| Unknown slug or private/unpublished post | `404`, generic body, `no-store`; no draft title, OG metadata or image references. A deliberate permanent retirement could use `410`, but reversible unpublishing should not imply permanence. |
| Other host, HTTP, slash variant, retained old slug | Server `301` or `308` to the canonical location, avoiding redirect chains. Old slug redirects only when the destination is public. Do not redirect removed posts to the homepage. |
| Admin/preview HTML without permission | Generic login response/redirect; private APIs use `401`/`403` or conceal existence with `404`. Never include draft bytes. |
| Storage/renderer failure | `503` with generic retryable response, `no-store`; preserve diagnostics privately. |

Choose one of `bca.wales` and `www.bca.wales`, redirect the other, and keep that identity stable. Avoid query-token previews becoming canonical URLs. Serve a public share image over HTTPS without session cookies, short-lived authorization, JavaScript, referrer checks or interactive bot challenges. A conventional JPEG/PNG and explicit dimensions are conservative compatibility candidates, not a newly verified Meta requirement. Allow the actual crawler through public routes while retaining draft protection; test real scraper access rather than treating a spoofed User-Agent as proof.

**Meta uncertainty:** direct attempts to read [Meta webmasters](https://developers.facebook.com/docs/sharing/webmasters/), [Meta crawler guidance](https://developers.facebook.com/docs/sharing/webmasters/crawler/) and [Sharing Debugger](https://developers.facebook.com/tools/debug/) returned tool fetch errors on this date. No claims here rely on inaccessible text or secondary summaries. Current supported image limits/formats, crawler identifiers, redirect behavior, scrape refresh controls and existing-share update behavior require live validation. No preview-cache TTL or immediate-refresh guarantee is established.

Treat external preview copies as independently retained. On edit, change the share-image version URL and current HTML metadata; do not alter the stable canonical URL just to force refresh. On withdrawal, stop origin access and attempt provider refresh/removal through available tools, but do not promise old shares will disappear. Test a first share, edited title/image, redirect, unpublish and reshare through Meta's real interface before launch. An authenticated draft preview can show a simulated share card locally; a public social crawler must not be given the private draft to test it.

## Uploads and sensitive images

Three feasible processing options:

- **Private R2 + Images binding:** authenticated Worker receives or reads private bytes, transforms at publication, then persists the outputs to R2. The binding supports raw streams without a public source URL; responses are not automatically cached. Current docs cap input at 20 MB. This avoids publishing an original just to resize it. [Images binding](https://developers.cloudflare.com/images/optimization/binding/).
- **Hosted Cloudflare Images:** direct creator upload obtains a one-time upload URL without exposing the account token. Request `requireSignedURLs=true`; the provider's temporary upload `draft` flag is not the blog's editorial draft flag. Custom image IDs cannot use this signed-private feature. [Direct uploads](https://developers.cloudflare.com/images/storage/upload-images/direct-creator-upload/). Signed images can still have variants configured to always allow public access, so review every variant. [Private delivery](https://developers.cloudflare.com/images/optimization/hosted-images/serve-private-images/).
- **Build/processing job + R2:** generate exact derivatives with a pinned image tool in a controlled job and upload results. Gives explicit pixelation and reproducibility but adds runtime, dependency and job operations. Do not assume native image libraries used in a Node build will run unchanged in a Worker; benchmark a chosen implementation before selecting it.

For direct R2 upload, a Worker can issue a short-lived presigned PUT for one new staging key; presigned URLs use the S3 endpoint, not an R2 custom domain. They are bearer capabilities and may be reused until expiry, unlike a one-time Images upload URL. Configure narrow CORS for the editor and validate the uploaded object before referencing it. [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/). Proxying small uploads through the authenticated Worker is another option and centralizes validation, with memory/body-limit tradeoffs.

Recommended validation: administrator authorization and CSRF protection when issuing uploads and committing media; enforce size, decoded dimensions, accepted format and object ownership server-side; re-encode output; inspect animated/multipage inputs; reject unexpected active content. Do not trust filenames or browser MIME checks. Bound parameters rather than offer arbitrary public transformation URLs.

For sensitive images, create a separate irreversible low-detail placeholder image; never send full-resolution bytes initially and merely apply CSS blur. Cloudflare explicitly warns that URL blur parameters can be removed, and its default metadata setting retains copyright metadata; specify an intentional metadata policy and verify outputs, including GPS/EXIF and all animation frames. [Image features](https://developers.cloudflare.com/images/optimization/features/). Pixelation strength and the exact transform chain need visual validation; no blur/pixelation setting proves that a scene is safe or unidentifiable.

Recommend a neutral branded share card for sensitive posts, or a separately reviewed safe image. Do not automatically use the first post image or assume a pixelated sensitive image is suitable for sharing. This recommendation needs the human sensitive-media decision. Store originals privately and serve only approved display derivatives. A public reader's Show action may fetch the display derivative without login, consistent with public reading. That is a deliberate-reveal experience, not confidentiality: readers can copy revealed bytes. A short-lived reveal capability can enforce the interaction boundary but cannot prevent redistribution. Session reveal bookkeeping belongs in the client and should not be mistaken for server authorization.

Authenticated previews must verify the protected session and current administrator allowlist for HTML, JSON and every draft image. Use private/no-store responses and noindex, isolate production credentials/data from public build previews, and exclude drafts from source maps, service-worker caches and logs. Signed image URLs are shareable until expiry; a session-checked media endpoint is the tighter boundary when revocation matters.

## Runtime, scheduling and small-scale cost

Current documented limits: Workers Free allows 100,000 requests/day and 10 ms CPU/request; Paid HTTP CPU defaults to 30 seconds and can be configured up to five minutes. Both have 128 MB per isolate. Paid Cron CPU is 30 seconds for intervals shorter than an hour and fifteen minutes for hourly-or-longer intervals; scheduled wall time is capped at fifteen minutes. `waitUntil` extends work only up to thirty seconds after response/disconnect. These are ceilings, not a promise that a compiler/image operation fits. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

Recommendation: preprocess off the public read path; benchmark publish CPU/memory and offload image work to Images or a bounded job. Do not make successful publication depend on fire-and-forget `waitUntil`. For asynchronous processing, persist an operation record and make retries idempotent; Cloudflare Queues delivers at least once. [Queue delivery](https://developers.cloudflare.com/queues/reference/delivery-guarantees/). Queue retry/dead-letter handling or Workflows can be added if needed; neither is essential to a bounded synchronous first version.

Cron is suitable for cleanup, reconciliation and retry scans. It runs in UTC; changes can take up to fifteen minutes to propagate. [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/). If scheduled publication is later requested, store due times as data and have a fixed scheduler claim due operations; do not create a Cron entry per post or promise second-accurate publication. Scheduled publication is not an agreed requirement.

Published USD list prices retrieved on the research date, not a traffic estimate or account quotation:

| Service | Decision-relevant allowance/rate |
| --- | --- |
| Workers | Static asset requests are free; paid Workers subscription starts at $5/month, with 10 million requests and 30 million CPU-ms included, then $0.30/million requests and $0.02/million CPU-ms. Worker-mediated delivery consumes Worker usage. [Pricing](https://developers.cloudflare.com/workers/platform/pricing/). |
| R2 Standard | 10 GB-month, 1 million Class A and 10 million Class B operations/month free; then $0.015/GB-month, $4.50/million A and $0.36/million B; internet egress free. Infrequent Access has retrieval/minimum-retention charges and no equivalent free tier. [Pricing](https://developers.cloudflare.com/r2/pricing/). |
| D1 | Free: 5 million rows read/day, 100,000 written/day, 5 GB total. Paid includes 25 billion reads/month, 50 million writes/month, 5 GB; then $0.001/million reads, $1/million writes, $0.75/GB-month. Scanned rows and indexes affect usage; Free-limit exhaustion can fail requests. [Pricing](https://developers.cloudflare.com/d1/platform/pricing/). |
| Images | 5,000 unique transformations/month free; paid excess $0.50/1,000. Hosted storage is paid: $5/100,000 stored/month and $1/100,000 delivered. Binding transformations count by unique source/parameters per calendar month. Free exhaustion rejects new transformations; do not use a fallback that reveals originals. [Pricing](https://developers.cloudflare.com/images/pricing/). |

Recommendation: prefer R2 Standard and a small, measured number of publication-time derivatives; index SQL reads and meter operations. Free tiers make low-cost operation plausible, but the compiler may need Paid CPU even with few readers. Hosted Images buys convenience; R2 plus persisted derivatives reduces repeated processing and gives clearer private-original separation. R2-only JSON saves a storage product but increases correctness/maintenance work. Durable Objects are justified by coordination needs, not assumed cheaper than D1. If adding Queues/Workflows/DO, review their separate billing before approval.

The explorer runbook's GBP 10 target/GBP 25 pause ceiling and hoped-for GBP 0 initial service are existing operational constraints, not a blog cost forecast. Account-wide existing usage, actual plan, taxes/exchange rate, image counts/sizes, retention and request/CPU measurements are unknown. Parent should decide whether that budget covers the combined service. Nothing here establishes a provider-enforced hard spend cap.

## Required follow-through, not research blockers

The feasibility question is adequately answered for architecture discussion. Before implementation approval, the parent should obtain human choices on canonical domain, tolerated stale/withdrawal behavior, sensitive share imagery, reveal semantics and budget. Existing decision tickets appear to cover those choices; no new prerequisite ticket is created here.

Recommend a subsequent staging validation ticket (after implementation authorization) covering: real Meta scrape/update/unpublish; current account DNS and plan eligibility; no-JavaScript HTML/status/redirect tests; all preview and media bypass paths including old revision URLs; comment hide/unhide across clients; concurrent publish/unpublish and retry races; runtime/image limits and output safety; and recovery without resurrecting moderated material. Particularly recent Cloudflare cache and Images documentation must be checked against the installed Wrangler/runtime and the actual account. This research used current primary documentation and local configuration, not live provider deployment tests.
