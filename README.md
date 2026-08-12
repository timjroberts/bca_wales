# BCA Wales

This repository contains the production foundation for the public Blorenge
landscape explorer and the decision assets that preceded it.

## Production layout

- `apps/web` — statically exported Next.js public application;
- `packages/domain` — framework-independent explorer state and vocabulary;
- `packages/publication` — release-manifest types and runtime publication model;
- `packages/map-adapter` — renderer boundary for the later MapLibre integration;
- `tooling/geodata` — separately deployable geospatial build boundary;
- `schemas`, `fixtures` and `config` — validated release and environment contracts;
- `data/launch` — reviewed source and candidate-acquisition records.

The application and evidence assets have separate deployment paths. The site is
deployed to Cloudflare Pages; immutable display assets and the promoted release
pointer are delivered from Cloudflare R2. Preview and production use distinct
projects, buckets, hostnames and credentials.

Requires Node.js 22.13 or newer in the Node 22 line.

```bash
npm install
npm run dev
npm run check
```

The [deployment foundation runbook](docs/runbooks/deployment-foundation.md)
records environment, credential, preview, production and rollback boundaries.

## Reviewed prototype

The interaction prototype remains in `prototypes/blorenge-explorer` as a
decision asset. Its map geometry and evidence values are illustrative and are
not imported into the production packages or release fixtures. Its agreed
interaction and content model is recorded in
[Prototype the public Blorenge landscape explorer](https://github.com/timjroberts/bca_wales/issues/33).
