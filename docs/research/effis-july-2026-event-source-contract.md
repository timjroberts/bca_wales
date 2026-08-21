# EFFIS July 2026 event source contract

Research date: 21 August 2026.

## Decision

Release two may retain the EFFIS July 2026 boundary, but its canonical provider evidence must be the complete, checksum-pinned release-one WFS snapshot containing feature `592404`. It must be described as a **historic EFFIS provider snapshot**, not as a newly reacquired current feature and not as an authority, legal or surveyed perimeter.

Current feature `627416` is compelling corroboration that EFFIS re-keyed and reclassified the same mapped geometry: its geometry is exactly equal to `592404`, and every stable event and land-cover field is equal. EFFIS does not, however, publish an ID-history or successor crosswalk. The release may therefore record `627416` as a **BCA-inferred current continuation**, with both source identities and snapshots preserved, but must not call it an authoritative successor or silently replace the historic identity.

Feature `627417` is a different August event and must not be used for the July layer.

## Why there is no authoritative public archive or successor identity

EFFIS describes its downloadable Burnt Areas database as “real-time updated”. For historic data, fire-database extracts, or raw burned-area perimeters that are not available through its web services, EFFIS directs users to its official Data Request Form. No public archive, version history, or old-to-new feature-ID mapping is documented in the EFFIS services inspected for this research. An EFFIS response to a future data request could add provider-declared lineage, but the live WFS cannot supply that claim now ([EFFIS Data and services](https://forest-fire.emergency.copernicus.eu/applications/data-and-services)).

The bounded `ms:modis.ba.poly` WFS response acquired on 13 August contained `592404`. The response acquired on 21 August omitted `592404` and contained `627416` and `627417`. Because this is a mutable current-season service, absence from the newer response is evidence of provider disappearance from the live collection, not proof that the former record was invalid.

## Record comparison

The comparison uses the complete provider responses before display clipping.

| Provider field | Historic `592404` | Current `627416` | Current `627417` |
| --- | --- | --- | --- |
| `FIREDATE` | `2026-07-20 01:05:00` | same | `2026-08-13 00:00:00` |
| `FINALDATE` | `2026-07-29 02:34:00` | same | `2026-08-14 00:00:00` |
| `LASTUPDATE` | `2026-08-03 09:11:56.420451` | `2026-08-14 13:30:25.331127` | `2026-08-14 13:31:02.422936` |
| `COUNTRY` | `UK` | same | `UK` |
| `PROVINCE` | `Gwent Valleys` | same | `Gwent Valleys` |
| `COMMUNE` | `Torfaen` | same | `Torfaen` |
| `AREA_HA` | `156` | same | `13` |
| `BROADLEA` | `0` | same | `0` |
| `CONIFER` | `2.580645161288658` | same | `91.66666666590277` |
| `MIXED` | `0` | same | `0` |
| `SCLEROPH` | `0` | same | `0` |
| `TRANSIT` | `0` | same | `0` |
| `OTHERNATLC` | `97.41935483864683` | same | `8.333333333263889` |
| `AGRIAREAS` | `0` | same | `0` |
| `ARTIFSURF` | `0` | same | `0` |
| `OTHERLC` | `0` | same | `0` |
| `PERCNA2K` | `0` | same | `0` |
| `CLASS` | `30DAYS` | `FireSeason` | `30DAYS` |
| Geometry | `Polygon` | exactly equal coordinate-for-coordinate | different, much smaller polygon |

Only `id`, `LASTUPDATE`, and the rolling-window `CLASS` differ between `592404` and `627416`. Their complete geometry JSON is exactly equal. This is strong evidence of a re-keyed publication of the same EFFIS interpretation, but the “continuation” conclusion is explicitly a BCA inference from the two first-party responses, not an EFFIS-declared relationship.

## Pinned provenance

### Historic canonical evidence

- Provider: European Commission Joint Research Centre, European Forest Fire Information System (EFFIS).
- Dataset/layer: WFS `ms:modis.ba.poly`, MODIS/Sentinel-2 Burnt Areas.
- Retrieval URL: `https://maps.effis.emergency.copernicus.eu/effis?service=WFS&version=1.1.0&request=getfeature&typename=ms%3Amodis.ba.poly&outputformat=geojson&srsName=EPSG%3A4326&bbox=51.74,-3.06,51.77,-3.02,EPSG%3A4326`
- Retrieved: `2026-08-13T18:20:27.597Z`, HTTP 200, `application/json; subtype=geojson`.
- Complete bounded provider response: 14,526 bytes, SHA-256 `651b441769bd485c5f45e48fefb777084c08b059be4eee61c9ecf122e03c3e6a`.
- Provider identity selected from that complete response: `592404`.
- Release-one derived single-feature public output: SHA-256 `2ab453216cb173b402df6a94cc63e790e73a91ed2f516a11a9c4d82d5d0e2cb8`.

### Current corroborating evidence

- Retrieval URL: `https://maps.effis.emergency.copernicus.eu/effis?service=WFS&version=1.1.0&request=getfeature&typename=ms%3Amodis.ba.poly&outputformat=geojson&srsName=EPSG%3A4326&bbox=51.680022769546724,-3.1141917079035677,51.83740107116975,-2.9576185245017776,EPSG%3A4326`
- Retrieved: `2026-08-21T21:32:07.885Z`, HTTP 200, `application/json; subtype=geojson`.
- Complete bounded provider response: 21,600 bytes, SHA-256 `ad5e648111a6e8803e9f159463d65ecda66976783868f1b798c45d3d0f854778`.
- Relevant identities: `627416` (BCA-inferred continuation of the July geometry) and `627417` (excluded August event); `592404` is absent.

These checksums identify complete WFS responses, not just clipped display features. The complete snapshots must remain in acquisition lineage even when public display geometry is clipped to the release AOI.

## Release-two retrieval and publication contract

1. Treat the historic response with SHA-256 `651b...e6a` as the canonical provider snapshot for the retained layer. Fail closed if that complete local input is missing or its checksum differs.
2. Select historic feature `592404`, preserve every provider field listed above, and clip only a copy of its geometry for public display. Do not rewrite provider dates or fields.
3. Record the source state explicitly: `historic_provider_feature_id=592404`, acquisition time and URL, complete-response checksum, and `current_service_status=not_returned_on_2026-08-21`.
4. Preserve the 21 August complete response with SHA-256 `ad5e...778` as corroborating provenance. Record `627416` only as `identity_relationship=BCA-inferred-rekey`, based on exact geometry and stable-field equality. Do not use `627417`.
5. Do not claim that release two freshly reacquired feature `592404`, that EFFIS declared `627416` its successor, or that either record is an incident-authority perimeter.
6. If a later live acquisition changes or removes `627416`, that does not silently rewrite the retained historic layer. Preserve the new response separately and require a new review before changing identity or geometry.
7. A future EFFIS data-request response may supersede only the lineage statement, not the preserved historic evidence: archive material or an explicit provider crosswalk must itself be snapshotted, dated and checksum-pinned.

## Licence, attribution and limits

EFFIS states that EU-owned website content is licensed under CC BY 4.0 unless otherwise indicated. Reuse is allowed with appropriate credit and an indication of changes; third-party rights still require separate clearance where present ([EFFIS Data License](https://forest-fire.emergency.copernicus.eu/about-effis/data-license)). For this provider layer the release should retain the attribution `European Union, Copernicus EFFIS` and state that BCA clipped and reformatted the display copy.

EFFIS describes the Rapid Damage Assessment perimeter as a semi-automatic, visually checked MODIS/Sentinel-2 product. It does not distinguish wildland fire from environmental or prescribed burning, may omit small burned or unburned patches, and its dates need not be ignition or extinction dates. EFFIS also cautions against comparison with products made for other scopes or by other methods ([EFFIS Rapid Damage Assessment](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/rapid-damage-assessment)). These first-party limits require the existing **EFFIS provisional provider boundary** label and prohibit presenting the layer as authority, surveyed perimeter, confirmed incident extent, or validation of the BCA change analysis.

## Conclusion

An EFFIS layer can pass the release-two contract, but only as preserved historic provider evidence. The live service supplies strong current corroboration through `627416`, not an authoritative successor assertion. The complete release-one snapshot, its exact provider fields, acquisition metadata and checksum are therefore the durable contract; provider disappearance and BCA-inferred continuity must be disclosed.
