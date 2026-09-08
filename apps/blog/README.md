# BCA Wales blog Worker

Independent Cloudflare Worker for the agreed BCA Wales blog. The explorer Pages
application and evidence publishing remain separate.

```sh
npm ci
npm run check:blog
npm run test:browser --workspace @bca/blog
```

See the [deployment/recovery runbook](../../docs/runbooks/blog-deployment-recovery.md)
and [acceptance evidence](../../docs/validation/blog-acceptance.md). Authentication
is disabled in local default configuration; test identities are only installed
by isolated test drivers, never through a deployable login endpoint.

- `src/document.mjs`: bounded source validator and fixed sanitized renderer.
- `src/storage.mjs`: primary D1 guards, private R2 staging/publication and delivery.
- `src/auth.mjs`, `comments.mjs`: Facebook sessions and current-state discussion.
- `src/media.mjs`: private upload and approved derivative pipeline.
- `src/recovery.mjs`, `backup.mjs`: fences, retention and restricted reconciliation.
- `client`: lazy Tiptap authoring, SPA reader and exact per-tab reveal state.
- `tooling`: explicit isolated configuration and operator-only management.

No production resource identifier or secret belongs in this directory. Operator
and deployed environment files are ignored; examples cannot deploy a live site.
