# Authoritative Blorenge data sources and licensing constraints

**Research date:** 31 July 2026  
**Scope:** datasets suitable for a Blorenge information, wildfire-recovery and land-management platform.  
**Status:** implementation-planning research, not legal advice. Licence terms must be rechecked when each source is acquired.

## Decision summary

The platform can launch with a useful, low-cost authoritative core. Natural Resources Wales (NRW), Welsh Government, Ordnance Survey (OS), the Met Office, HM Land Registry and Copernicus provide most baseline layers under open terms. Phase 1 should ingest copies of open source data into a source-controlled geospatial catalogue rather than depend exclusively on third-party map services.

Four important gaps cannot be filled safely from generic open maps:

1. **The legal common and grazing-rights record.** The open NRW registered-common layer is a public-access dataset, not the full legal register, and expressly omits several classes of common. The relevant Commons Registration Authority's register is the authoritative source.
2. **Definitive public rights of way.** The legal record is held by the relevant local authority or National Park Authority. OS paths and community maps are useful context but are not substitutes.
3. **The local 2026 fire record.** EFFIS and satellite imagery can supply a fast provisional perimeter. South Wales Fire and Rescue Service (SWFRS) records and BCA field evidence are needed for a locally authoritative event record.
4. **Current ecological condition.** NRW's comprehensive Phase 1 survey is mainly 1979–1997 and is explicitly historical. Current habitat condition needs new field evidence and, where justified, licensed local biodiversity records or commissioned surveys.

Accordingly, datasets should carry one of four platform statuses:

- **Open-republishable:** may be displayed and exported after the exact licence and attribution are recorded.
- **Controlled:** may be stored or shown only to authorised users under written terms.
- **Viewer/reference-only:** may be linked or consulted, but not copied into the platform.
- **BCA-derived:** created from member evidence or analysis, with its inputs, method, confidence and publication approval retained.

## Licence and provenance rules

The [Open Government Licence (OGL)](https://www.nationalarchives.gov.uk/information-management/re-using-public-sector-information/uk-government-licensing-framework/open-government-licence/) permits free reuse but requires attribution of the provider and source. It excludes personal data, does not promise continued supply and does not erase third-party rights identified in a dataset's notice. DataMapWales likewise says that reuse must follow the licence attached to each resource and that restricted/licensed information must not be exposed in public data ([DataMapWales usage policy](https://datamap.gov.wales/info/terms-conditions)). A catalogue-level label such as “OGL” is therefore not enough: store the resource-specific attribution and restrictions.

For every imported or linked source, the platform's source registry should record:

- provider, dataset title, stable landing-page URL and endpoint/download URL;
- licence name, version and URL; exact attribution; third-party rights; permission agreement and expiry where applicable;
- geographic coverage, CRS, nominal resolution/scale and known exclusions;
- source publication/effective date, stated update cadence, retrieval timestamp, version/ETag/checksum;
- original format and immutable raw snapshot location;
- transformation code/version, derived output, quality checks and lineage to every input;
- intended visibility (`public`, `member`, `moderator`, `partner`, `emergency-release`), export permission and sensitivity rationale;
- observed date versus upload date for field records, contributor/organisation, moderation state and confidence.

Where DataMapWales does not state a refresh cadence, use its WFS for freshness-sensitive display or poll its metadata, but retain dated snapshots for reproducible proposals and plans. DataMapWales supports catalogue downloads plus OGC WMS/WFS; common vector download formats include GeoPackage, GeoJSON, GML and Shapefile ([platform description](https://datamap.gov.wales/info/what-we-do)).

## Recommended source inventory

“Cost” means data-access cost, not engineering, storage, egress or professional interpretation.

### 1. Boundaries, common land and ownership

| Priority | Source and authority | Access, format and coverage | Currency / resolution | Licence, publication and cost | Important constraint |
|---|---|---|---|---|---|
| Launch | [NRW Sites of Special Scientific Interest](https://datamap.gov.wales/layers/inspire-nrw%3ANRW_SSSI/metadata_detail) | DataMapWales download, WMS/WFS; standard vector formats; all Wales, EPSG:27700 | Published 25 Jun 2026; maintained designation boundary; source cadence not stated | OGL; specified NRW and OS attribution; free | Use the returned Blorenge feature and retain its identifier/version. A boundary does not describe feature condition or permitted operations. |
| Launch | [NRW National Parks](https://datamap.gov.wales/layers/inspire-nrw%3ANRW_NATIONAL_PARK/metadata_detail) | Download, WMS/WFS; GeoJSON, GeoPackage, Shapefile, GML, CSV; all Wales | Published 29 May 2025; MasterMap-aligned statutory boundary | OGL with NRW/OS attribution; free | This is the statutory Bannau Brycheiniog boundary; prefer it to third-party park maps with unspecified licences. |
| Launch | [NRW Open Access – Registered Common Land](https://datamap.gov.wales/layers/inspire-nrw%3ANRW_COMMON_LAND_2014/metadata_detail) | Download, WMS/WFS; common vector formats; all Wales, EPSG:27700 | Digitised 2014; published 2017; no cadence stated | OGL with NRW/OS attribution; free | A redacted CRoW public-access layer. It omits urban commons, deed-access commons, 1899 Act commons, provisional-order commons and village greens. It is not the legal rights/ownership register. |
| Launch | NRW [Open Country](https://datamap.gov.wales/layers/inspire-nrw%3ANRW_OPEN_COUNTRY_2014), [Other Statutory Access Land](https://datamap.gov.wales/layers/inspire-nrw%3ANRW_OTHER_STATUTORY_LAND_2014), [Other Dedicated Land](https://datamap.gov.wales/layers/inspire-nrw%3ANRW_OTHER_DEDICATED_LAND) and [Dedicated Forests](https://datamap.gov.wales/layers/inspire-nrw%3ANRW_PUBLIC_FOREST_2014) | DataMapWales download and WMS/WFS; all Wales | Mainly 2014 mapping; Other Dedicated Land published May 2026; inspect each metadata date | OGL with specified attribution; free | These layers must be combined to describe CRoW access. Dedicated Forests says it is not a definitive NRW landholding dataset. |
| Essential request | Relevant local authority **Commons Register**, including land, rights and ownership sections and maps | Inspection/copies or agreed digital export from the Commons Registration Authority | Live legal register; resolution is the registered plan | Terms and copying fees set by authority; permission required for web republication | Welsh law guidance confirms that each of Wales's 22 local authorities holds its register ([Law Wales](https://law.gov.wales/environment/countryside-and-access/common-land)). Acquire the Blorenge register entries; keep names/contact data private. |
| Launch context | [HM Land Registry INSPIRE Index Polygons](https://www.gov.uk/guidance/inspire-index-polygons-spatial-data) | Account download by local authority in GML; WMS; England and Wales freehold registrations | Monthly; indicative registered extent | OGL; free | No owner/title number, leasehold or legal boundary. It is a freehold subset and can overlap/duplicate at authority edges. |
| Targeted verification | HM Land Registry title register/title plan | Search service; PDF document per identified title | Current general-boundary record | £7 each online; £11 each official postal copy ([fees](https://www.gov.uk/search-property-information-land-registry)) | Purchased documents are evidence, not automatically an openly redistributable ownership dataset. Store privately unless reuse terms allow publication. |
| Defer | [HM Land Registry National Polygon Service](https://use-land-property-data.service.gov.uk/) | Bulk/API, CSV and Shapefile for England and Wales | Monthly | £20,000 + VAT/year, individual licence | Disproportionate for Phase 1. Use free INSPIRE polygons and targeted title checks. |
| Launch | BCA custom survey, damage, grazing, proposal and emergency geometries | PWA capture/API; GeoJSON internally; PostGIS; export GeoJSON/GeoPackage | Event/user dated; GPS accuracy retained | BCA contributor terms; low data cost | Never represent a user-drawn geometry as an official boundary. Record geometry type, author, method, accuracy/confidence and approval status. |

### 2. Paths, access and transport

| Priority | Source and authority | Access, format and coverage | Currency / resolution | Licence and cost | Important constraint |
|---|---|---|---|---|---|
| Essential request | Definitive public-rights-of-way GIS and statement from the relevant highway/National Park authority | Request GIS export plus statements and modification-order status | Live legal record, authority-native geometry | Authority-specific reuse terms; likely no data fee or cost-recovery fee | Welsh Government says local authorities hold the legal records and definitive maps ([2026 access baseline](https://www.gov.wales/sustainable-farming-scheme-regulatory-baseline-statutory-public-access-includes-public-rights-way-smr-14-html)). Obtain written publication/export terms. |
| Launch | [OS OpenMap – Local](https://www.ordnancesurvey.co.uk/products/os-open-map-local) | OS Data Hub download; GeoPackage, Shapefile, GML or GeoTIFF; Great Britain | 1:10,000; six-monthly | OGL; free; OS attribution | Useful rural base map with roads and tracks. It does not establish legal public access. |
| Launch | OS Open Roads, Open USRN and [OS OpenData portfolio](https://www.ordnancesurvey.co.uk/products/open-data) | OS Data Hub/API; national vector data | Product-specific, many twice yearly | OGL; free | Suitable for approach routes and identifiers, not off-road emergency navigability. |
| Optional | [OS MasterMap Highways Network – Paths](https://www.ordnancesurvey.co.uk/products/os-mastermap-highways-network-paths) | Download; GeoPackage, GML, vector tiles | 1:1,250–1:10,000; monthly | Premium quote; contractual licence | Includes authoritative-source path information, but OS identifies third-party-rights complications for Highways products. Procurement must cover public display/export. The legacy Detailed Path Network is scheduled to end on 30 Sep 2026 and should not be newly adopted ([OS roadmap](https://www.ordnancesurvey.co.uk/products/roadmap)). |

### 3. Elevation, terrain and landform

| Priority | Source and authority | Access, format and coverage | Currency / resolution | Licence and cost | Important constraint |
|---|---|---|---|---|---|
| Launch | [Welsh Government Wales LiDAR](https://datamap.gov.wales/maps/lidar-data-download/) and [2020–2023 tile catalogue](https://datamap.gov.wales/layers/geonode%3Awelsh_government_lidar_tile_catalogue_2020_2023) | Tile downloads and Wales-wide cloud-optimised GeoTIFFs; DTM, DSM and hillshade | 1 m, flown 2020–2023 | Map/download page states OGL; free. Preserve the applicable layer licence because the tile-catalogue metadata itself says “not specified.” | Best open terrain source. The provider warns it was not produced for flood modelling and may need removal of vegetation/bridges and validation. |
| Launch/history | [NRW Historic LiDAR Archive](https://datamap.gov.wales/layers/inspire-nrw%3ANRW_LIDAR_ARCHIVE_TILE_CATALOGUE) | Tile index with DTM/DSM links; WMS/WFS | 0.25–2 m depending on place/date; some 1998–2002 data lacks DTM | OGL with NRW attribution; free | Coverage and date vary; catalogue marked temporary. Capture tile, flight date and resolution. |
| Fallback | OS Terrain 50 | OS open download; contours/grid | 50 m grid / 10 m contours; product cadence | OGL; free | Lower-detail nationwide fallback, not adequate for drains, microtopography or fire-access decisions. |
| Defer | [OS Terrain 5](https://www.ordnancesurvey.co.uk/products/os-terrain-5) | Download; ASCII DTM grid, Shapefile/GML contours | 5 m posts and contours; quarterly; typical accuracy better than 2 m RMSE | Premium quote | Wales LiDAR is both finer and open; procure only if coverage/maintenance requirements justify it. |

### 4. Hydrology, drainage and water

| Priority | Source and authority | Access, format and coverage | Currency / resolution | Licence and cost | Important constraint |
|---|---|---|---|---|---|
| Launch | [NRW Main Rivers](https://datamap.gov.wales/layers/inspire-nrw%3ANRW_MAIN_RIVERS/metadata_detail) | Download/WMS/WFS; GeoJSON, GeoPackage, GML, Shapefile; Wales | Statutory 1:10,000 centreline; published Jan 2022 | OGL with NRW/OS attribution; free | Only designated main rivers; small mountain drains and grips may be absent. |
| Launch | [Flood Risk Assessment Wales](https://datamap.gov.wales/layergroups/inspire-nrw%3AFloodRiskAssessmentWales), especially surface water/small watercourses | Download/WMS/WFS; vector risk zones | National modelling 2 m; detailed local models usually 2–10 m; published May 2026 | OGL with multi-party attribution; free | Indicative, not property-specific. NRW prescribes maximum 1:5,000 display zoom and 1:10,000 contextual base mapping. Do not convert risk zones into claimed drainage features. |
| Launch | [WFD Cycle 3 waterbodies, catchments and classifications](https://datamap.gov.wales/layergroups/geonode%3Anrw_wfd_cycle_3_classifications) | DataMapWales downloads/WMS/WFS; linked by waterbody ID | Baseline 2021–2027; classification updated every three years | OGL; specified attribution varies by layer; free | Strategic waterbody data; not a complete small-watercourse network. |
| Launch | [OS Open Rivers](https://www.ordnancesurvey.co.uk/documents/product-support/tech-spec/os-open-rivers-technical-specification-v2.3.pdf) | GML, Shapefile, GeoPackage, MBTiles; Great Britain | Generalised link-node network; product versions | OGL; free | Approximate central alignment; IDs are not persistent between releases. Use NRW statutory data where it exists. |
| Optional live | [NRW River Levels, Rainfall and Sea API](https://api-portal.naturalresources.wales/products) | Authenticated open API; station observations/history | Station-specific, recent/live and historical | Open-data product; free tier/access subject to API registration | Check whether any nearby gauge represents upland Blorenge conditions before building a dependency. |
| Essential BCA data | Ditches, grips, culverts, springs, water points, erosion and blocked drainage | PWA survey plus member documents; points/lines/polygons, photos | Field accuracy and observation date | BCA-controlled; contributor permissions | No identified open source provides complete field drainage. Derived flow paths from LiDAR must be labelled modelled and field-verified, not authoritative. |

### 5. Habitats, protected sites, woodland and species

| Priority | Source and authority | Access, format and coverage | Currency / resolution | Licence and cost | Important constraint |
|---|---|---|---|---|---|
| Launch baseline | [NRW Terrestrial Phase 1 Habitat Survey](https://datamap.gov.wales/layergroups/geonode%3Anrw_terrestrial_phase_1_habitat_survey) | Seven downloadable/WMS/WFS vector layers for Wales | Comprehensive field survey mainly 1979–1997; update not planned | OGL with NRW/OS attribution; free | Historical baseline only. Target notes can contain personal/sensitive information; use redacted public versions. Never present it as current post-fire condition. |
| Launch | SSSI boundaries plus [NRW Unitisation Boundaries](https://datamap.gov.wales/layers/inspire-nrw%3ANRW_UNITIZATION) | Download/WMS/WFS; vector | Units updated as designations/management change; published Oct 2025 | OGL with NRW/OS attribution; free | Units support management linkage but condition, features, citations and operations-requiring-consent documents must be linked separately. |
| Launch context | [LANDMAP Landscape Habitats](https://datamap.gov.wales/layers/inspire-nrw%3ANRW_LANDMAP_Landscape_Habitats/metadata_detail), [Geological Landscape](https://datamap.gov.wales/layers/inspire-nrw%3ANRW_LANDMAP_Geological_Landscape/metadata_detail) and Visual/Sensory | Download/WMS/WFS; common vectors; all Wales | Strategic aspect areas; live service recommended for freshness; published Mar–May 2026 | OGL with NRW attribution; free | Landscape character/evaluation, not plot-scale habitat condition. |
| Launch | [Ancient Woodland Inventory 2021](https://datamap.gov.wales/layers/inspire-nrw%3ANRW_ANCIENT_WOODLAND_INVENTORY_2021) and [Trees Outside Woodlands](https://datamap.gov.wales/layers/geonode%3Atow_wales) | Download/WMS/WFS; vector | AWI edition 2021, published Apr 2026; TOW derived Feb 2026 from LiDAR, canopy ≥3 m and >5 m² | OGL; free | TOW is model-derived and excludes NFI woodland; use alongside, not instead of, National Forest Inventory data. |
| Optional/licence-aware | [NBN Atlas](https://nbn.org.uk/news/future-nbn-gateway-nbn-atlas-opening-access-data/) species occurrences | Web/API/download; Darwin Core; point or 100 m/1/2/10 km grids | Dataset-provider cadence | Per dataset/record: CC0, CC BY, CC BY-NC or OGL; generally free | Filter and preserve the licence for every source. Sensitive Welsh species are blurred; full resolution requires data-provider approval ([sensitive-data policy](https://nbn.org.uk/sensitive-data/)). CC BY-NC records cannot be used for commercial/funded outputs without permission. |
| Recommended request | [SEWBReC / Aderyn](https://sewbrec.org.uk/enquiries) local species, habitats and sites | Scoped search/report and data agreement | Local recorder holdings; variable accuracy/date | Charity/non-commercial rates published from £40 + VAT without SLA or £32.50 + VAT with SLA; polygon/custom search quoted ([charging policy](https://sewbrec.org.uk/upload/library/A3_Data_-_Charging_%28stand-alone%29_%282023%29.pdf)) | Free data cannot automatically be passed to paid organisations or used in funded work. Negotiate a repeatable data-exchange/licence agreement and public aggregation rules. |
| Conditional | Detailed/sensitive NRW ecological data | NRW environmental-data request | Dataset-specific | OGL or NRW Conditional Licence; request may take up to 20 working days ([request process](https://naturalresources.wales.gov.uk/evidence-and-data/accessing-our-data/request-environmental-data/?lang=en)) | NRW may withhold precise ecology where release could harm the environment. Store granted data in controlled layers and obey onward-disclosure restrictions. |

### 6. Wildfire extent, severity and history

| Priority | Source and authority | Access, format and coverage | Currency / resolution | Licence and cost | Important constraint |
|---|---|---|---|---|---|
| Immediate provisional | [EFFIS burnt areas and fire-danger services](https://forest-fire.emergency.copernicus.eu/applications/data-and-services) | WMS; current burnt-area Shapefile/SpatiaLite; historical extracts by request | Daily current-season products; MODIS 250 m refined with Sentinel-2 20 m; generally detects ~30 ha+, some smaller since 2018 | EU-owned content generally CC BY 4.0; free; credit and indicate changes ([licence](https://forest-fire.emergency.copernicus.eu/about-effis/data-license)) | EFFIS says its perimeters do not distinguish wildfire, environmental or prescribed burning; dates may not be ignition/extinction dates; small islands/scars may be missed. Use as `provisional-satellite`, not final truth ([method](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/rapid-damage-assessment)). |
| Immediate analysis | [Copernicus Sentinel-2](https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-2) | Copernicus Data Space browser, STAC/OData/S3 and processing APIs | 13 bands: 10 m (4), 20 m (6), 60 m (3); systematic acquisitions | Sentinel data free, full and open; no data fee, service quota may apply ([terms](https://dataspace.copernicus.eu/terms-and-conditions)) | Cloud/smoke and classification choices affect results. Preserve scene IDs, processing level, bands, algorithm and validation evidence for any derived burn/severity layer. |
| Historical lead | [USGS Landsat Collection 2](https://www.usgs.gov/landsat-missions/landsat-collection-2) | EarthExplorer/cloud; Cloud-Optimised GeoTIFF plus metadata | Archive since 1972; 1976 MSS nominally about 60–80 m; modern TM/OLI 30 m multispectral | Public domain, no fee; USGS acknowledgement requested ([policy](https://www.usgs.gov/faqs/are-landsat-data-cloud-still-considered-be-within-public-domain)) | A 1976 scar might be reconstructable but not as a precise legal/event perimeter. Scene availability, clouds, coarse pixels and uncertain dates require corroboration with reports/aerial photographs. |
| Context only | [StatsWales grassland, woodland and crop fires](https://stats.gov.wales/en-GB/9ab23d5a-7930-46ce-bb8d-faa4648a1097) | CSV, Excel or JSON; Wales/FRA aggregates | Monthly and annual, 2009–10 onward; latest provisional, annual revisions | Welsh Government public statistics terms/OGL; free | Provider explicitly says the category is not a measure of wildfires. No Blorenge perimeter; useful for trend/context only. |
| Essential request | SWFRS incident timeline, mapped extent, sector/operations records, photographs and post-incident findings | Partnership/data-sharing request; possibly EIR/FOI for non-operational records | Event-specific | Terms, redaction, public-release permission and cost to agree | Do not infer that incident command data can be published. Separate factual fire evidence from security-sensitive access, water, communications or tactics data. |
| Authoritative local record | Moderated BCA/member/public PWA evidence and surveyed perimeter | Offline capture then authenticated submission; GPS, photo/video, observation, polygon | Capture accuracy/time/device retained; repeated recovery observations | BCA contributor licence/consent; operational cost only | Raw submissions are evidence, not fact. Maintain originals, hashes, moderation history and conflicts; publish an approved derived perimeter with confidence and version history. |

There is no single identified authoritative open dataset that supplies both the 1976 and 2026 Blorenge perimeters. The blueprint should specify an evidence-synthesis workflow and allow multiple competing geometries until a moderator-approved version is established.

### 7. Soils, geology and agricultural capability

| Priority | Source and authority | Access, format and coverage | Currency / resolution | Licence and cost | Important constraint |
|---|---|---|---|---|---|
| Launch context | [Welsh Government Predictive Agricultural Land Classification Map 2](https://datamap.gov.wales/layers/inspire-wg%3Awg_predictive_alc2) | DataMapWales WMS/WFS/download | Model uses a 50 m soil-series raster; version 2 | Check current layer licence/attribution on acquisition; Welsh Government publication; likely free | Agricultural capability model, not a soil-health or post-fire condition survey. Use strategically, not for site-specific prescriptions. |
| Launch coarse | [BGS OpenGeoscience downloads](https://www.bgs.ac.uk/geological-data/opengeoscience/map-data-downloads/) | Downloads/INSPIRE feeds; geology, aquifer and 1 km soil-parent-material products | Dataset-specific; soil parent model 1 km | OGL with “Contains British Geological Survey materials © UKRI [year]”; free | Coarse contextual geology/parent material only. |
| Optional | [BGS Soil Parent Material Model 1:50,000](https://www.bgs.ac.uk/datasets/soil-parent-material-model/) | Licensed GIS polygons | 1:50,000; >30 attributes | £0.35/km² plus user, licence and preparation fees | Request public-web and derived-output rights explicitly. |
| Optional | Cranfield LandIS NATMAP/Soilscapes and soil attributes | Licensed data/search from Cranfield | NATMAP/Soilscapes 1:250,000 plus detailed attributes | Quote/licence; Cranfield describes one-year licences requiring deletion/renewal of source and derived data ([Mapshop FAQ](https://cranfield.blueskymapshop.com/about/faqs)) | Web viewing does not grant republication. A 2025–2030 Defra contract aims to open specified LandIS datasets, but do not assume availability before the portal and open licence actually apply ([contract notice](https://www.contractsfinder.service.gov.uk/Notice/5508fe8c-f890-457b-b6cc-4c832b7648a2)). |
| Essential evidence | BCA soil/peat condition, erosion, hydrophobicity and recovery surveys | Structured field protocol, samples/photos, lab reports | Survey/sample scale and date | BCA/commissioned rights | Professional/ecological interpretation may be needed; record method, sampler, lab and detection limits. Do not derive restoration prescriptions solely from national models. |

### 8. Weather, climate and fire weather

| Priority | Source and authority | Access, format and coverage | Currency / resolution | Licence and cost | Important constraint |
|---|---|---|---|---|---|
| Launch history | [Met Office HadUK-Grid](https://www.metoffice.gov.uk/research/climate/maps-and-data/data/haduk-grid/datasets) | CEDA/download; CF-NetCDF | 1 km grid; daily rainfall from 1891 and temperature from 1960; annual release; provisional subset about a week after month end | OGL; free; acknowledge source | Interpolated climate observations, not a Blorenge weather station. Excellent for baseline/trends and proposal evidence. |
| Optional live | [Met Office Weather DataHub observations](https://datahub.metoffice.gov.uk/pricing/observations) and atmospheric forecasts | API key; API/GRIB products | Product/model/station-specific | Observations free to 360 calls/day; 900/day £9/month. Atmospheric free 1 GB/month; 10 GB £15/month. VAT excluded. Requires “Powered by Met Office data” attribution ([FAQ](https://datahub.metoffice.gov.uk/support/faqs)) | Use server-side key management and cache within terms. Confirm nearest grid/station fitness and do not present model forecasts as observed mountain conditions. |
| Launch/optional | NRW rainfall-station API and EFFIS Fire Weather Index WMS | APIs/WMS | Station-specific; EFFIS forecast around 8 km | NRW/EFFIS terms; free within service terms | Good context for emergency-plan reference and recovery; neither replaces operational fire-service weather/behaviour assessment. |

### 9. Grazing, livestock and agriculture

| Priority | Source and authority | Access, format and coverage | Currency / resolution | Licence and cost | Important constraint |
|---|---|---|---|---|---|
| Context | [Welsh Survey of Agriculture and Horticulture](https://www.gov.wales/survey-agriculture-and-horticulture) | Published reports/tables | Annual, Wales and aggregate geographies | OGL/public statistics; free | The 2025 release states farm land-use data excludes common land and individual farms are confidential. It cannot supply Blorenge stocking or locations. |
| Controlled member input | Livestock count, type, grazing dates/areas, ownership/reference, concern and intervention | Offline PWA forms; private points/areas/time series | Member-observed/event-specific | BCA controller; member terms and UK GDPR controls | Detailed holdings and movement-like data remain private; publish only approved aggregates that cannot identify a member/farm. |
| Controlled legal source | Common-register rights section and member-supplied entitlement records | Authority copies/member upload | Live/as amended | Authority/member permission | Keep legal rights distinct from observed turn-out and counts. The website is not to administer legal entitlement. |
| Not available for reuse | RPW maps, land parcels and individual agricultural/livestock returns | Authenticated RPW service or data-sharing agreement only | Operational | Personal/confidential; no open reuse | Welsh Government says individual agricultural returns cannot be disclosed without written consent and outputs must be aggregate ([survey privacy notice](https://www.gov.wales/agriculture-and-horticulture-survey-privacy-notice-html)). Members may contribute their own records with consent; the platform must not scrape RPW. |

### 10. Imagery and historic photographs

| Priority | Source and authority | Access, format and coverage | Currency / resolution | Licence and cost | Important constraint |
|---|---|---|---|---|---|
| Launch | Sentinel-2 and Landsat, above | Raster/STAC/cloud APIs | 10–60 m current; 30–80 m historical | Open/free as above | Best low-cost repeat imagery and change evidence; retain processing lineage. |
| Request | [Welsh Government Aerial Photography Unit archive](https://datamap.gov.wales/maps/apu-welsh-government-aerial-photography/) | Central Register/map plus image request; Wales, 1940–present | Flight-specific, varied scales | Map metadata says licence not specified; reproduction/digital-copy cost and permission must be requested | Potentially valuable for 1976 corroboration and pre-fire baselines. An online index/view does not confer republication rights. |
| Defer | [OS MasterMap Imagery Layer](https://www.ordnancesurvey.co.uk/products/os-mastermap-imagery-layer) | Licensed download, ECW/JPEG/TIFF | 25 cm; product updated quarterly | Premium quote; fixed-term or perpetual terms | High detail, but public display, offline PWA use, derivative analysis and export need explicit licensed rights. Procure only for a defined gap. |
| Member evidence | Historic/current geotagged photographs, maps and documents | Upload, metadata form, optional georeferencing | Source-specific | Contributor selects/attests rights; moderation | Capture author/rightsholder, creation date, licence/permission, location confidence and whether public reproduction is allowed. Possession of a copy is not copyright permission. |

### 11. Infrastructure, hazards and administrative areas

| Priority | Source and authority | Access, format and coverage | Currency / resolution | Licence and cost | Important constraint |
|---|---|---|---|---|---|
| Launch | OS OpenMap – Local, Open Roads, Open Names and [Boundary-Line](https://www.ordnancesurvey.co.uk/products/open-data) | OS Data Hub download/API; raster/vector, common GIS formats | 1:10,000 context; product-specific, commonly six-monthly; administrative boundaries released on cycles | OGL; free; OS attribution | Good backdrop, settlements, approach roads and local authority/ward areas. Not a field-scale topographic/legal-boundary or emergency-access survey. |
| Launch | DataMapWales [Welsh administrative/statistical boundaries](https://datamap.gov.wales/maps/boundaries-information-wales/) | Download/WMS/WFS; vector | Dataset/operative-date specific | OGL; free | Keep boundary type and operative date; never mix statistical, electoral and service boundaries. |
| Launch/controlled | Gates, barriers, tracks, turning areas, bridges, water points, buildings, power/telecom hazards and rendezvous points | BCA survey plus validated partner contributions | Feature-specific | BCA/partner terms; sensitive operational annex | The most useful fire-team infrastructure is local and changeable. Require last-verified date, access/surface/load limitations, owner/contact, seasonal constraints and visibility classification. |
| Reference/request | [Welsh disused coal-tip map](https://datamap.gov.wales/maps/7548) | DataMapWales viewer | Boundaries/categories; updated twice yearly; Oct 2025 edition | **Personal use only**, varied/derived licence; not open | Do not embed, copy or use for research/decision products without permission. Seek a Welsh Government/Mining Remediation Authority licence if relevant. |
| Optional | Mining Remediation Authority coal-mining data | Free viewer/WMS for selected information; licensed GIS and historical searches | Dataset-specific, continuously updated holdings | Viewer/WMS free; data licence/royalty or search charges. Current examples include £92.67/hour detailed plan search and £96.52 catalogue search ([records and fees](https://www.gov.uk/guidance/coal-mining-records-data-deeds-and-documents)) | Non-commercial licence forbids making data available to third parties. Obtain a licence designed for the intended interactive/derived public product ([licensing guidance](https://www.gov.uk/government/publications/apply-to-license-coal-mining-data)). |
| Controlled partner | SWFRS, Dŵr Cymru and network-operator operational data such as hydrants, tanks, valves, asset constraints, locked gates and contacts | Invitation/data-sharing agreement; likely GIS/PDF/operational documents | Partner-defined | Permissioned; likely no licence fee but governance/security overhead | Default private operational annex. Public or emergency-release visibility must be agreed field-by-field; do not equate emergency usefulness with open publication. |

Community sources such as OpenStreetMap can improve discovery and field verification, but should be labelled community-maintained and must not displace an available legal/statutory source. If used, its ODbL attribution and share-alike implications require a separate design review.

## Phase 1 acquisition plan

1. **Create the source registry and publication gate first.** No layer reaches the public catalogue unless its current licence, attribution, sensitivity, export rights and provenance fields pass review.
2. **Ingest the zero-cost authoritative core:** SSSI, National Park, access layers, NRW management units, Phase 1 habitat, LANDMAP, LiDAR DTM/DSM, main rivers, FRAW surface-water risk, WFD Cycle 3, OS OpenMap/Open Roads/Open Rivers/Boundary-Line, HadUK-Grid, Sentinel-2 and relevant EFFIS products.
3. **Request the legal local records:** the complete Blorenge Commons Register entries/maps and definitive rights-of-way export/statements, with written website and export permissions.
4. **Open a SWFRS evidence request:** seek the incident timeline, fire perimeter/source, photographs and shareable post-incident material. Agree which operational details remain in the protected emergency annex.
5. **Build a provisional 2026 fire package:** preserve pre/post Sentinel scenes, EFFIS snapshots and method; compare them with field evidence; publish confidence and version, not a falsely exact boundary.
6. **Investigate 1976:** search Landsat MSS availability, the Welsh aerial-photo catalogue, fire-service/local archives and member records. Treat the result as reconstructed historical evidence.
7. **Ask SEWBReC for a scoped quote/data-exchange agreement** covering Blorenge species, habitats and local sites, including funded-proposal use, public aggregation, retention and updates.
8. **Defer premium sources until a documented gap remains.** In likely order: detailed soil information, OS high-resolution imagery/paths, mining data and title records. Avoid the £20,000/year HMLR National Polygon Service.
9. **Commission or standardise field surveys** for current habitat, soil/peat, drainage, erosion, grazing pressure, infrastructure and repeat photographic monitoring. These observations are the recovery dataset, while national layers are context.

## Cost posture

The launch data stack can have **£0 recurring licence cost** if it uses the listed OGL/open government and Copernicus/USGS sources within their terms. Expected marginal costs are compute/storage, staff/volunteer validation and requests rather than licences.

Budget separately for:

- SEWBReC: published charity/non-commercial request rates from £32.50–£40 + VAT, with polygon/custom work quoted;
- Met Office live data only if free quotas are insufficient: from £9/month for 900 observation calls/day or £15/month for 10 GB atmospheric data, plus VAT;
- targeted Land Registry documents: £7 per online register or plan;
- BGS 1:50,000 Soil Parent Material: £0.35/km² plus licence, users and preparation;
- OS premium paths, terrain or imagery, Cranfield soils, mining data and aerial-photo reproduction: quote/contract;
- ecological/soil/hydrological professional surveys where decisions require current expert evidence.

No licensed dataset should be bought until the supplier confirms all of: BCA legal identity, public interactive display, private collaborator access, offline PWA caching, analytical derivatives, PDF/application-pack reproduction, open-format export (if required), retention after termination and emergency release. A cheap viewing licence can be unusable for this platform.

## Decisions this research enables

- Use **DataMapWales + OS OpenData + Copernicus/USGS** as the zero-cost baseline and maintain reproducible local snapshots.
- Treat the **local Commons Register, definitive PRoW record and SWFRS 2026 record as acquisition work**, not assumptions embedded in an open layer.
- Model the 2026 perimeter as a **versioned evidence synthesis** with source-specific confidence; do the same for any reconstructed 1976 extent.
- Treat Phase 1 habitat, LANDMAP, national soils and climate as **context**, while current recovery condition comes from moderated BCA/partner surveys.
- Keep detailed grazing, species, ownership and operational infrastructure in **controlled layers**; publish only approved, licensed and appropriately aggregated derivatives.
- Build licensing/provenance into the data model and publication workflow rather than maintaining a prose spreadsheet after implementation.

## Decisions still needed

This inventory exposes implementation decisions for later Wayfinder tickets:

- exact initial area of interest and buffer used for ingestion, search and partner requests;
- the canonical geometry/data model, CRS strategy, spatial database and tile/offline packaging architecture;
- source-refresh and change-review policy for each launch dataset;
- standard observation schemas and field protocols for fire, habitat, drainage, grazing, soil and infrastructure;
- confidence/versioning method for competing evidence and derived boundaries;
- public aggregation and sensitivity rules for species, livestock, ownership and emergency-plan data;
- whether external collaborators need direct controlled access or document-based exchange initially;
- which premium data gaps, if any, remain after the open baseline and first field season.
