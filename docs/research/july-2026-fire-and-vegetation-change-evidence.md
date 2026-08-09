# Defensible July 2026 fire and vegetation-change evidence

**Research date:** 9 August 2026

**Decision question:** Which open-republishable source products and processing methods can defensibly show the July 2026 Blorenge fire extent and observed post-fire vegetation change across the agreed core area and 2 km buffer?

**Scope:** Decision evidence, not a final scene, perimeter, index threshold or production architecture choice.

## Finding

A defensible public evidence package is possible at low data cost, but it must keep three propositions separate:

1. **An event happened at a particular time and place.** That comes from a fire-service, land-manager or field record, not from spectral change alone. No openly republishable first-party July 2026 incident chronology or surveyed perimeter was located in this research. It remains an input to acquire or verify.
2. **A satellite observed a changed surface.** Copernicus Sentinel-2 Level-2A is the strongest open source for this small upland area: surface reflectance at 10 m for red/NIR vegetation indices and 20 m for NIR/SWIR burn-sensitive indices, with scene classification, cloud probability, aerosol and acquisition metadata. Landsat 8/9 Collection 2 Level-2 surface reflectance supplies an independent 30 m check and a longer, stable archive.
3. **A provisional boundary or change indicator was derived.** EFFIS can supply a useful first European-scale burnt-area perimeter if it mapped the event, but EFFIS expressly warns that its product is a satellite-derived estimate, may omit small burned or unburned patches, does not distinguish wildfire from prescribed or environmental burning, and its dates need not be ignition or extinction dates. A BCA-derived Sentinel boundary can be finer and more transparent, but it is still a modelled interpretation rather than a surveyed fire edge.

The strongest package is therefore a **versioned provisional perimeter plus continuous observed-change layers**, with every observation date, mask, source product, method, confidence and alternative boundary visible. It may say that a surface change is *consistent with the documented July 2026 fire* after chronology and spatial correspondence are verified. It must not call spectral change proof of ecological recovery, habitat condition, soil burn severity, causation or an exact fire edge.

## Source products and their decision value

| Product | What it can contribute | Resolution and timing | Open-republication position | Principal limitation | Relative processing cost |
|---|---|---|---|---|---|
| **Sentinel-2 Collection-1 Level-2A surface reflectance** | Main visual evidence; NBR/dNBR, NDVI/dNDVI and moisture-sensitive change; a BCA-derived provisional scar/perimeter | Four bands at 10 m; the burn-relevant B8A, B11 and B12 bands at 20 m; nominal two-satellite revisit is five days, with extra acquisitions in 2026 from the extended S2A campaign | Free, full and open; derived publication should say **“Contains modified Copernicus Sentinel data 2025–2026”** | Optical only: clouds, smoke, haze, topographic shadow, phenology and recent rainfall can all alter reflectance; a 10 m rendering of a SWIR index does not create 10 m evidence | **Low–medium.** Catalogue screening is cheap; three small AOI band/mask subsets are modest. Cloud compositing, terrain controls and uncertainty layers add analyst time |
| **Landsat 8/9 Collection 2 Level-2 surface reflectance, Tier 1/L1TP** | Independent corroboration of the scar and direction of change; fills some Sentinel cloud gaps; supports longer time-series context | 30 m multispectral; each satellite repeats every 16 days and the pair is offset by eight days | USGS public domain; credit USGS and cite the Collection 2 Level-2 dataset | Coarser than the desired perimeter; scene cloud percentage is not AOI cloud; neighbouring paths have different geometry; geometric “terrain correction” is not the same as radiometric topographic normalisation | **Low** for a few band subsets; **medium** for multi-year compositing or cross-sensor harmonisation |
| **EFFIS Rapid Damage Assessment burnt-area perimeter** | Fast, independently produced candidate boundary and alternative to display beside a BCA-derived boundary | MODIS 250 m, refined with Sentinel-2 at 20 m; current season updated daily; small fires can be included but the historic design focus is about 30 ha and larger | EU-owned EFFIS content is generally CC BY 4.0: credit the source and indicate changes | Not an incident-authority boundary; can miss small patches/islands; event type and reported dates are ambiguous; current features can be revised | **Very low** to snapshot and clip; operational risk is higher if a live WFS is treated as the only copy |
| **EFFIS fire-severity layer** | A later external comparison of NBR-based change classes, when the event is included | Sentinel-2 20 m; EFFIS says severity is calculated 30 days after the fire | Same EFFIS reuse terms, subject to item-specific notices | Not an immediate-post product. EFFIS applies generic dNBR thresholds; no Blorenge habitat/field calibration is demonstrated | **Low** to ingest; **medium–high** to validate locally |
| **EFFIS VIIRS active-fire / perimeter display** | Coarse timing and independent evidence of active heat, if a detection exists | Nominal 375 m for VIIRS-derived perimeters | Same EFFIS terms, subject to the displayed layer notice | Too coarse for a Blorenge perimeter; EFFIS does not use VIIRS-derived burnt areas in its burnt-area statistics | **Very low** |
| **Copernicus Land Monitoring Service daily global burnt area** | Regional cross-check only | 300 m daily products are listed for 2025-present | Copernicus-service notice must be retained | Far too coarse to define a small upland scar or edge | **Low**, but low decision value |

The Sentinel-2 Level-2A product is orthorectified bottom-of-atmosphere reflectance and includes a 20 m Scene Classification Layer (SCL), cloud and snow probabilities, aerosol optical thickness and water-vapour layers. ESA specifies less than 5 m multitemporal registration error at 95.5% confidence for current Collection-1 L2A, while the native band sizes remain 10, 20 and 60 m ([ESA Sentinel-2 Collection-1 L2A](https://sentinels.copernicus.eu/web/sentinel/sentinel-data-access/sentinel-products/sentinel-2-data-products/collection-1-level-2a); [Copernicus Data Space L2A band documentation](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html)). The normal dual-spacecraft specification is a five-day ground-track revisit, but ESA extended S2A operations through 2026 specifically to increase availability beyond the nominal S2B/S2C constellation ([Sentinel-2 product specification](https://sentinels.copernicus.eu/documents/d/sentinel/sentinel-2-products-specification-document-15_1); [S2A extension campaign](https://sentinels.copernicus.eu/web/sentinel/-/sentinel-2a-extension-campaign-prolonged-until-the-end-of-2026)).

Landsat 8/9 Level-2 surface reflectance is CEOS Analysis Ready Data, atmospherically corrected using LaSRC and supplied with pixel, saturation/terrain-occlusion and aerosol QA. OLI multispectral bands are 30 m and the two satellites have an eight-day acquisition offset ([USGS Collection 2 Level-2](https://www.usgs.gov/landsat-missions/landsat-collection-2-level-2-science-products); [Landsat 8/9 archive specification](https://www.usgs.gov/centers/eros/science/usgs-eros-archive-landsat-archives-landsat-8-9-operational-land-imager-and)). USGS's Level-3 Burned Area product is **not** an available shortcut for Wales: it is generated only for the conterminous United States ([USGS Collection 2 Level-3 Burned Area](https://www.usgs.gov/landsat-missions/landsat-collection-2-level-3-burned-area-science-product)).

EFFIS derives Rapid Damage Assessment perimeters semi-automatically from MODIS, Sentinel-2 and ancillary evidence, then visually verifies and corrects them. Its own limitations make it suitable as a `provisional-satellite` boundary, not ground truth ([EFFIS Rapid Damage Assessment](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/rapid-damage-assessment)). Its published severity method forms mean cloud-masked pre/post Sentinel-2 NBR composites at 20 m, differences them, and applies generic dNBR classes after 30 days ([EFFIS fire severity](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/fire-severity)).

## What the catalogues establish as of 9 August 2026

The official catalogue results show that data availability is not the main obstacle. Scene suitability and event chronology are.

### Sentinel-2 candidates

The Blorenge search box falls in Sentinel tile `T30UVC`. The Copernicus Data Space STAC catalogue contains these especially useful discovery candidates:

| Role to test, not yet designate | Candidate product | Whole-tile cloud metadata |
|---|---|---:|
| Seasonally close pre-fire baseline | `S2C_MSIL2A_20250712T112141_N0511_R037_T30UVC_20250712T145316` | 0.28% |
| Later pre-fire seasonal alternative | `S2B_MSIL2A_20250816T112119_N0511_R037_T30UVC_20250816T122832` | 1.24% |
| Clear July 2026 observation whose pre/post status depends on the incident chronology | `S2A_MSIL2A_20260709T112131_N0512_R037_T30UVC_20260709T194109` | 5.84% |
| Clear July 2026 observation whose pre/post status depends on the incident chronology | `S2B_MSIL2A_20260712T112109_N0512_R037_T30UVC_20260712T133747` | 3.93% |
| First later candidate with the lowest reported tile cloud after 12 July | `S2C_MSIL2A_20260717T112111_N0512_R037_T30UVC_20260717T150015` | 32.75% |
| Later-observation candidate | `S2A_MSIL2A_20260729T112131_N0512_R037_T30UVC_20260729T195715` | 77.12% |

The catalogue also contains observations on 19, 22 and 27 July and 1, 6 and 8 August. Their high **tile-wide** cloud metadata does not prove the small AOI is cloudy. Copernicus explicitly warns that cloud percentage applies to an approximately 12,000 km² tile and may not describe the requested AOI. Each candidate therefore needs a per-pixel AOI mask and visual inspection before selection ([official 2025 Sentinel query](https://stac.dataspace.copernicus.eu/v1/collections/sentinel-2-l2a/items?bbox=-3.08,51.77,-3.03,51.82&datetime=2025-07-01T00:00:00Z/2025-08-31T23:59:59Z&limit=100); [official 2026 Sentinel query](https://stac.dataspace.copernicus.eu/v1/collections/sentinel-2-l2a/items?bbox=-3.08,51.77,-3.03,51.82&datetime=2026-07-01T00:00:00Z/2026-08-09T23:59:59Z&limit=100); [cloud-filter warning](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html#maxcloudcoverage)).

### Landsat candidates

The overlapping Landsat paths `203/024` and `204/024` provide useful cross-checks. Low-cloud discovery candidates include `LC09_L2SP_203024_20250708_20250710_02_T1_SR` (3.44% whole-scene cloud), `LC08_L2SP_203024_20250817_20250821_02_T1_SR` (1.58%), `LC08_L2SP_204024_20260710_20260716_02_T1_SR` (0.51%), `LC09_L2SP_203024_20260711_20260712_02_T1_SR` (0.01%) and `LC09_L2SP_204024_20260718_20260719_02_T1_SR` (17.35%). Later scenes exist on 19, 26 and 27 July and 3 August, but again require AOI-level masking. Use Tier 1 surface reflectance and compare the same path where possible; do not choose between overlapping paths by scene cloud percentage alone ([official USGS Landsat STAC query](https://landsatlook.usgs.gov/stac-server/collections/landsat-c2l2-sr/items?bbox=-3.08,51.77,-3.03,51.82&datetime=2025-07-01T00:00:00Z/2026-08-09T23:59:59Z&limit=100); [USGS Landsat STAC service](https://www.usgs.gov/landsat-missions/spatiotemporal-asset-catalog-stac)).

These lists are discovery evidence, not final selections. In particular, an image cannot be labelled `pre-fire` or `immediate post-fire` until an authoritative incident start/end chronology is attached.

## Defensible observation selection

Use a reproducible eligibility test rather than “least cloud” or “latest available.”

### 1. Fix the event interval first

Record the best available incident start, control/containment and end dates, their sources and uncertainty. An immediate-post observation must be the first **suitable** image after the documented interval, not simply the next satellite pass. If active smoke, cloud or shadow obscures material parts of the scar, keep it as event context and advance to the next suitable observation.

### 2. Evaluate the exact core plus 2 km buffer

For every candidate compute and retain:

- clear usable percentage across the whole AOI and separately inside every candidate perimeter;
- cloud, cloud-adjacency, cloud-shadow, terrain-shadow, snow, saturated/defective, no-data and haze/smoke percentages;
- the valid-observation footprint and, for a composite, a per-pixel observation-date raster;
- solar/view angles, source tile or path/row, processing baseline, and whether a tile edge crosses the AOI.

Reject a scene if obscuration is spatially correlated with the apparent scar edge or if meaningful comparison areas are missing. A small missing patch can be published only as `not observed`, never interpolated into a confident perimeter.

### 3. Make the pre-fire comparison seasonal

Start with the clear July/August 2025 candidates because they are at least a year before the event and seasonally close. Match by day-of-year, sensor/relative orbit (Sentinel `R037`) or Landsat path, solar geometry and AOI coverage. Prefer the nearest suitable 2025 date to the selected post-fire date; the 12 July Sentinel and 8 July Landsat scenes are strong early-July candidates, while 16/17 August are useful if the accepted latest comparison lies in August.

Do not silently median all of July and August. Upland vegetation phenology, grazing, cutting, rainfall and soil moisture can move NDVI, NDMI and NBR across that span. If one clear same-season scene is too fragile, use a narrow-window median/mean composite and disclose its date range and per-pixel contributing count. Original USGS research found that mean-composite fire metrics can outperform single-scene measures, but that is an argument for a documented composite, not a licence to combine different seasons invisibly ([USGS publication on mean-composite fire metrics](https://pubs.usgs.gov/publication/70197485)).

Use nearby **unburned reference areas** matched by habitat context, elevation, slope and aspect. Report change inside the provisional scar alongside change in these controls. A landscape-wide shift in both is evidence of phenology, moisture or illumination effects; a spatially coherent additional shift inside the incident area is stronger evidence of fire-associated surface change. This is still an inference, so record drought, rainfall, grazing and land-management alternatives where known.

### 4. Define “latest suitable” at publication time

The latest layer is a dated evidence snapshot, not a timeless status. Search forward from the immediate-post scene to the publication cut-off, apply the same AOI eligibility test, and use the newest accepted observation. If no single clear scene covers the area, use a tightly bounded composite and show its observation-date range. Re-run the search whenever the evidence page is updated.

## Processing and quality controls

### Sentinel-2

1. Use Level-2A bottom-of-atmosphere reflectance, not browser screenshots or rendered true-colour pixels. Work at **20 m** for NBR/NDMI because B8A/B11/B12 are native 20 m. Red/NIR NDVI can remain 10 m. If a 20 m result is served on a 10 m web grid, label the analytic resolution as 20 m.
2. Apply the ESA quantification/offset metadata or request reflectance from an API that harmonises values. Sentinel processing baseline 04.00 changed raw digital-number interpretation; Copernicus Data Space documents `harmonizeValues=true` for comparability across baselines. The 2025 candidates use `N0511` and the 2026 candidates `N0512`, so store the baseline even though ESA describes the 05.12 change chiefly as a product-specification/TLM update ([Copernicus harmonised values](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L1C.html#harmonize-values); [ESA baseline 05.12 notice](https://sentinels.copernicus.eu/-/deployment-of-sentinel-2-processing-baseline-in-version-05.12-on-4-february)).
3. Mask SCL no-data, saturated/defective pixels, cloud shadow, medium/high cloud, cirrus and snow; use cloud probability and a disclosed adjacency dilation. Treat SCL class 7 with care rather than deleting it blindly: since baseline 04.00 dark soils and burned areas can be assigned to `UNCLASSIFIED`, while class 2 is now named cast shadow. Visually inspect true colour, NIR/SWIR composites, cloud probability and aerosol values for smoke/haze and cloud-edge contamination ([ESA product-specification change](https://sentinels.copernicus.eu/-/sentinel-2-product-specification-document-psd-in-version-15.0); [SCL and cloud-probability codes](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html#available-bands-and-data)).
4. Do not assume Level-2A removes every slope effect. Sen2Cor performs combined atmospheric/topographic correction in sufficiently varied terrain and depends on a DEM, but ESA documents residual risks and the need for slope, aspect and cast-shadow inputs. Generate an independent terrain-shadow mask from an appropriate DTM and each scene's sun geometry; compare like illumination; exclude deep/unstable shadow or show it as uncertain. If an extra topographic normalisation is applied, publish both corrected and uncorrected QA and test stable reference areas ([Sen2Cor Level-2A algorithm, section 4.7](https://sentinels.copernicus.eu/documents/247904/446933/Sentinel-2-Level-2A-Algorithm-Theoretical-Basis-Document-ATBD.pdf)).
5. Visually and statistically test co-registration along stable high-contrast features. Sub-pixel registration specifications do not remove mixed pixels along a 20 m scar edge.

### Landsat

1. Use Collection 2 Tier 1 Level-2 surface reflectance. Apply the published `0.0000275` scale plus `-0.2` offset before calculating indices.
2. Mask `QA_PIXEL` fill, dilated cloud, cirrus, cloud, cloud shadow and snow; mask saturated bands and terrain occlusion with `QA_RADSAT`; inspect `SR_QA_AEROSOL`, especially interpolated or high-aerosol pixels. USGS describes these bit fields explicitly ([Collection 2 QA bands](https://www.usgs.gov/landsat-missions/landsat-collection-2-quality-assessment-bands)).
3. Treat L1TP terrain correction as **geometric relief-displacement correction**, not proof of radiometric topographic normalisation. Use scene angles plus the same terrain-shadow/reference-area test as Sentinel ([USGS processing levels](https://www.usgs.gov/landsat-missions/landsat-levels-processing)).
4. Check the current USGS known-issues and reprocessing pages before each release. USGS warns that Collection 2 surface reflectance can contain nonphysical values over shadowed land under low solar illumination and documents QA/NoData issues; those are directly relevant on the Blorenge's slopes ([Collection 2 known issues](https://www.usgs.gov/landsat-missions/landsat-collection-2-known-issues); [Collection 2 reprocessing events](https://www.usgs.gov/landsat-missions/landsat-collection-2-reprocessing-events)).

### Perimeter derivation and uncertainty

A reproducible provisional perimeter can be produced from a masked post-fire Sentinel NBR/SWIR composite, pre/post dNBR and visual review, constrained by the documented incident vicinity. Do not use one unexplained universal threshold. Derive candidate thresholds from the local continuous distribution and stable reference areas; run a sensitivity analysis; retain the continuous raster; and validate accessible edges with dated field observations or higher-authority evidence.

Publish at least four states:

- `higher confidence observed change`: multiple indicators and visual evidence agree;
- `lower confidence observed change`: one indicator or mixed pixels/terrain make the edge uncertain;
- `not observed`: cloud, smoke, shadow, saturation or no-data;
- `outside provisional extent` rather than `unburned`, unless independently checked.

Keep EFFIS and BCA-derived boundaries as named alternatives rather than silently unioning them. Report area with an uncertainty/sensitivity range and avoid false precision below the 20 m analytic support.

## Indicators and what they mean

| Indicator | Formula / bands | Defensible role | Main confounders and wording limit |
|---|---|---|---|
| **NBR** | `(NIR - SWIR2) / (NIR + SWIR2)`; Sentinel B8A/B12 at 20 m, Landsat B5/B7 at 30 m | Primary burn-sensitive surface contrast; visualise pre, post and latest | Moisture, exposed soil/rock, shadows and vegetation structure also alter it |
| **dNBR** | `NBR_pre - NBR_post` | Primary continuous fire-associated change indicator and candidate perimeter input | Generic classes are not locally calibrated severity. Field-linked classification is required for ecological or soil-severity claims |
| **NDVI / dNDVI** | `(NIR - red) / (NIR + red)`; Sentinel B8/B4 at 10 m, Landsat B5/B4 at 30 m | Easily explained vegetation-greenness/density change companion | Greenness is not condition or recovery; phenology, grazing and water stress matter. USGS defines NDVI as greenness/vegetation-density information, not an ecological diagnosis ([USGS Landsat NDVI](https://www.usgs.gov/landsat-missions/landsat-normalized-difference-vegetation-index)) |
| **NDMI / moisture-sensitive NIR–SWIR1 ratio** | `(NIR - SWIR1) / (NIR + SWIR1)`; Sentinel B8A/B11 at 20 m, Landsat B5/B6 at 30 m | Helps explain moisture-related change and interpret NBR | Very sensitive to recent rainfall, drying and soil moisture; do not call it fire severity |
| **Post-to-latest delta and distance from 2025 baseline** | Same index, same controlled workflow | Shows whether observed reflectance/greenness moved toward, away from or across the pre-fire reference | The word “recovery” implies ecological processes the satellite cannot establish; use **observed vegetation/burn change** |

USGS's interagency Burn Severity Portal defines NBR and dNBR and shows that operational severity classes are linked to field assessment; it also notes that apparently “unburned to low” or “increased greenness” pixels can include rapidly changing grasslands. That is a strong warning against importing forest-derived class names into Blorenge upland vegetation without local validation ([USGS post-fire mapping glossary](https://burnseverity.cr.usgs.gov/glossary); [USGS RAVG methods and field models](https://burnseverity.cr.usgs.gov/ravg/background-products-applications)).

## Claims the evidence can and cannot support

### Strongest supportable public claims

After incident chronology, scene QA and spatial correspondence have been completed:

- “This is a **provisional satellite-derived extent** of surface change associated with the documented July 2026 fire, based on Copernicus Sentinel-2 observations from [pre date] and [post date].”
- “Within the outlined area, near-infrared and short-wave-infrared reflectance changed between the seasonally comparable observations in a pattern **consistent with burning**.”
- “The latest suitable observation on [date] shows [higher/lower/mixed] vegetation greenness or burn-sensitive reflectance relative to [post date] and the 2025 reference.”
- “Cloud/shadow obscured [area or percentage], shown as `not observed`; edge confidence is lower in [named portions].”
- “EFFIS [agrees/partly agrees/does not include the event] at its own 20–250 m source resolution; both boundaries are shown because they use different methods.”

Every claim should state observation dates, analytic pixel size, source and uncertainty. “Associated with” is justified only when an authoritative event record and spatial/temporal match exist; without that record, the correct phrase is “observed surface change between [dates].”

### Claims not supported by satellite evidence alone

Do not claim:

- a surveyed, legal or exact fire perimeter;
- ignition/extinction time, cause, fire behaviour or that every changed pixel burned;
- ecological recovery, habitat condition, species response, restored ecosystem function or management success;
- soil burn severity, erosion risk or peat damage without appropriate field/soil evidence;
- locally meaningful “low/moderate/high severity” classes without field calibration;
- that unchanged-looking or cloud-masked pixels were unburned;
- that post-to-latest greening was caused by recovery rather than phenology, moisture, grazing or management.

## Licensing, attribution and cost controls

Copernicus Sentinel data may be reproduced, distributed, adapted and combined under the free, full and open legal notice. Public derived layers must use **“Contains modified Copernicus Sentinel data [Year]”**; unmodified distribution uses **“Copernicus Sentinel data [Year]”** ([Copernicus Sentinel legal notice](https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice)). EFFIS says EU-owned site content is generally CC BY 4.0, requiring appropriate credit and indication of changes, but third-party notices must still be checked ([EFFIS data licence](https://forest-fire.emergency.copernicus.eu/about-effis/data-license)). Landsat data are USGS public-domain records with no redistribution restriction; USGS requests source acknowledgement and publishes dataset citations ([USGS Landsat public-domain policy](https://www.usgs.gov/faqs/are-there-any-restrictions-use-or-redistribution-landsat-data); [USGS Collection 2 citations](https://www.usgs.gov/landsat-missions/landsat-collection-2-level-2-science-products)).

The data themselves have no fee. Copernicus Data Space offers free processing/download quotas, not an unlimited service guarantee; general-user quotas cover requests, processing units, transfer and concurrency ([Copernicus Data Space quotas](https://documentation.dataspace.copernicus.eu/Quotas.html)). Control cost and reproducibility by querying STAC first, clipping only required bands and QA to the AOI, caching immutable inputs, and pre-generating small cloud-optimised result rasters/tiles. A three-date Sentinel package plus Landsat cross-check is a small technical workload; the expensive part is defensibility—scene review, terrain/cloud sensitivity, field corroboration, bilingual explanation and later corrections—not raster arithmetic.

## Provenance, corrections and publication controls

For every released layer retain:

- source product ID, platform, tile/path-row, sensing and processing timestamps, processing baseline/collection/tier, STAC item URL and retrieval time;
- original metadata, checksum or immutable snapshot reference, bands, scale/offset and licence/attribution text;
- AOI and perimeter input version; software/container and code commit; CRS/grid/resampling; formula, thresholds, masks, dilation and compositing rule;
- valid-observation and uncertainty rasters, per-pixel date/count for composites, reference-area definition and QA statistics;
- reviewer, publication version/date, superseded version and plain-language change log.

Before publication and scheduled refreshes, check ESA quality/anomaly notices and the Copernicus `DeletedProducts` endpoint, which records reprocessed, corrupted, duplicated and obsolete products; check USGS known issues and reprocessing events; and re-query EFFIS because current-season perimeters can change ([Copernicus OData deleted-products documentation](https://documentation.dataspace.copernicus.eu/APIs/OData.html#deleted-products); [EFFIS current data services](https://forest-fire.emergency.copernicus.eu/applications/data-and-services)). If an input is replaced, mark the public layer stale, rerun the deterministic pipeline, issue a new version and preserve the previous evidence snapshot for audit. Never let an unversioned live WFS silently rewrite the canonical public story.

## Decisions this evidence enables, and remaining fog

This research supports these planning conclusions without selecting a final product implementation:

- Sentinel-2 L2A is capable of the finest defensible open analysis here; Landsat should be an independent corroboration rather than a 10 m-looking fused substitute; EFFIS should be a named provisional alternative/corroboration.
- A public fire layer needs an explicit source hierarchy: openly licensed local operational/survey evidence if obtained; otherwise EFFIS as an external provisional boundary; otherwise a transparently BCA-derived Sentinel boundary, with Landsat and field observations as corroboration.
- Continuous dNBR plus NDVI/NDMI companions are supportable. Public categorical “severity” needs a separate locally calibrated decision.
- “Immediate post” and “latest suitable” remain eligibility outcomes, not fixed catalogue dates.

Newly exposed decisions/fog are:

1. **Incident chronology and authority:** obtain the fire-service/land-manager incident dates and any surveyed perimeter, then settle whether it may be republished or only used for validation.
2. **Scene acceptance rule:** set the minimum valid AOI/perimeter coverage, cloud/shadow dilation and whether a narrow-window composite is allowed when no single observation passes.
3. **Public perimeter semantics:** choose whether the first release shows EFFIS, a BCA-derived boundary, both alternatives, or no polygon until field validation; define confidence/area-range presentation.
4. **Categorisation:** decide whether the public experience needs continuous change only or locally validated classes. Generic EFFIS/US burn-severity thresholds are not enough to make the latter decision safely.
5. **Correction cadence:** decide who reviews new suitable observations and provider corrections, how often, and when a material change triggers a superseding public version.
