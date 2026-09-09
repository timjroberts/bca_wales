# Landscape explorer

The explorer is a static Next.js export, delivered separately from blog/evidence
storage. `npm run dev --workspace @bca/web` and `npm run build --workspace @bca/web`
stage the installed MapLibre ESM worker and its shared sibling before starting
Next. Generated files live under `public/maplibre/<version>/` and are ignored by
Git. Both files must ship with the export; the versioned URL keeps each page
paired with the matching worker. Do not invoke `next build` directly and bypass
the staging hook.

MapLibre 6 requires WebGL2. Its generated thermal symbol uses
`setMissingStyleImageResolver`, and overscaling retains the version 5 behaviour.
See the [upstream migration guide](https://github.com/maplibre/maplibre-gl-js/blob/v6.4.1/docs/guides/v5-to-v6-migration-guide.md).

After building, `npm run stage:preview-evidence` stages checksum-verified public
evidence into the local output. To run the exported site without deploying:

```sh
npx wrangler pages dev apps/web/out --port 8795 --ip 127.0.0.1 --compatibility-date 2026-08-01
```

In another terminal, from the repository root:

```sh
npx playwright install chromium
npm run check:map-browser -- http://localhost:8795
```

`BCA_BROWSER_EXECUTABLE` may point to an installed Chrome executable. The browser
check verifies the actual export's worker files, vector tile ranges and controls.
A separate browser-intercepted fixture mounts the production `MapCanvas` with a
synthetic thermal observation to exercise symbol resolution and the popup. It
never writes synthetic observations into published evidence or the export.
The existing preview CI also runs this check against its branch preview.

The root Sharp override pins all consumers, including Miniflare's otherwise
older exact dependency, to patched 0.35.4. Reassess the override when upgrading
Miniflare; validate private media processing and browser tests before removing it.
