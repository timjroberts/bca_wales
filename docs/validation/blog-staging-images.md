# Small end-to-end staging image check

On 10 September 2026 the owner chose a small end-to-end check instead of further standalone probe repetitions. The successful run used one temporary post and three synthetic 1200 × 800 images. No association photographs or public launch were involved.

## What passed

The test exercised the existing HTTP session, create-post, image-upload, save, publish, reader-delivery and unpublish routes against hosted Images, staging D1 and private EU R2:

- JPEG (9,771 bytes), PNG (48,193 bytes) and WebP (6,608 bytes) uploaded successfully.
- Each upload stored three display variants and a tiny placeholder. R2 readback hashes matched the manifests. An independent Sharp decoder fully decoded every stored derivative as PNG, with no EXIF, ICC, XMP or synthetic private attribution retained.
- Width 640 outputs were 640 × 426; larger variants stayed at 1200 × 800 without enlargement; placeholders were 16 × 10.
- The saved draft was unavailable through the reader route before publication. Publication made the article and all three display images available through the gated reader requests. Original-image URLs returned 404.
- Withdrawal made the article and all three display URLs return 404 immediately.

[Aggregate run evidence](blog-staging-images-results.json) records timestamps, fixture sizes, dimensions and lifecycle results. These are small-input integration results, not maximum-input performance or memory measurements. The test used a synthetic session and administrator, not Facebook login or the browser editor UI.

## Isolation and cleanup

The normal staging Worker flags stayed restricted, authentication-disabled and publication-paused. A temporary entry point admitted only an expiring private test header on the exact staging origin and selected routes; admitted requests then passed through the unchanged session, CSRF, administrator and application handlers. The two database switches were temporarily cleared for the test and restored afterward. An ordinary unauthenticated visitor still received 503 while the test was active.

The successful test deployment was `2d05764c-83fe-4e04-8ec3-568a436c4327`. Cleanup used the existing erasure/journal flow to remove the synthetic administrator, post content and media, then restored the normal entry point as `1f868851-89f5-4ebf-a55b-f60cc2fb0a94`. The temporary gate secret was removed, and closure was verified using the former credential. Independent cleanup readback confirmed all three media prefixes were empty. No Images subscription or paid feature was activated; the temporary Images binding was removed with normal configuration restoration.

An earlier attempt stopped at readiness because the operator runner tried to cancel an already-consumed response body. It created no post or image, completed cleanup and was retried after fixing that runner error. This was not an image-processing failure.

## Review and reuse

`tooling/staging-image-worker.mjs` is a temporary entry point; normal builds still compile `src/worker.mjs`. Its staging-only, expiry and authentication boundaries have regression coverage. `tooling/run-staging-images.mjs --remote` explicitly performs the deployment and cleanup and must only be used within an approved staging rehearsal. It expects the existing private operator/auth files and built normal/static assets plus `dist/staging-image-worker.mjs`; it never prints credentials.

All 50 blog tests passed, and focused ESLint passed. The standalone probe history remains in [the probe evidence](blog-images-probe.md); repeated probe runs are no longer the next step. This small check establishes the working integration requested by the owner. Other launch requirements remain tracked in [Demonstrate BCA Wales blog staging and provider launch gates](https://github.com/timjroberts/bca_wales/issues/118).
