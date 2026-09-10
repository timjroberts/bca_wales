# Restricted Images binding rehearsal

Prepared for [Validate hosted blog image processing and its cost](https://github.com/timjroberts/bca_wales/issues/135). The approved hosted rehearsal ran on 10 September 2026. Basic format checks passed, but repeated-run reliability remains unproved after a Worker resource-limit failure. The probe is now disabled and its temporary credential removed.

## Account and provider evidence

On 10 September 2026 the account Transformations dashboard showed 0 of 5,000 unique transformations used, and URL transformations for bca.wales disabled. The latter is a zone URL feature, not evidence that a per-Worker raw-byte binding is unavailable. No feature or paid subscription was activated.

Cloudflare documents 5,000 monthly unique transformations on Images Free, with excess new transformations rejected rather than charged. The raw-byte binding uses that metric and info calls are free. On Paid, additional transformations cost USD 0.50 per 1,000; Images-hosted storage/delivery are separate products. This probe needs neither. [Images pricing](https://developers.cloudflare.com/images/pricing/)

The binding processes raw bytes, accepts explicit PNG output and animation disabling, and can be exercised remotely. Local emulation is not equivalent to hosted execution. [Binding documentation](https://developers.cloudflare.com/images/optimization/binding/)

## Approved rehearsal protocol

The owner approved the following bounded protocol: deploy **bca-wales-blog-images-probe** in the existing account with only an IMAGES binding, workers.dev access, logs/previews disabled and no cron, D1, R2, domain route or application credentials. Install a fresh private 43-character token and a deadline no more than 30 minutes away. The generated configuration defaults to deadline zero, so it is inaccessible until deliberately configured.

The probe accepts only authenticated, bodyless POST requests to three fixed fixture paths. It cannot transform caller-supplied images or URLs. Deadline expiry closes access; unset, malformed or excessive deadlines fail closed. Never log the token or put it in a URL. Bound the operator to 30 sequential requests total, stopping at the first failed result. Repeated fixtures reuse the same maximum of twelve source/parameter combinations; no paid Images upgrade is authorized. If Cloudflare requires payment or a wider permission, stop.

After three initial fixture checks, rotate through the same three paths until 30 sequential requests have been observed. Record aggregate wall time, errors and returned image dimensions, sizes and hashes. Then deploy the deadline-zero configuration and remove the probe credential, verifying unauthenticated and previously authenticated requests both return 404. Retain the disabled Worker until separately authorized cleanup; do not delete staging resources.

## Local preparation and results

Run `node apps/blog/tooling/prepare-images-probe.mjs` from the repository root. It generates disposable files in ignored `apps/blog/dist/images-probe/`; it never deploys or creates credentials. The generated Wrangler configuration points to the bundled Worker in that directory.

Fixtures contain only deterministic pixel patterns and synthetic EXIF attribution:

| Input | Dimensions | Encoded bytes |
| --- | --- | --- |
| JPEG | 6000 × 4000 | 1,640,954 |
| PNG | 320 × 240 | 214,560 |
| WebP | 6000 × 4000 | 595,210 |

Each fixture is decoded and converted to PNG at widths 640, 1280 and 1920 without enlargement, plus a placeholder bounded to 16 × 16. The probe imports production image-type checks and PNG metadata stripping, checks MIME/dimensions and output byte limits, and returns hashes/aggregate measurements instead of image bytes. It has no access to real photographs.

Local execution of the bundled probe with a Sharp adapter passed all three fixtures and four outputs each. It also rejected expired credentials, mismatched credentials, invalid fixture IDs and nonempty request bodies. These local results are preparation evidence only. After the hosted empty-stream fix, all 46 blog tests and focused ESLint passed; the Miniflare suite required local loopback access outside the sandbox.

The maximum probe-specific unique transformations are twelve, well inside the observed free allowance. Worker execution charges/limits are separate, and a full account budget is not established by this small test. Do not claim a monthly GBP operating target is proved here.

## Hosted results and cleanup

The run used only the synthetic fixtures and the IMAGES binding, without activating a paid service. The original deadline remained **2026-09-10 17:55:07 UTC** throughout. There were 13 authenticated attempts, below the 30-request ceiling.

The first attempt returned HTTP 400 before image processing: Cloudflare supplied an empty POST body as a stream, while the probe expected `null`. The harness now accepts a stream that immediately ends and still rejects a nonempty body. A regression test covers this alongside expired and mismatched credentials. The corrected deployment was `bf9b1e04-9977-41e5-81ad-7432088a7cf9`.

Eleven subsequent requests returned HTTP 200 with four outputs each. Dimensions, byte counts and SHA-256 hashes were stable across successful repetitions of each fixture:

| Fixture | Successful requests | Reported elapsed time |
| --- | --- | --- |
| JPEG, 24 MP | 4 | 1,359–2,031 ms |
| PNG, 320 × 240 | 4 | 101–271 ms |
| WebP, 24 MP | 3 | 2,454–2,839 ms |

The next WebP attempt returned HTML instead of JSON, so the runner stopped. Its HTTP status and response headers were not captured. A later read-only metrics query identified the corresponding invocation as `exceededResources`; the record does not distinguish CPU from memory. It does not establish an Images quota failure or a relationship to the cron incident. The requested repeated-run check is incomplete. [Aggregate request evidence](blog-images-probe-results.json) includes the final manually recorded parsing failure and no credentials or image bytes.

Cleanup deployed deadline zero as `ffbe80bd-0b51-43a3-a01d-87a37877af16`, deleted remote `PROBE_TOKEN`, and removed the private local token file. Both unauthenticated access and access with the former token returned HTTP 404. The disabled Worker remains available for a separately approved future rehearsal.

The checked-in `run-images-probe.mjs` now persists status, content type and allowlisted diagnostic headers before parsing JSON. It stops on failure, limits response size and request count, refuses redirects, and records no arbitrary error page or credential. Actual account usage after this run has not been read back. The 44 completed transformations do not establish billed unique usage or the complete operating budget.

## What remains after this first probe

The successful requests demonstrate basic provider format compatibility, 24 MP processing and checked output contracts for these fixtures. They do not establish repeated-request reliability. It does not clear the complete image launch gate. Still required: input near 10 MiB, high-entropy output limits, >24 MP and >8192-pixel rejection, malformed and animated inputs, metadata-rich output inspection with an independent decoder, the complete upload/storage/publication path, 30 distinct images in a post, and hosted CPU/memory evidence. Wall time and absence of an error are not direct memory measurements. Keep upload/publication paused until the full gate is demonstrated.

## Resource diagnosis and follow-up

A read-only GraphQL query for this Worker and the original run window found one `exceededResources` invocation at **2026-09-10 17:27:29 UTC**, matching the interrupted sequence. [Original invocation metrics](blog-images-probe-metrics.json) retain the query, retrieval time and raw CPU quantiles. This is evidence of a Worker resource limit, with CPU versus memory still unresolved. Successful invocations do not prove headroom: Cloudflare documents limited flexibility for occasional CPU overruns. [Worker limits](https://developers.cloudflare.com/workers/platform/limits/)

The probe's large `Uint8Array.from(atob(...), mapper)` fixture decoder creates avoidable iterator work. A local ten-iteration comparison at 1,640,954 bytes measured 62–72 ms for that decoder and 2–5 ms for a preallocated byte loop. The probe now uses the latter. These are local timings, not hosted CPU measurements. Actual blog uploads already arrive as bytes, so this change affects the harness only.

The approved follow-up deployed `3c53dccb-b0d0-4c15-b99c-52d599578b0f` with a fresh token and deadline **18:14:19 UTC**. Its first request returned HTTP 404, and the runner stopped. [Follow-up request diagnostics](blog-images-probe-followup-results.json) preserve the HTTP status, content type and Ray ID. Inspection of that version confirmed both secret binding and intended deadline were present.

Cleanup deployed deadline zero as `d5d6479d-7472-4816-bdeb-652df42fd445` and deleted the remote secret. An immediate former-token check nevertheless returned HTTP 200, showing the enabled version remained reachable during propagation. That check could process the JPEG fixture; its output was discarded and is not counted as validated output evidence. The initial 404 followed by this 200 is evidence of propagation between closed/enabled versions. The follow-up therefore made two authenticated requests to a processing path, not a completed repetition test. [Follow-up metrics](blog-images-probe-followup-metrics.json) are retained but do not isolate a reliable before/after CPU comparison.

Subsequent unauthenticated and former-token checks of `/probe/closed` both returned HTTP 404, and the local token was removed. This invalid fixture path cannot invoke Images: it returns 400 when authentication is active and 404 when closed. Use it for future readiness/closure checks, allowing bounded propagation time before image processing and after disabling. A deployment command succeeding is insufficient proof of edge readiness or shutdown. Reserve control requests within the overall request budget and stop if readiness is not established; do not spend the processing allowance retrying failures.

The Worker remains disabled. No paid features, staging access controls or production settings changed. A future repetition run should use the corrected decoder, saved HTTP diagnostics and non-processing readiness checks. The full launch gate remains open.
