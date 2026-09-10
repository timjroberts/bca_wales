# Restricted Images binding rehearsal

Prepared for [Validate hosted blog image processing and its cost](https://github.com/timjroberts/bca_wales/issues/135). Hosted execution has not been performed.

## Account and provider evidence

On 10 September 2026 the account Transformations dashboard showed 0 of 5,000 unique transformations used, and URL transformations for bca.wales disabled. The latter is a zone URL feature, not evidence that a per-Worker raw-byte binding is unavailable. No feature or paid subscription was activated.

Cloudflare documents 5,000 monthly unique transformations on Images Free, with excess new transformations rejected rather than charged. The raw-byte binding uses that metric and info calls are free. On Paid, additional transformations cost USD 0.50 per 1,000; Images-hosted storage/delivery are separate products. This probe needs neither. [Images pricing](https://developers.cloudflare.com/images/pricing/)

The binding processes raw bytes, accepts explicit PNG output and animation disabling, and can be exercised remotely. Local emulation is not equivalent to hosted execution. [Binding documentation](https://developers.cloudflare.com/images/optimization/binding/)

## Concrete proposed action

After owner approval, deploy **bca-wales-blog-images-probe** in the existing account with only an IMAGES binding, workers.dev access, logs/previews disabled and no cron, D1, R2, domain route or application credentials. Install a fresh private 43-character token and a deadline no more than 30 minutes away. The generated configuration defaults to deadline zero, so it is inaccessible until deliberately configured.

The probe accepts only authenticated, bodyless POST requests to three fixed fixture paths. It cannot transform caller-supplied images or URLs. Deadline expiry closes access; unset, malformed or excessive deadlines fail closed. Never log the token or put it in a URL. Bound the operator to 30 sequential requests total, stopping at the first failed result. Repeated fixtures reuse the same twelve distinct source/parameter combinations; no paid Images upgrade is authorized. If Cloudflare requires payment or a wider permission, stop.

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

Local execution of the bundled probe with a Sharp adapter passed all three fixtures and four outputs each. It also rejected expired credentials, mismatched credentials, invalid fixture IDs and nonempty request bodies. These local results are preparation evidence only.

The maximum probe-specific unique transformations are twelve, well inside the observed free allowance. Worker execution charges/limits are separate, and a full account budget is not established by this small test. Do not claim a monthly GBP operating target is proved here.

## What remains after this first probe

This probe establishes basic provider format compatibility, 24 MP processing, output contracts and repeated-request reliability if it passes remotely. It does not clear the complete image launch gate. Still required: input near 10 MiB, high-entropy output limits, >24 MP and >8192-pixel rejection, malformed and animated inputs, metadata-rich output inspection with an independent decoder, the complete upload/storage/publication path, 30 distinct images in a post, and hosted CPU/memory evidence. Wall time and absence of an error are not direct memory measurements. Keep upload/publication paused until the full gate is demonstrated.
