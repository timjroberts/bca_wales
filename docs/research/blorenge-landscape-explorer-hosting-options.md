# Production-foundation delivery and UK hosting options for the Blorenge landscape explorer

**Research date:** 8 August 2026  
**Scope:** Decision evidence for the first public, read-only Blorenge landscape explorer and its path into the larger BCA platform  
**Status:** Comparison, not an architecture selection

Prices below are suppliers' public list prices in US dollars unless stated otherwise. They exclude VAT, domain registration, support, build minutes, backups not explicitly included, and operator time. Free tiers and list prices change; re-price a measured workload before committing.

## Question and inherited boundary

Which low-cost web mapping, geospatial delivery, application hosting, storage, deployment and observability options can support the initial UK-hosted explorer without creating an early dead end for a larger TypeScript/Node.js platform?

This comparison assumes the launch constraints already established by the programme:

- the first service is public and read-only, with no authentication, submissions or controlled data;
- only openly licensed, safe-to-republish layers from the [data-source inventory](./blorenge-data-sources.md) are in scope;
- BCA wants UK hosting as a policy choice, while the [compliance research](./platform-compliance.md) correctly distinguishes supplier geography from the full UK GDPR transfer analysis;
- English content can launch first, while the interface is structured for progressive Welsh translation;
- WCAG 2.2 AA and a useful non-map path are release requirements, not later enhancements; and
- TypeScript/Node.js, open standards and portability are preferred.

The actual launch-layer shortlist, areas of interest, raster resolutions, refresh frequencies and traffic are not yet fixed. That prevents a reliable final bill and makes architecture selection premature.

## Evidence summary

1. **Browser delivery and canonical hosting are separable decisions.** A TypeScript application can deliver immutable vector and raster archives directly from object storage while retaining a conventional Node.js API and PostgreSQL/PostGIS boundary for later dynamic features.
2. **Static geospatial archives are a credible production technique, not merely a prototype shortcut.** PMTiles packages vector, raster or terrain tiles into one range-readable object; Cloud Optimized GeoTIFF (COG) does the same kind of partial reading for analysis-ready raster. Both avoid an always-on tile server for immutable public layers.
3. **The cheapest launch can still preserve a dynamic path.** Small feature sets can start as GeoJSON, larger styled layers as PMTiles, and source raster as COG or pre-rendered tiles. Frequently edited or queryable features can later move behind PostGIS and Martin; dynamic raster rendering can be added with TiTiler when its flexibility justifies a Python/GDAL service.
4. **No single low-cost supplier dominates every requirement.** DigitalOcean offers a simple London PaaS and managed PostGIS path; Vercel plus a London PostgreSQL provider is productive but multi-supplier; Azure and AWS have strong UK regional breadth but more metering and configuration; Cloudflare is unusually cheap for public delivery but does not offer a strict UK-only R2/Workers foundation; a small VM is inexpensive in cash but expensive in operational responsibility.
5. **Accessibility sits above the renderer.** A map canvas plus keyboard pan/zoom is not an accessible account of the data. Important layers, selected features and status must also be available as semantic controls and text/table views, with meaning independent of colour.
6. **The durable seam is more important than the launch host.** Standard PostgreSQL/PostGIS, portable Node or container deployment, versioned build outputs, source-level provenance and OpenTelemetry make later migration materially easier.

## Browser map runtime

| Option | Relevant official evidence | Fit and pressure |
|---|---|---|
| **MapLibre GL JS** | An open-source TypeScript/WebGL library that renders vector tiles in the browser; it also exposes [GeoJSON](https://maplibre.org/maplibre-gl-js/docs/API/classes/GeoJSONSource/), [vector-tile](https://maplibre.org/maplibre-gl-js/docs/API/classes/VectorTileSource/) and [raster-tile](https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/) sources. Its [keyboard handler](https://maplibre.org/maplibre-gl-js/docs/API/classes/KeyboardHandler/) supports keyboard map movement. | Strong fit for interactive vector styling, PMTiles and mixed raster/vector thematic views. WebGL and a style document introduce more rendering complexity than a basic slippy map. Keyboard movement helps operability but does not expose map features to assistive technology. |
| **Leaflet** | The [reference](https://leafletjs.com/reference) supports raster tile layers, WMS and GeoJSON in a small, established browser library. | Good for a raster-first map with modest interactive vectors. PMTiles raster works, but the official PMTiles guidance says the Leaflet vector plugin is in maintenance mode and recommends MapLibre for fully interactive vector overlays ([PMTiles for Leaflet](https://docs.protomaps.com/pmtiles/leaflet)). That creates earlier migration pressure if vector theming becomes central. |

The current evidence favours **shortlisting MapLibre GL JS**, because it covers the broader landscape explorer and its likely vector-thematic growth. This is not a complete frontend decision: prototype testing still needs to cover performance on representative phones, bilingual controls, keyboard flows, reduced-motion treatment and the non-map view.

## A geospatial delivery ladder

The initial platform does not need to choose between “all static” and “all dynamic.” It can use the least operationally expensive delivery form for each layer while keeping stable metadata and URL boundaries.

| Delivery form | Best fit | Temporal/update behaviour | Operating characteristics | Likely migration pressure |
|---|---|---|---|---|
| **GeoJSON** | Small, filtered feature sets; selected-feature detail; accessible list/map synchronisation | Replace a versioned file or return a filtered API response | MapLibre creates browser-side tiles and clusters through workers ([GeoJSON source](https://maplibre.org/maplibre-gl-js/docs/API/classes/GeoJSONSource/)); simple to inspect and cache, but whole-document transfer and client processing become costly as data grows | Move larger display layers to vector tiles; retain GeoJSON for detail and small queries |
| **PMTiles vector archive** | Large, immutable or periodically rebuilt public vector layers | Build one archive per release or time slice and atomically update a manifest | A single object is read with HTTP range requests and can be served from S3-compatible storage without a tile server ([PMTiles concepts](https://docs.protomaps.com/pmtiles/), [MapLibre integration](https://docs.protomaps.com/pmtiles/maplibre)). It is read-only: updates normally rebuild the archive | Poor fit for frequent transactions or fine-grained live edits; PMTiles explicitly points transactional workloads toward PostgreSQL and `ST_AsMVT` |
| **Pre-rendered raster tiles or raster PMTiles** | Fixed cartography, historical imagery and simple thematic overlays | Re-render changed styles/time slices | Fast and operationally simple, but style, scale and band choices are baked in. Raster PMTiles avoids millions of separately managed objects | Rebuild for new visual treatment; add dynamic raster service when users need band maths, rescaling or arbitrary combinations |
| **COG in object storage** | Analysis-ready source raster, LiDAR-derived products and imagery with internal overviews | Publish immutable, checksummed versions; point metadata to the current object | The OGC standard arranges a GeoTIFF so clients can retrieve only required tiles/overviews with HTTP range requests ([OGC COG](https://www.ogc.org/standards/ogc-cloud-optimized-geotiff/)). Browser support normally needs a client library or tile gateway | Low format lock-in; may need TiTiler or a pre-rendering pipeline for browser-friendly presentation |
| **PostGIS plus Martin** | Frequently changing features, spatial filters, permissions and dynamic vector tiles | Transactional updates and queries | Martin can publish PostGIS, PMTiles and MBTiles sources, allowing static and dynamic sources behind one tile interface ([project](https://github.com/maplibre/martin), [source comparison](https://maplibre.org/martin/sources-tiles/)). Docker deployment is documented and PostGIS 3+ is supported ([installation](https://maplibre.org/martin/installation/)) | Adds an always-on Rust service, database capacity, cache policy, query tuning and abuse controls; justified when dynamic requirements appear |
| **COG/STAC plus TiTiler** | Dynamic raster rescaling, reprojection, band maths, mosaics and point/statistical queries | New objects and catalogue items can appear without pre-rendering every view | TiTiler exposes COG, STAC, mosaic and tile endpoints using FastAPI, Rasterio and GDAL ([project](https://developmentseed.org/titiler/), [COG endpoints](https://developmentseed.org/titiler/endpoints/cog/)). Its own comparison describes static tiles as faster/simpler and dynamic tiling as more flexible but more complex and latent ([dynamic tiling](https://developmentseed.org/titiler/user_guide/dynamic_tiling/)) | Introduces a Python/GDAL operational sidecar beside the Node platform; use when the raster interaction earns that cost |

PMTiles object storage must support byte ranges and correct CORS. Each range read is an object request, so archive layout, browser/CDN caching and request-priced storage matter ([cloud-storage guidance](https://docs.protomaps.com/pmtiles/cloud-storage)). Map styles also depend on fonts and sprites; these should be versioned, self-hosted and covered by a restrictive content-security policy rather than treated as invisible third-party dependencies ([PMTiles security guidance](https://docs.protomaps.com/guide/security-privacy)).

### Temporal layers

A simple, portable temporal contract is more durable than coupling the interface to one supplier:

- publish an application-readable manifest containing stable layer ID, title, source, licence/attribution, spatial extent, observation/start/end times, processing version, URL, checksum and publication status;
- keep immutable time-slice URLs and change the manifest pointer atomically;
- use time filtering in the semantic list/table as well as on the map;
- rebuild archives for occasional survey or annual releases; and
- introduce database queries or a STAC catalogue only when layer count, update frequency or user filtering makes manifest-driven archives unwieldy.

This also implements the provenance and publication-control direction established in the data-source and compliance research.

## A portable launch-to-platform seam

The following boundaries work across the credible hosts in this comparison:

```text
Browser
  semantic HTML controls, list/table/detail views
  MapLibre view of the same selected/filter state
       |                         |
       | static app/assets       | optional JSON/API requests
       v                         v
CDN / static hosting         TypeScript/Node service
       |                         |
       | range reads             | SQL / spatial queries
       v                         v
Versioned PMTiles/COGs       PostgreSQL + PostGIS
                                 |
                           Martin when dynamic MVT is needed

Build/ingestion jobs -> validated public derivatives + manifest
Observability       -> OpenTelemetry/OTLP + supplier backend
```

Next.js is one possible TypeScript shell rather than a hosting commitment: its official deployment documentation supports a Node server, Docker container, static export and platform adapters ([deployment](https://nextjs.org/docs/app/getting-started/deploying)). A site can begin as a static export, although server-dependent features are unavailable until it moves to a server deployment ([static export](https://nextjs.org/docs/app/guides/static-exports)). Its self-hosting guidance makes clear that multi-instance caches and reverse-proxy protection require deliberate configuration ([self-hosting](https://nextjs.org/docs/app/guides/self-hosting)). A smaller framework can implement the same seam; the important decision is to avoid supplier-only APIs in domain and data-access code.

## Hosting architecture candidates

### Comparison at a glance

| Candidate | UK placement and residency evidence | Indicative entry point | Strength as a larger-platform foundation | Main pressure |
|---|---|---|---|---|
| **DigitalOcean London PaaS**: App Platform + managed PostgreSQL/PostGIS; portable object store/CDN | App Platform offers London and maps it to the `lon1` VPC; managed PostgreSQL is available in `LON1` ([regional availability](https://docs.digitalocean.com/platform/regional-availability/), [App Platform VPC mapping](https://docs.digitalocean.com/products/app-platform/how-to/enable-vpc/)) | Static apps include a small free allowance; a 512 MiB dynamic component is $5/month ([App Platform pricing](https://docs.digitalocean.com/products/app-platform/details/pricing/)). Single-node managed PostgreSQL starts at $15.15/month, but is positioned for development/testing; documented HA begins with a $30 primary plus at least one $30 standby ([database pricing](https://www.digitalocean.com/pricing/managed-databases), [PostgreSQL pricing detail](https://docs.digitalocean.com/products/databases/postgresql/details/pricing/)) | Low cognitive overhead; normal Node/container service; standard PostgreSQL with [PostGIS support](https://docs.digitalocean.com/products/databases/postgresql/details/supported-extensions/); app specification supports declarative deployment | Large jump from cheap single-node database to production HA; App Platform filesystem is ephemeral and capped, so geospatial assets require object storage ([limits](https://docs.digitalocean.com/products/app-platform/details/limits/)); confirm exact object-storage region and contract before treating assets as UK-resident |
| **Vercel + London PostgreSQL**: Vercel Pro + Neon or Supabase + object storage | Vercel has a London function region (`lhr1`, AWS `eu-west-2`) but defaults functions to Washington, DC unless configured ([regions](https://vercel.com/docs/regions)). Neon documents its London region and UK data location ([Neon London](https://neon.com/docs/changelog/2025-02-14)); Supabase lists London `eu-west-2` ([regions](https://supabase.com/docs/guides/platform/regions)) | Vercel Pro is $20/month with $20 usage credit; Hobby is limited to personal, non-commercial use and is not an appropriate BCA production baseline ([pricing](https://vercel.com/pricing), [Hobby policy](https://vercel.com/docs/plans/hobby)). Neon gives a small free allowance and describes an intermittent 1 GB Launch workload around $15/month ([pricing](https://neon.com/pricing)). Supabase Pro is $25/month and bundles database, storage, egress and seven-day backups ([pricing](https://supabase.com/pricing)) | Very productive web deployment; standard Postgres/PostGIS is available from [Neon](https://neon.com/pricing) and [Supabase](https://supabase.com/docs/guides/database/extensions/postgis); database remains portable | Multi-supplier incident, billing, region and deletion model; explicitly configure London compute near London data; platform function semantics and usage billing can encourage lock-in; long or compute-heavy geospatial jobs belong in a separate worker/container |
| **Azure UK South**: Static Web Apps or Container Apps + PostgreSQL Flexible Server + Blob + Azure Monitor | Regional resources can be selected in UK South; residency and replication still need service-specific review, especially backup/geo-redundancy ([Azure data residency](https://learn.microsoft.com/en-us/azure/security/fundamentals/data-residency), [region list](https://learn.microsoft.com/en-us/azure/reliability/regions-list)) | Static Web Apps Free is for hobby/personal projects with no SLA; Standard is the production tier ([pricing](https://azure.microsoft.com/en-gb/pricing/details/app-service/static/)). Container Apps consumption includes monthly grants of 180,000 vCPU-seconds, 360,000 GiB-seconds and 2 million HTTP requests ([billing](https://learn.microsoft.com/en-us/azure/container-apps/billing)). PostgreSQL price is configuration-dependent and must be calculated ([pricing](https://azure.microsoft.com/en-gb/pricing/details/postgresql/flexible-server/)) | Broad UK-region service family; conventional containers and managed PostgreSQL with [PostGIS support](https://learn.microsoft.com/en-us/azure/postgresql/extensions/concepts-extensions-versions); credible route to queues, private networking, identity and controlled workloads | More resource configuration and metered components than the simpler PaaS options; a permanently provisioned database creates the main low-traffic floor; free grants are not an SLA-backed operating budget |
| **AWS London**: S3/CloudFront + Lambda or container + RDS PostgreSQL + CloudWatch | London is `eu-west-2` with three Availability Zones ([AWS Regions](https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html)). AWS states customers select their region and customer content is not transferred outside it except as necessary to provide services or comply with law; global services and CDN processing still require service-specific assessment ([GDPR summary](https://docs.aws.amazon.com/whitepapers/latest/navigating-gdpr-compliance/in-summary.html)) | Lambda includes 1 million requests and 400,000 GB-seconds monthly ([pricing](https://aws.amazon.com/lambda/pricing/)). RDS's quoted free tier is a temporary 12-month new-account allowance, not a steady-state cost ([RDS pricing](https://aws.amazon.com/rds/postgresql/pricing/)). CloudFront now offers $0 Hobby and $15/month Pro flat-rate plans as well as pay-as-you-go ([announcement](https://aws.amazon.com/blogs/networking-and-content-delivery/introducing-flat-rate-pricing-plans-with-no-overages/), [pricing](https://aws.amazon.com/cloudfront/pricing/)) | Mature UK infrastructure, object delivery and managed [RDS PostGIS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.Extensions.html); portable Node/container and PostgreSQL paths; broad route to later controlled services | Highest configuration surface among these candidates; many individually cheap meters make bills harder to predict; RDS high availability, NAT, logs and support can dominate a small site's bill |
| **Cloudflare edge + external London PostgreSQL**: Pages/Workers + R2 + Neon/Supabase | R2 chooses location automatically; Western Europe is only a best-effort hint. Its enforceable jurisdictions include EU, not UK ([R2 data location](https://developers.cloudflare.com/r2/reference/data-location/)). Regional Services is an Enterprise data-localisation feature and does not govern origin traffic ([Regional Services](https://developers.cloudflare.com/data-localization/regional-services/)); Workers code and secrets are globally distributed even when execution is regionalised ([Workers localisation](https://developers.cloudflare.com/data-localization/how-to/workers/)) | Workers Paid has a $5/month minimum; Free allows 100,000 requests/day ([pricing](https://developers.cloudflare.com/workers/platform/pricing/), [limits](https://developers.cloudflare.com/workers/platform/limits/)). R2 includes 10 GB storage, 1 million Class A and 10 million Class B operations monthly; standard storage is $0.015/GB-month with no egress charge ([R2 pricing](https://developers.cloudflare.com/r2/pricing/)) | Excellent global cache/object economics for open PMTiles and assets; a standard London Postgres can remain the system of record; useful as a public-delivery layer even if another supplier hosts the application | Not evidence for a strict UK-only stack; Workers is not an ordinary unrestricted Node host; D1 is SQLite rather than the future PostGIS system of record; PMTiles range reads are billable Class B operations, so measure cold-cache behaviour |
| **Self-managed London VM**: Node, reverse proxy, PostGIS and optional Martin in containers | DigitalOcean, AWS, Azure and UK specialists offer London/UK virtual machines; contractual backup, support and transfer details remain supplier-specific | A DigitalOcean basic VM lists 512 MiB at $4/month and 1 GiB at $6/month before backup and operator time ([Droplet pricing](https://www.digitalocean.com/pricing/droplets/)) | Maximum software portability and a simple fixed cash price; can run the same containers intended for a managed platform | BCA becomes responsible for patching, firewalls, secrets, certificates, database backup/restore testing, disk capacity, monitoring and recovery. One small VM is a failure domain, not a credible HA claim |

### Cost scenarios rather than a false total

The unknown layer volume and traffic make a single monthly number misleading. These scenarios expose the cost floors that should be measured:

1. **Static public launch:** static web hosting plus versioned PMTiles/COGs in object storage and CDN. It may remain within entry allowances at modest traffic. Costs are storage, range requests, egress, build work and logs; there is no database or tile-server floor.
2. **Portable low-traffic application:** one small Node service plus a single-node managed PostgreSQL/PostGIS database. Public list prices make DigitalOcean roughly $20.15/month before assets, backups and tax; Vercel Pro plus Neon's example intermittent 1 GB Launch workload is roughly $35/month. Neither figure is a production-HA quote.
3. **Production resilience:** multiple app instances or scale-to-zero compute, managed database HA/PITR, tested backup, alerting and support. DigitalOcean's documented managed-database HA floor alone is about $60/month; Azure, AWS, Neon and Supabase need workload-specific calculators/configurations.
4. **Dynamic raster/vector service:** add memory/CPU for Martin or TiTiler, cache storage and abuse protection. The first benchmark should use the shortlisted layers; theoretical request counts cannot substitute for tile-generation latency and cache-hit measurements.

Free allowances are useful for previews and build validation. They should not be presented to trustees as a stable production budget where suppliers explicitly exclude commercial use, SLA or durable uptime.

## Deployment, operations and observability

### Minimum production controls

Irrespective of host, the first public release should have:

- infrastructure and service configuration in version control;
- separate build, preview and production environments with protected production secrets;
- pinned Node and package-manager versions, dependency and container scanning, and reproducible geospatial build tools;
- immutable, checksummed public data derivatives and an atomic manifest switch;
- cache headers and purge/version rules tested for HTML, metadata, sprites/fonts, PMTiles and COGs;
- health checks, external uptime monitoring, structured application logs, exception reporting, latency/error metrics and alerts with an owner;
- database backup and restore testing before any database becomes authoritative; and
- a supplier register covering legal entity, service regions, backups, support access, subprocessors, deletion and transfer mechanism, as already required by the compliance research.

OpenTelemetry's JavaScript implementation supports Node and browser instrumentation; traces and metrics are stable while logs remain in development ([JavaScript status](https://opentelemetry.io/docs/languages/js/)). OTLP exporters can send telemetry to a supplier or independent collector ([exporters](https://opentelemetry.io/docs/languages/js/exporters/)). That provides a more portable baseline than embedding domain code directly around one host's SDK. Browser telemetry must be deliberately minimised because URLs, searches and selected features can become personal or sensitive usage data.

Supplier-native entry points are adequate for an initial service: DigitalOcean Monitoring is free and Uptime includes one free check ([Monitoring](https://docs.digitalocean.com/products/monitoring/details/pricing/), [Uptime](https://docs.digitalocean.com/products/uptime/details/pricing/)); Azure Application Insights includes a 5 GB pay-as-you-go ingestion allowance and its default tables retain data for 90 days ([FAQ](https://learn.microsoft.com/en-us/azure/azure-monitor/app/application-insights-faq), [retention](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/data-retention-configure)); AWS CloudWatch has small free log, metric, dashboard and alarm allowances ([pricing](https://aws.amazon.com/cloudwatch/pricing/)). Retention, access and alert destinations still need explicit configuration.

## Accessibility and progressive bilingual delivery

[WCAG 2.2](https://www.w3.org/TR/WCAG22/) is technology-neutral; a geospatial renderer does not waive perceivability, operability, understandability or robustness requirements. The platform should therefore model a user's filter and feature selection independently of the map, then render that shared state into both map and semantic HTML.

At minimum:

- every important layer is enabled through labelled HTML controls, not only a map gesture;
- filtered features and selected-feature details are available as a heading/list/table route with place names, coordinates, dates, source, update status and attribution;
- map popups do not contain the only copy of important information;
- legends pair colour with text, symbols or patterns and preserve sufficient contrast;
- keyboard focus is visible and does not become trapped in the map canvas;
- pan/zoom animation respects reduced-motion preferences;
- the interface has stable translation keys, language metadata and room for longer Welsh labels; and
- automated checks are supplemented by keyboard, screen-reader, zoom/reflow and representative-user testing.

This architecture also makes the service more robust on low-powered devices and poor connections: the non-map route can function without loading the map engine or large tiles.

## Portability and migration pressure

| Choice | Portability-preserving practice | Lock-in or migration trigger |
|---|---|---|
| Static frontend | Standard generated HTML/CSS/JS; avoid assuming one host's image, middleware or edge APIs | Server-only features or provider adapters spread through UI/domain code |
| Public geospatial assets | PMTiles, COG, GeoJSON; versioned relative URLs; S3-compatible/object abstraction; documented CORS/cache policy | Supplier-specific transforms or unexported tile catalogues become canonical |
| Dynamic application | Standard Node runtime or OCI container; stateless request handlers; background-job interface | Edge-runtime constraints or proprietary queues/KV become domain dependencies |
| Canonical feature data | PostgreSQL/PostGIS, migration scripts, regular logical backups and restore drills | Serverless database feature restrictions, proprietary branch/auth APIs or untested egress |
| Vector tiles | Stable TileJSON/style boundary; Martin or SQL behind an internal service URL | Client assumes one supplier's tileset IDs, styles, fonts or tokens |
| Raster | Retain COG source and reproducible rendering recipes | Only derived proprietary tiles remain; TiTiler introduced before dynamic raster need exists |
| Telemetry | OpenTelemetry/OTLP and structured logs with explicit schema | Only supplier SDK events exist and historical export/retention is untested |

The highest near-term migration pressure comes from making a free platform tier part of the product contract, putting authoritative data in an edge-specific database, or allowing map-provider styles/fonts/tiles to become undeclared runtime dependencies. Choosing UK-region standard Postgres and open archives reduces those risks even if the application host later changes.

## Decision tests for the architecture ticket

Before selecting among the candidates, measure or decide:

1. **Dataset profile:** shortlisted layer count, compressed bytes, largest feature count, raster resolution, time slices, update frequency and licence/attribution constraints.
2. **Interaction profile:** which layers need client styling, spatial filtering, server queries, raster rescaling/band maths or feature-level links; which can be immutable archives.
3. **Traffic envelope:** expected monthly users, peak concurrent sessions, average PMTiles range requests, raster bytes, cache-hit ratio and preview/build volume.
4. **UK-hosting interpretation:** whether BCA requires only canonical database and application processing in the UK, or also public derivative object storage, CDN edge caching, telemetry, support access and backups. Contractual evidence must match that boundary.
5. **Availability target:** acceptable recovery time/data loss, whether a static degraded mode is sufficient, and whether managed database HA is required at launch.
6. **Operator capacity:** who receives alerts, patches dependencies, restores data and responds to supplier incidents; this decides whether a VM's cash saving is real.
7. **Representative prototype:** test MapLibre with the heaviest shortlisted vector and raster/time layer on mid-range mobile hardware, including a complete keyboard and non-map flow.
8. **Re-priced bills:** obtain calculator outputs for measured storage, requests, egress, compute, database/HA, logs and backups in the exact UK region, then add VAT and a contingency.

## Decision evidence carried forward

- **Keep static and dynamic delivery composable.** Static PMTiles/COG delivery is the lowest-operations launch path; standard Node/PostGIS plus Martin/TiTiler are escalation points, not mandatory day-one infrastructure.
- **Keep UK canonical hosting explicit.** DigitalOcean London, Vercel plus a London database, Azure UK South and AWS London are all credible shortlist families. Cloudflare is better evidenced as a public-delivery adjunct than as proof of a strict UK-only platform.
- **Treat free tiers as trials, not the production design.** Vercel Hobby is unsuitable for BCA's production use, Azure Static Web Apps Free has no SLA, and AWS RDS's advertised free allowance is temporary.
- **Do not equate a single cheap database node or VM with production resilience.** Availability, backup, restore and operator ownership need a separately funded decision.
- **Preserve the larger-platform path through open seams.** MapLibre, PMTiles, COG, GeoJSON, PostgreSQL/PostGIS, portable Node/containers and OpenTelemetry minimise forced migration while still allowing supplier-managed services.
- **Make the accessible, bilingual non-map experience part of the application model.** It cannot be retrofitted by changing the map library or hosting provider.

These findings narrow the next decision but intentionally do not select a supplier or final architecture. The layer shortlist and representative benchmark are the most important missing evidence.
