# Blorenge landscape explorer prototype

This is the reviewed interaction prototype for the first public Blorenge
landscape explorer. It is a decision asset: its map geometry and evidence
values are illustrative, not production evidence.

The prototype establishes:

- a map-first experience centred on the July 2026 fire and observed vegetation
  change;
- a shareable `/evidence` route that presents the same state without requiring
  a map;
- expandable layer groups with layer-by-layer visibility and provenance;
- single-date viewing plus an optional two-date overlay with Low, Medium and
  High contrast;
- explicit English/Cymraeg selection with a first-party preference cookie;
- persistent source attribution and detailed per-layer limitations; and
- responsive, keyboard-operable controls with text and pattern alternatives to
  colour-only meaning.

The authoritative decision is recorded in
[Prototype the public Blorenge landscape explorer](https://github.com/timjroberts/bca_wales/issues/33).

## Run locally

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Use `npm test` to build the two routes and run the prototype source checks.

## Deployment

The project uses vinext and the Sites-compatible Cloudflare Worker output. The
Sites project identifier is stored in `.openai/hosting.json`; generated build,
dependency and Wrangler state directories are ignored.
