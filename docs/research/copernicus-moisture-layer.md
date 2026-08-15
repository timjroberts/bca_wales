# Copernicus moisture layer for the Blorenge explorer

Checked 15 August 2026.

## Decision

**Defer a Copernicus soil-moisture layer from the second data release.** The
only product that is both a plausible match for the requested name and fine
enough to show more than one regional value is the Copernicus Land Monitoring
Service (CLMS) **Soil Water Index (SWI), Europe, 1 km, daily**. It would add a
genuinely different observation to the separate NDMI-change layer: SWI is a
radar-derived, temporally filtered estimate of relative soil-profile wetness,
whereas NDMI is an optical NIR/SWIR ratio primarily sensitive to vegetation
water content. They must not be presented as two versions of the same measure.
[CLMS SWI product user manual, pp. 13–16](https://land.copernicus.eu/en/technical-library/product-user-manual-soil-water-index/@@download/file)
[CDSE Sentinel-2 NDMI description](https://custom-scripts.sentinel-hub.com/custom-scripts/sentinel-2/ndmi/)

The reason to defer is unusually concrete. SWI 1 km version 2 began on 13 July
2025; CLMS says versions 1 and 2 are not fully consistent, no v2-compatible
historical reprocessing exists, six months was too short for robust statistical
validation, and a fully reprocessed version 3 archive is planned for autumn
2026. CLMS therefore suspended the normal statistical assessment for the 2025
cycle and described a pre-v3 interim validation as being of limited scientific
value. Publishing v2 now would either offer a dated snapshot with no defensible
local baseline or create a layer contract expected to change almost
immediately. [CLMS 2025 SWI 1 km quality assessment, pp. 34–35](https://land.copernicus.eu/en/technical-library/quality-assessment-report-update-2023-soil-water-index-version-1/@@download/file)

This is a deferral, not a rejection. Reconsider the layer after SWI 1 km v3 and
its reprocessed history and validation documentation are actually published,
then run the local acceptance checks below. Do not substitute the current CLMS
Surface Soil Moisture product or the 0.25° Copernicus Climate Change Service
record merely to meet the release date.

## What “moisture” means here

### NDMI already planned for the explorer

The existing NDMI change is calculated from Sentinel-2 optical reflectance:
`(NIR - SWIR) / (NIR + SWIR)`. CDSE describes the NIR/SWIR combination as
responding to water in vegetation leaves, with SWIR also affected by canopy
structure. Sentinel-2 provides the relevant B08 NIR band at 10 m and B11 SWIR
band at 20 m; the explorer's recipe uses a 20 m NDMI product after observation
quality masking. NDMI is therefore a **spectral canopy/surface proxy**, not a
direct soil-water measurement. [CDSE NDMI description and formula](https://custom-scripts.sentinel-hub.com/custom-scripts/sentinel-2/ndmi/)
[CDSE Sentinel-2 L2A band specifications](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html)
[BCA source registry](../../data/launch/source-registry.json)

### CLMS Soil Water Index

SWI 1 km combines relative surface-soil-moisture estimates from Sentinel-1
C-band SAR with Metop ASCAT scatterometer estimates. It applies a two-layer
water-balance/infiltration model in which earlier surface observations receive
exponentially declining weights. The eight `T` values (2, 5, 10, 15, 20, 40,
60 and 100 days) express the response timescale of that filter. A larger `T`
generally represents a more slowly varying/deeper profile, but it is **not a
fixed physical depth**: the manual states that the same `T` can represent
different depths in different soils. [CLMS SWI product user manual, pp. 13–15](https://land.copernicus.eu/en/technical-library/product-user-manual-soil-water-index/@@download/file)

Values are encoded as 0–100 percent relative wetness with a 0.5 scale factor,
not as volumetric water content in cubic metres per cubic metre. Each `T` band
has a corresponding quality band. Water, low-sensitivity, extreme-slope,
low-quality and out-of-range cells are flags, not valid wetness values. The
product is daily, on a regular WGS84 grid with spacing `1/112°` (about 1 km
north–south and about 0.62 km east–west at the Blorenge latitude), and covers
continental Europe. [CLMS SWI product user manual, pp. 19–26](https://land.copernicus.eu/en/technical-library/product-user-manual-soil-water-index/@@download/file)
[CDSE SWI v2 bands and collection](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/clms/bio-geophysical-parameters/soil-moisture/soil-water-index/swi_europe_1km_daily_v2.html)

That makes SWI complementary to NDMI, but also much coarser. The current
SSSI-plus-2-km discovery box is only 0.1085° by 0.0845°, approximately 12 by 10
native SWI grid spacings before clipping to the irregular area. A larger
Blorenge core will increase the count, but the result will still show broad
kilometre-scale patterns. It cannot resolve paths, small habitats, fire edges or
individual drainage features and must not be upsampled in a way that implies
otherwise. [BCA source registry: current AOI discovery bounds](../../data/launch/source-registry.json)

## Candidate assessment

| Candidate | Quantity, lineage and units | Resolution, history and status | Access and rights | Fit for this explorer | Decision |
| --- | --- | --- | --- | --- | --- |
| **CLMS Soil Water Index, Europe 1 km daily v2** | Modelled relative profile wetness from fused Sentinel-1 C-SAR and Metop ASCAT surface-moisture observations; eight response timescales, each 0–100%, plus `QFLAG` and surface-state information. The `T` values are not fixed depths. [PUM, pp. 13–25](https://land.copernicus.eu/en/technical-library/product-user-manual-soil-water-index/@@download/file) | Daily, `1/112°`, Europe. The current dataset page identifies v2 as 13 July 2025–present with delivery within two days. The live CDSE catalogue on 15 August 2026 contained corrected v2.1.1 COG and NetCDF products through nominal date 14 August 2026. V2.1.1 corrected the v2 archive's earlier spatial-shift fault; the archive from 14 July 2025 was republished in February 2026. [dataset](https://land.copernicus.eu/en/products/soil-moisture/daily-soil-water-index-europe-1km-v2) [correction notice](https://land.copernicus.eu/en/production-updates/fix-of-spatial-shift-in-soil-water-index-1-km-v2-product) | Searchable through the anonymous CDSE OData catalogue; product download, EODATA S3 and Sentinel Hub BYOC processing require a CDSE account/token. CDSE publishes BYOC collection `4bd995a1-dc49-4176-a285-b1d0084ba51a`. CLMS permits free use and derivatives, but requires source disclosure, a modification statement and no suggestion of EU endorsement. [OData](https://documentation.dataspace.copernicus.eu/APIs/OData.html) [BYOC](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/clms/bio-geophysical-parameters/soil-moisture/soil-water-index/swi_europe_1km_daily_v2.html) [policy](https://land.copernicus.eu/en/data-policy) | Semantically the best candidate and compatible with COG/PMTiles, but coarse; slope/sensitivity masks may remove important upland cells; v2 is short and not compatible with v1; v3 is imminent. | **Defer** until the v3 reprocessed archive and validation exist and the Blorenge QA gates pass. |
| **CLMS Surface Soil Moisture, Europe 1 km daily v1** | Sentinel-1 C-SAR backscatter retrieval of relative water content in the top few centimetres, 0–100% saturation, with `SSM_NOISE`; it is an observation/retrieval rather than a profile index. [CDSE SSM description and bands](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/clms/bio-geophysical-parameters/soil-moisture/surface-soil-moisture/ssm_europe_1km_daily_v1.html) | Daily containers at `1/112°`, Europe, 2014–present. Individual locations historically received observations every 1.5–4 days after October 2016. Validation found relatively strong spatial patterns but poor-to-medium temporal agreement and missed short events. Retrieval is best under low/moderate vegetation, unfrozen/snow-free ground and low/moderate topographic variation. [dataset](https://land.copernicus.eu/en/products/soil-moisture/daily-surface-soil-moisture-v1.0) [PUM](https://land.copernicus.eu/en/technical-library/product-user-manual-surface-soil-moisture-version-1/@@download/file) [2025 validation](https://land.copernicus.eu/en/technical-library/validation-report-update-2025-surface-soil-moisture-version-1/@@download/file) | CDSE BYOC collection `df9e9783-f580-433a-b798-3acd2760b94e`, OData/S3 and the same CLMS reuse policy. [CDSE SSM access](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/clms/bio-geophysical-parameters/soil-moisture/surface-soil-moisture/ssm_europe_1km_daily_v1.html) [policy](https://land.copernicus.eu/en/data-policy) | Longer and physically easier to describe, but it is not the requested named index, is noisier in time, and its suitability assumptions are a poor match for a steep, heterogeneous upland. It would also compete with rather than strengthen the better SWI concept. | **Reject as a substitute** for release 2. It may remain a provenance/input option in a later SWI evaluation. |
| **C3S satellite surface/root-zone soil moisture** | Multi-sensor active/passive satellite climate data record. Surface moisture is available in percent saturation or volumetric units; modelled root-zone moisture is provided for 0–10, 10–40, 40–100 and 0–100 cm, with uncertainty variables. [C3S dataset](https://cds.climate.copernicus.eu/datasets/satellite-soil-moisture?tab=overview) | Global `0.25°` grid; daily, 10-daily and monthly; surface record from November 1978 and root-zone record from January 1980; the interim record updates every ten days with ten-day latency. Spatial/temporal gaps are expected. [C3S dataset](https://cds.climate.copernicus.eu/datasets/satellite-soil-moisture?tab=overview) | CDS API, NetCDF4, DOI `10.24381/cds.d7782f18`, CC BY. [C3S dataset](https://cds.climate.copernicus.eu/datasets/satellite-soil-moisture?tab=overview) | Excellent climate context, but a 0.25° cell is roughly 17 by 28 km at this latitude—larger than the explorer area. It cannot support a meaningful local map layer even though its long record supports regional time-series context. | **Reject as a map layer**; optionally cite it in future regional climate narrative outside this release. |

ERA5/ERA5-Land monthly soil-moisture indicators do not improve the local map
case: their 0.25°/0.1° grids are also too coarse, and they are reanalysis/model
fields rather than the named Copernicus land-monitoring index. [C3S essential
climate variables dataset](https://cds.climate.copernicus.eu/datasets/ecv-for-climate-change?tab=overview)

## Why v2 should not be stretched into a change layer

The live archive exposes both v1 (2015 to 12 July 2025) and v2 (13 July 2025
onwards), but the product manual says major versions should not be mixed unless
explicitly allowed. It further warns that changes to the H SAF input—long-term
trend correction and enhanced vegetation correction—make v2 inconsistent with
earlier SWI versions. [CLMS SWI product user manual, pp. 17–19](https://land.copernicus.eu/en/technical-library/product-user-manual-soil-water-index/@@download/file)

The official 2025 quality report is stronger still: it says the split record
precludes a meaningful standard statistical analysis, no v2-compatible
historical reprocessing existed, and the six-month v2 record could not represent
full seasonal dynamics. It also records that only four near-surface and two
subsurface stations from the Wales Soil Moisture Network were available, with
data ending in 2016; that is not local validation of v2 around the Blorenge.
[CLMS 2025 SWI quality assessment, pp. 28–35](https://land.copernicus.eu/en/technical-library/quality-assessment-report-update-2023-soil-water-index-version-1/@@download/file)

It would be possible to compare two dates wholly within v2, but the difference
would mostly express weather and the chosen filter memory. It would not by
itself show habitat recovery, fire effects or a persistent hydrological change.
For release 2, such a visually strong but weakly interpretable layer would add
more confusion than evidence.

## Current acquisition facts (for audit and later implementation)

The anonymous catalogue query is reproducible with the documented CLMS
`datasetIdentifier` attribute:

```text
GET https://catalogue.dataspace.copernicus.eu/odata/v1/Products
  ?$filter=Attributes/OData.CSC.StringAttribute/any(
      att:att/Name eq 'datasetIdentifier' and
      att/OData.CSC.StringAttribute/Value eq 'swi_europe_1km_daily_v2')
  &$orderby=ContentDate/Start desc
  &$select=Id,Name,S3Path,ContentDate,PublicationDate,ContentLength,Checksum
```

On 15 August 2026 it returned this latest COG:

```text
Id: 4d0cb30b-20f2-4df5-8d1e-4e8ff27a1c06
Name: c_gls_SWI1km_202608141200_CEURO_SCATSAR_V2.1.1_cog
Content: 2026-08-13T12:00:01Z / 2026-08-14T12:00:00Z
Published: 2026-08-15T16:27:53.621582Z
S3Path: /eodata/CLMS/bio-geophysical/soil_water_index/
        swi_europe_1km_daily_v2/2026/08/14/
        c_gls_SWI1km_202608141200_CEURO_SCATSAR_V2.1.1_cog
Size: 80,622,881 bytes
MD5: 337687572b7c8c0e931e9ff09511aa55
BLAKE3: bca229e66e5bea6ea31a74cfa91756ec29d673b5f7f24d535c313e2ad878ef01
```

The same query ordered ascending showed the first v2 product at nominal date
13 July 2025. Catalogue discovery is anonymous; an attempted one-byte range
download from the official OData download endpoint returned `401 Unauthorized`,
consistent with CDSE's documented token-based download flow. The catalogue also
publishes paired NetCDF and COG objects. [CDSE OData documentation](https://documentation.dataspace.copernicus.eu/APIs/OData.html)
[CLMS v2 product page](https://land.copernicus.eu/en/products/soil-moisture/daily-soil-water-index-europe-1km-v2)

This is operationally compatible with the explorer. A release job can retain
the exact provider COG/NetCDF and catalogue JSON privately, decode and clip the
continuous/index and quality bands into a versioned COG, then render a fixed
colour scale to raster PMTiles. A single continental v2 COG is about 81 MB at
present, but an aggregate using many daily files multiplies acquisition and QA
cost; publication remains cheap because only the clipped immutable result is
served.

## Acceptance gate after SWI 1 km v3 is released

Reopen the decision only when all of the following are true:

1. CLMS has published the v3 Europe 1 km product, a reprocessed historical
   archive, product manual, validation report, DOI, exact OData dataset
   identifier and confirmed derivative-use wording. A roadmap date is not
   enough. CLMS currently schedules v3 and its full reprocessing for Q4/autumn
   2026. [CLMS soil-moisture roadmap](https://land.copernicus.eu/en/products/soil-moisture?tab=roadmap)
2. AOI extraction over the final Blorenge core plus 2 km shows enough valid
   native cells. Record counts and area for every water, sensitivity, slope,
   frozen/snow, low-quality and no-data state; reject if the central upland is
   predominantly masked or if fewer than three native cells span the core in
   either direction.
3. Compare `SWI010` provisionally (a moderate response timescale) with
   `SWI002` and `SWI020`, but choose one public band only after checking local
   coverage, stability and interpretability. Label it by response timescale,
   never as an exact soil depth. Preserve its matching `QFLAG` and surface-state
   flags. Do not resample before quality masking.
4. Define a dated, immutable release statistic rather than a silently stale
   “current” layer. The preferred contract is a same-season percentile/anomaly
   from the homogeneous v3 history; if that cannot be validated, publish no
   layer rather than an absolute percentage that users may mistake for
   volumetric soil water.
5. Publish at native information content: nearest-neighbour or area-preserving
   display only, no smoothing that invents local detail. Provide a private
   multiband COG (value, quality, state and valid mask), public raster PMTiles,
   and source catalogue JSON/checksums in the release manifest.

## Future public contract if the gate passes

Use the title **“Soil wetness (Copernicus SWI)”**, not “Moisture Index.” The
description should say that it is a kilometre-scale radar-derived model of
relative soil-profile wetness for a stated response timescale and period; it is
not NDMI, a field measurement, volumetric water content, habitat condition,
fire impact or proof of recovery.

The non-map companion must report the source/version and observation window,
selected `T`, valid native-cell count and valid AOI percentage, AOI median and
interquartile range, the number/area of each excluded quality state, and (only
if a homogeneous baseline exists) the baseline years and same-season percentile
or anomaly. A downloadable CSV should contain one row per retained native cell
with cell centre, value, quality, state and intersection area. This lets a
screen-reader user obtain the same principal comparison without interpreting
colour or map position.

Use the CLMS derivative attribution:

> Generated using European Union's Copernicus Land Monitoring Service
> information; [insert the v3 DOI and access point]. Adapted and clipped by
> Blorenge Commoners Association. The European Union does not endorse this
> interpretation.

That follows CLMS's requirement to identify the source, state modifications and
avoid implying EU endorsement; CLMS says the creator owns the resulting
derivative. [CLMS data policy](https://land.copernicus.eu/en/data-policy)

## Resolution in one line

Keep NDMI change as the 20 m canopy/surface moisture-sensitive layer in release
2; **defer** the distinct kilometre-scale Copernicus Soil Water Index until the
fully reprocessed and validated SWI 1 km v3 archive is real and passes local
Blorenge mask/coverage QA; reject SSM v1 and 0.25° C3S soil moisture as release-2
substitutes.
