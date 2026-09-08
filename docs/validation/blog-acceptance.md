# Blog implementation acceptance evidence

Implementation date: 8 September 2026. Source contract: [Review the implementation-ready BCA Wales blog design](https://github.com/timjroberts/bca_wales/issues/107) and its five detailed decisions. Implementation tracking: [Implement the reviewed BCA Wales blog](https://github.com/timjroberts/bca_wales/issues/111). Review: [Implement the independent BCA Wales blog](https://github.com/timjroberts/bca_wales/pull/117).

This records reproducible implementation evidence, not production approval. Live provider and operational actions are tracked in [Demonstrate BCA Wales blog staging and provider launch gates](https://github.com/timjroberts/bca_wales/issues/118). No blog deployment/provisioning, DNS mutation, paid activation or merge was performed.

Final local results: **29 blog backend tests and two browser scenarios pass**. The full repository check also passed (50 existing tests, one existing opt-in container test skipped, static explorer build and typechecks). Production dependency audit reports zero vulnerabilities.

## Automated coverage

Run `npm run check:blog` and `npm run test:browser --workspace @bca/blog` after installing the pinned browser. The latter uses local synthetic data and real Chrome/Chromium over HTTPS. All files below are in `apps/blog/test`.

| Contract / failure | Executable evidence | Meaning and limits |
| --- | --- | --- |
| Versioned inert source, permitted formatting/components, bounded schema, safe URLs | `document.test.mjs` | Unknown versions/properties/marks/nesting and unsafe URLs fail without mutating input. Fixed HAST renderer escapes/sanitizes output. Sensitive source details/clear URLs are absent from initial HTML. |
| Explicit private saves and publication, metadata isolation | `storage.test.mjs` | Draft save/reopen, preserved public title after correction, exact retry, changed-input idempotency rejection and stale save. Runs with local D1/R2. |
| Authority at commit, concurrent save and withdrawal | `storage.test.mjs` | Exactly one concurrent save wins. Withdrawal and allowlist removal inserted during R2 staging prevent publication. Corrupted render objects fail closed. Deleted posts cannot republish/reuse slugs. |
| Direct SSR, SPA data, HEAD, aliases, no-store, restricted mode | `delivery.test.mjs` | Uses the actual bundled Worker. Article HTML/API share body and safe metadata; private/withdrawn/unknown routes do not return an ordinary SPA shell or OG article metadata. |
| Media current-state membership and ownership | `delivery.test.mjs` | Draft, old-revision, unknown and original variant URLs fail; private delivery requires current administrator authority, including HEAD/withdrawal behavior. |
| Encrypted claims, OAuth and lifecycle boundaries | `auth.test.mjs`, `http-auth.test.mjs` | Wrong key/app/audience, tampering, replay, missing browser binding, wrong provider app, CSRF and copied-cookie logout revocation fail. Signed callbacks reject alteration/staleness. HTTP role enforcement uses the bundled Worker. Provider responses are synthetic; real Meta approval/behavior is not demonstrated. |
| Immediate comments, ownership, private hiding and delete-wins | `comments.test.mjs` | Immediate visible submit, same-key single result, exact hidden projection, private audited inspection, ownership rejection, restoration and irreversible deletion. No duplicate body is stored in idempotency receipts. |
| Abuse bounds and withdrawal | `comments.test.mjs` | Concurrent submissions admit five in ten minutes, reject excess with 429, and permanent deletion does not reset the independent allowance. Window expiry, post withdrawal and current admin removal are exercised. |
| Erasure completion and storage outage | `comments.test.mjs`, `backup.test.mjs` | Visibility is fenced before recovery failure; retry recovers the same job; live objects/attribution are cleaned and status does not complete without backup-policy confirmation. A new later request differs from callback replay. |
| Paired backup, independent journal, no resurrection | `backup.test.mjs` | Older snapshot is restored with later hide/delete/withdrawal replay. Deleted originals stay deleted, historical admins are removed, sequence is preserved and restore remains restricted. Missing journal/completeness evidence blocks restore. Uses local R2/D1, not an account recovery exercise. |
| Image validation, re-encoding and metadata removal | `media.test.mjs` | Real test raster decoding proves tiny PNG output and EXIF/text/ICC removal. Missing binding, failed processing, SVG and MIME mismatch do not create completed media. sharp is a test adapter; live Images binding remains a gate. |
| Real constrained editor and navigation | `browser.spec.mjs` | Tiptap normalized list/callout/rich-text save→reopen→save equality; private saved corrections; stale conflict keeps local text; mobile component dialog; reader SPA navigation. Desktop/mobile screenshots were inspected. |
| Operator resource isolation | `operator.test.mjs` | Rejects evidence/shared buckets and preserves parameterized D1 request values. Remote S3/D1 calls still require staging validation. |
| Deliberate session reveal and accessible controls | `browser.spec.mjs` | No clear request or detailed alt before reveal; keyboard Enter, retained button focus, successful reveal, refresh persistence, independent new tab, reset, failed request without recording reveal, and changed-warning reset. Real browser network requests are observed. |

## Runtime/package evidence

- Node 22.18.0 was used locally; repository `.nvmrc` selects the supported Node 22 line. The initial shell default Node 23 was not used for validation.
- Tiptap core/starter kit/link and resolved extensions are 3.31.3; no React integration is required by the standalone editor. Packages are MIT. `jose` 6.2.12 supplies authenticated encryption. Worker rendering uses the pinned HAST sanitizer and serializer, not runtime MDX compilation.
- Wrangler 4.121.0's installed Miniflare 5 alpha requires its v4 conversion helper and explicit assets-router user-worker flag. The local browser exercise verifies the resulting Worker/static-assets path. This is not evidence of live routing or account quotas.
- [Local rendering/bundle measurements](blog-local-measurements.json) record a 4,999-node, roughly 860 KB synthetic document and 20 local render runs. These are Node timings, not hosted CPU or billing evidence.
- The reader entry is small and the editor loads as a separate hashed chunk. Build artifacts are private-data-free and have no source maps. Measure final byte/gzip sizes using the build output; no host performance or CPU quota claim follows from bundle size alone.
- Image binding contracts were checked against [Cloudflare Images binding](https://developers.cloudflare.com/images/optimization/binding/) and [workerd image types](https://github.com/cloudflare/workerd/blob/main/types/defines/images.d.ts). No metadata stripping option is documented there; the implementation strips PNG ancillary chunks after re-encoding. [D1 batch documentation](https://developers.cloudflare.com/d1/worker-api/d1-database/) supports the transactional SQL design; [R2's S3 example](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/) supports the operator client choice. These citations establish documented APIs, not account execution.

## Provider/account evidence and unperformed checks

Read-only checks found working Cloudflare authentication, no listed D1 databases, an empty default-jurisdiction R2 listing and the existing EU `bca-wales-public-releases` bucket. No supplied Meta app configuration or blog credentials were found in repository secret names. Other account settings may exist; their absence is not asserted. Meta documentation retrieval returned HTTP 429 during implementation; the design's source-backed investigation and synthetic contract checks do not replace an actual app test.

Apex HTTPS returned a script redirect to `/lander`; www returned HTTP 525. Neither was changed. Full launch therefore still requires actual service/DNS reconciliation and approval, real non-role Facebook access/callbacks, optional-field/PKCE investigation, hosted private Images metadata/animation/limit tests, Facebook crawler/cache behavior, actual account quotas and combined cost sizing, configured privacy contact, scoped remote operator-adapter testing, alerts and a restricted staging restore rehearsal.

The code deliberately keeps these as launch gates. Authentication and Images do not silently fall back to another provider or archival originals. Generated deployed configuration defaults to restricted mode and paused publishing. Local acceptance cannot certify missing provider credentials, account approvals or live service behavior.
