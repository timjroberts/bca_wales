# Visual blog editing with controlled components

Research date: 8 September 2026. Decision input, not an approved design or implementation.
Ticket: [Establish visual editing with controlled MDX components](https://github.com/timjroberts/bca_wales/issues/101).
Parent: [Design the BCA Wales blog for implementation review](https://github.com/timjroberts/bca_wales/issues/98).
Base: `cefb1bd`; research branch: `research/blog-editor`.

## Recommendation for discussion

Prefer a versioned, constrained JSON document as canonical source, rendered through registered application components. Prototype Tiptap first for a deliberately small toolbar and explicit component forms; retain MDXEditor as the alternative if human-readable MDX files are an actual requirement. BlockNote is credible if authors prefer block insertion and drag handles. These are engineering recommendations; the authoring experience, initial component set, and source-format choice remain human decisions.

“Small” here means a bounded authoring surface, not a verified bundle-size claim. No packages were installed, browser experiments performed, or Workers deployment tested. Three candidates are enough to expose the decision boundary; building directly on Lexical would require more editing UI work than the MDXEditor wrapper already supplies.

## Repository fit

The inspected [web package](https://github.com/timjroberts/bca_wales/blob/cefb1bd/apps/web/package.json) uses React 19.2.6 and Next 16.3.0. The [deployment runbook](https://github.com/timjroberts/bca_wales/blob/cefb1bd/docs/runbooks/deployment-foundation.md) separates Pages application delivery from R2 asset publication. The [evidence publication runbook](https://github.com/timjroberts/bca_wales/blob/cefb1bd/docs/runbooks/evidence-publication.md) already uses immutable assets and a current pointer. Reuse that separation conceptually; blog drafts must not enter the public evidence bucket/path merely because it already exists. No existing blog editor integration was established by this targeted inspection.

## Shortlist and actual APIs

| Candidate | Evidence and component mechanism | Fit and cost |
| --- | --- | --- |
| MDXEditor | React Markdown editor using MDAST and Lexical. `jsxPlugin({jsxComponentDescriptors})` registers named JSX elements; descriptors specify `kind`, `props`, `hasChildren`, and `Editor`. `insertJsx$` inserts components; `NestedLexicalEditor` edits supported children. Omit descriptor `source` to avoid generated imports. [Overview](https://mdxeditor.dev/editor/docs/overview), [JSX](https://mdxeditor.dev/editor/docs/jsx), [descriptor API](https://mdxeditor.dev/editor/api/interfaces/JsxComponentDescriptor). | Closest to canonical constrained MDX. Basic formatting can be bounded by plugins/toolbars. Requires application parser validation: expressions are supported by default in the JSX plugin. Custom forms should replace expression-capable generic property editing. |
| Tiptap | `Node.create` defines `name`, `group`, `content`, `atom`, and `addAttributes`; register in `extensions`. `addNodeView` with `ReactNodeViewRenderer` supplies React editing UI; `updateAttributes` persists form changes and `NodeViewContent` exposes editable children. [Node API](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node), [React node views](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/react). | Best candidate for explicit, minimal UI, but toolbar and upload workflow require integration. A sensitive image can be an atomic node with typed attributes. A callout can contain bounded rich text. An editor node view is not automatically the publication renderer. |
| BlockNote | `createReactBlockSpec(config, implementation)` returns a factory; instantiate it and add its spec to `BlockNoteSchema.create`/`extend`. `propSchema` specifies defaults/enums; `content` selects inline/plain/none, `render` supplies React UI, and `editor.updateBlock` updates properties. [Custom blocks](https://www.blocknotejs.org/docs/features/custom-schemas/custom-blocks), [schemas](https://www.blocknotejs.org/docs/features/custom-schemas). | More ready-made block UI, less bespoke toolbar work. Restrict default schema and menus to agreed features. A sensitive-image leaf and inline-content callout fit; arbitrary nested MDX is not its document model. |

For MDXEditor, `imagePlugin({imageUploadHandler})` receives a File and expects a URL; resizing can serialize HTML `img` rather than Markdown image syntax. That is a concrete fidelity/security wrinkle: use the controlled image component for all blog images. [Image documentation](https://mdxeditor.dev/editor/docs/images). Tiptap's Image extension displays images but does not upload them; an application upload endpoint remains necessary. [Image extension](https://tiptap.dev/docs/editor/extensions/nodes/image). For all candidates, a custom image form can collect asset ID, alt text, caption, sensitivity and warning. None of the reviewed APIs establishes the required session reveal policy out of the box.

### Licensing and maintenance snapshot

GitHub release API and upstream license files were checked directly on the research date. Recent releases show current activity, not a support or security guarantee.

| Candidate | License boundary | Latest published release observed |
| --- | --- | --- |
| MDXEditor | [MIT](https://github.com/mdx-editor/editor/blob/main/LICENSE). | [v4.2.3](https://github.com/mdx-editor/editor/releases/tag/v4.2.3), 27 August 2026. |
| Tiptap | Core repository [MIT](https://github.com/ueberdosis/tiptap/blob/main/LICENSE.md); do not assume commercial products/extensions share that license. This recommendation needs core/local functionality only. | [v3.31.3](https://github.com/ueberdosis/tiptap/releases/tag/v3.31.3), 4 September 2026. |
| BlockNote | [License file](https://github.com/TypeCellOS/BlockNote/blob/main/LICENSE.txt): MPL-2.0 except XL packages, which are GPL-3.0 with a commercial alternative. Review exact selected package licenses before adoption; this proposal needs no XL export/AI features. | [v0.54.0](https://github.com/TypeCellOS/BlockNote/releases/tag/v0.54.0), 13 August 2026. |

MDXEditor's current [package manifest](https://github.com/mdx-editor/editor/blob/main/package.json) declares React 18/19-compatible peers. React APIs exist for the other two, but exact pinned package/React 19/Next client-boundary compatibility remains a prototype check. Online documentation may move ahead of the selected release: pin and verify APIs before coding. No reliable comparative compressed bundle measurement was established.

## Canonical source and round-trip contract

**Recommended contract:** a versioned envelope containing an allowlisted editor JSON tree, revision, and component versions. Avoid designing a second general-purpose rich-text language: start with the selected editor's bounded tree, validate it independently, and isolate conversion in an adapter. Persist only durable fields; selection, upload progress, temporary URLs, and reveal state are not document data.

Tiptap supports `getJSON()` and restoring JSON with `content`/`setContent`, plus static HTML/React/Markdown output. Its documentation explicitly requires server input validation. [Persistence and rendering](https://tiptap.dev/docs/guides/output-json-html). BlockNote recommends storing `editor.document` as JSON; `blocksToMarkdownLossy` deliberately drops unsupported information. Markdown export must therefore not become the save/reopen path. [Markdown export](https://www.blocknotejs.org/docs/features/export/markdown).

**Constrained MDX alternative:** accept only a published grammar: paragraphs, a small heading range, bold/italic, lists, quotes, safe links, and exact registered component names with literal string properties and constrained children. For example, an image component may carry `assetId="…"` and `sensitivity="sensitive"`; no expression syntax is needed. Parse to AST, validate the entire tree, then convert to component data. An MDX extension alone is not this validator.

MDXEditor's documentation demonstrates both JavaScript expression properties and expression editing, so descriptor registration is not a sandbox. It also documents text/flow kind normalization or errors. Consequently, promise semantic preservation only for the supported grammar, not byte identity, formatting whitespace, arbitrary imports, expressions or arbitrary JSX. [JSX behavior](https://mdxeditor.dev/editor/docs/jsx). Unsupported syntax can raise conversion errors; preserve the original source/revision and show a recoverable error rather than saving a partial document. [Error handling](https://mdxeditor.dev/editor/docs/error-handling).

For either route, the acceptance invariant is save → reopen → save preserves normalized supported content, order, asset references, component properties and children. Test export → import only if importing the generated MDX is actually required. If offered, use a dedicated inverse converter and corpus tests; ordinary Markdown conversion cannot promise custom-component fidelity. Prefer a one-way deterministic MDX export for portability, keeping JSON authoritative.

## Validation, rendering and evolution

The following is a proposed application boundary, not a vendor guarantee:

- Validate independently on save, preview and publish: envelope/node versions, allowlisted node/mark names, exact properties, types/enums, string sizes, URL rules, tree depth/count, image references and nesting. Reject unknown versions/types with a useful error; do not silently delete them. UI TypeScript types do not validate hostile HTTP input.
- For MDX input reject ESM/import/export nodes, expression nodes, spread attributes, expression-valued properties, raw HTML, unregistered elements and event/style properties. Use an AST allowlist, not regular-expression stripping. Treat braces in prose as escaped text when exporting.
- Resolve component names through a fixed application registry with explicit property assignment. Never dynamically import a user-supplied module or pass arbitrary stored props into DOM elements. JSON removes executable syntax, but unsafe component implementations can still introduce XSS.
- Keep schemaVersion, per-component version and renderer compatibility version. Migrations operate on a copy, retain the prior revision, validate the result, and record the change. Preserve old renderers until affected published revisions are migrated/reprocessed. Unknown content should block editing/publication, not disappear on reopen.

MDX compiles to JavaScript; `evaluate` and `run` execute JavaScript, per the compiler's own warnings. Moving arbitrary MDX evaluation to a build job does not make it safe. [MDX compiler](https://mdxjs.com/packages/mdx/). Prefer rendering validated component data, or compile only generated/validated restricted source with trusted build plugins.

For links, normalize/parse URLs, allow only agreed protocols (initially HTTPS/HTTP and validated local paths), and reject script/data URLs and control-character evasions. New-tab links should use `rel="noopener noreferrer"`; reader comments can additionally use `ugc nofollow`. Render comments as escaped plain text initially, with safe linkification if wanted, through a separate schema with no image/custom-component capability. Never allow the post editor's expressive format to become the comment API accidentally. These recommendations apply OWASP's context-sensitive encoding and URL validation guidance. [OWASP XSS prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html).

If an HTML conversion path exists, sanitize the resulting HTML AST with a narrow schema; subsequent transforms must not reintroduce unsafe output. `rehype-sanitize` addresses HTML trees, not executable MDX expressions. [Sanitizer documentation](https://github.com/rehypejs/rehype-sanitize). Administrative comment hiding must omit the original text from public HTML/JSON, as required by the map; CSS hiding is insufficient.

## Preview, images and Cloudflare preprocessing

Proposed pipeline: authenticated save → validated private source revision → same preprocessing used by preview → explicit publish → immutable public render data/HTML and asset manifest → update published pointer. Keep the simple draft/published flag; processing failures leave the last published revision intact without introducing an editorial workflow. Use revision conflict detection because all administrators may edit any post.

Workers' documented standard runtime excludes `eval` and `new Function`. Do not plan on fetching compiled MDX function bodies from R2 and calling `run` in a request handler. [Workers runtime](https://developers.cloudflare.com/workers/runtime-apis/web-standards/). Two compatible directions are:

1. Publication-time: Workers validate bounded JSON and produce render data/HTML using prebundled trusted functions; R2 stores objects. The SPA renders those data through its bundled registry. Actual renderer dependencies and CPU/memory use need live testing.
2. Build-time: a trusted Node build validates source, compiles restricted/generated MDX and bundles components; a publish then needs a build/deployment before its code becomes available. This fits the repository's separation but introduces latency and deployment coupling. R2 object storage does not make JavaScript part of a deployed Worker automatically.

R2 provides `head`, `get`, `put` and conditional writes via `onlyIf`; use these to verify referenced objects and reject stale revision-pointer updates. [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/). This is not a multi-object transaction: upload/verify all immutable outputs before changing a pointer, retain old assets, and coordinate deletion so a validated asset cannot vanish before publication.

Use stable opaque asset IDs backed by an immutable/versioned manifest, not pasted external URLs or expiring signed URLs as canonical content. Record MIME, dimensions, checksum, upload completion and ownership/publication eligibility. Validate upload bytes, size and dimensions server-side, preferably decode/re-encode approved raster formats; do not accept arbitrary SVG/HTML as an image. Reject publish if required originals or pixelated derivatives are missing. Retain assets referenced by drafts, published revisions and rollback history; orphan cleanup needs a grace period and a second reference check.

Draft preview must run the same normalizer, registry, CSS, media resolution and renderer version as public rendering, behind authenticated access with private/no-store responses. The editor's node UI is not sufficient proof of preview parity. Test public hydration and direct navigation separately from in-SPA navigation.

Sensitivity belongs in the durable image/component model; revealed IDs belong in session state. Use an exact set keyed by immutable asset identity/version, not a Bloom filter whose false positives could reveal unseen images. For the proposed pixelated-first behavior, serve an actual derivative initially; a CSS blur of the original does not prevent its download. Reveal access and session scope require the human discussion. Exclude sensitive originals from default social thumbnails; do not assume any editor controls Open Graph output. Meta crawler fetching/cache behavior was not verified here, and no claims depend on inaccessible Meta documentation. The identity and hosting investigations should establish those provider facts.

## Bounded later prototype and remaining decisions

Recommend one throwaway Tiptap prototype after the authoring discussion, with paragraphs, headings, bold/italic, lists, links, an Image/SensitiveImage form and one callout component. Use mock private/public assets and the same preview renderer. No collaboration, arbitrary MDX source mode, deployment, authentication integration or new CMS.

Acceptance checks: create/edit/reorder/delete components; keyboard and mobile editing; upload cancellation/failure; alt text and sensitivity persistence; undo/redo; JSON reload semantic equality; malformed/unknown component rejection; malicious links and MDX rejection; version migration; missing assets; concurrent-save conflict; pixelated-first/reveal session behavior; matching draft/published output. Measure author-only compressed bundle cost, load time and representative long-post responsiveness on the repository's React version. If canonical MDX remains important, run the same small fidelity corpus through MDXEditor as a second, explicitly bounded comparison.

Research is adequately answered for decision input; no implementation blocker was found. Still requiring live validation: pinned editor compatibility/API parity, Workers renderer package/runtime feasibility and resource use, R2 draft access/cache configuration, and social-crawler behavior from the separate hosting investigation. Parent should carry prototype acceptance criteria into [Agree the visual authoring and component editing experience](https://github.com/timjroberts/bca_wales/issues/103), and media/preview constraints into the existing sensitive-media and architecture discussions. No new prerequisite ticket is necessary now; recommend a focused runtime-validation prerequisite only if the architecture discussion selects publication-time rendering.
