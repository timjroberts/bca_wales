# Blorenge Common CL18: authoritative boundary and re-use

**Research date:** 9 August 2026
**Decision status:** Publication gate closed pending an authoritative geometry and explicit re-use permission

## Decision summary

Torfaen County Borough Council is the registration authority and custodian of the legally binding common-land register for Blorenge Common CL18. No maintained, register-linked CL18 geometry with explicit re-use terms was found as a direct online download from Torfaen or another authoritative custodian.

Torfaen's migration to HM Land Registry's national Local Land Charges Register does not change that conclusion. The Local Land Charges Register records charges and restrictions affecting property; it is not the Common Land Register whose land section and register map define CL18. HM Land Registry can reveal local land charges intersecting a searched area, but it is not the route to the maintained CL18 register map.

The Welsh Government's openly licensed `geonode:wom_commons` layer is **not a substitute**. It was created for the Woodland Opportunity Map, warns that it may not be current, aggregates urban commons rather than identifying CL18, and contains no common name or register number. Its geometry must not be spatially selected and presented as the CL18 boundary.

The defensible next step is a combined access and re-use request to Torfaen. Until Torfaen supplies the boundary and resolves the rights described below, the launch core should be SSSI-only and clearly labelled; it should not depict or imply a definitive Blorenge Common boundary.

## Authoritative identity and custody

The Welsh Government's 8 December 2014 decision on works at Blorenge Common identifies the land as **Blorenge Common, register unit CL18**, names Torfaen County Borough Council as registration authority, and describes the common as approximately 2,017 hectares ([decision report](https://www.gov.wales/sites/default/files/publications/2018-01/common-land-blorenge-common-report.pdf); [landing page](https://www.gov.wales/works-common-land-blorenge-common)). This establishes identity and an approximate historical extent, but it is not a maintained GIS dataset and supplies no geometry, CRS, version, checksum, or re-use licence.

Torfaen states that it holds the common-land register and that the register is legally binding in respect of grazing rights ([Uplands and Peatbogs](https://www.torfaen.gov.uk/en/Climate-Change/NatureAndConservation/Nature-Networks/Uplands-and-Peatbogs/Uplands-and-Peatbogs.aspx)). Welsh Government guidance explains that the 22 Welsh local authorities hold the registers created under the Commons Registration Act 1965 and maintain them for public inspection ([Law Wales](https://law.gov.wales/environment/countryside-and-access/common-land)). Torfaen's own public-registers schedule lists Common Land under Local Land Charges and gives the inspection contact ([Public Registers](https://www.torfaen.gov.uk/en/Related-Documents/Local-Land-Charges/Local-Land-Charges-Public-Registers.pdf)).

These sources make Torfaen the correct first custodian to approach. They do not, by themselves, grant permission to reproduce or adapt an extract.

## Direct online availability

No authoritative, maintained CL18 boundary was found as a direct online download.

- Torfaen's legacy public GIS exposes an anonymous public mapping catalogue, but its public maps, layers, projects, and feature-table catalogues do not expose a Common Land or Blorenge register layer. This is evidence only about what is publicly exposed, not what Torfaen holds internally.
- Torfaen's Green Infrastructure Assessment describes an internal GIS `Common Land` layer and says Ordnance Survey MasterMap was used as base mapping ([Green Infrastructure Assessment, December 2021](https://www.torfaen.gov.uk/en/Related-Documents/Forward-Planning/Supplementary-Planning-Guidance/Torfaen-Green-Infrastructure-Assessment-December-2021.pdf)). It does not publish a layer identifier, CL18 feature identifier, currency date, CRS, export, or licence.
- Torfaen's current planning-policy page links to its most up-to-date interactive planning map and cautions that data should be ground-checked ([Supplementary Planning Guidance](https://www.torfaen.gov.uk/en/planning-and-building/planning-policy/supplementary-planning-guidance)). The map's public configuration uses EPSG:27700, but it does not expose a common-land layer. Its CRS therefore cannot be attributed to an unavailable CL18 dataset.
- Torfaen's Open Data page applies Open Government Licence language to “data on this page”; no CL18 or common-register dataset is listed there ([Open Data](https://www.torfaen.gov.uk/en/AboutTheCouncil/DataProtectionFreedomofInformation/Open-Data/)). It is not a council-wide licence.

Torfaen's fee schedule effective 1 April 2026 lists “Common Registration Extracts” as free, while the CON29O common-registration enquiry is chargeable ([Local Land Charges fees](https://www.torfaen.gov.uk/en/Related-Documents/Local-Land-Charges/Local-Land-Charges-List-of-Fees.pdf)). Free access or an extract is not the same as permission to adapt and republish it.

## HM Land Registry migration does not transfer the Common Land Register

Torfaen's current Local Land Charges page says that its Local Land Charges search service moved to HM Land Registry, while Torfaen continues to answer CON29 and optional CON29O enquiries. The same page distinguishes an LLC1 search for binding restrictions from the CON29O question that searches the **Common Land Register** ([Torfaen Local Land Charges](https://www.torfaen.gov.uk/en/Business/LandandPremises/Locallandchargessearch/Local-Land-Charges.aspx)). Torfaen's current CON29O schedule assigns question 22 about registered common land, the relevant register, and access to it to Torfaen's Local Land Charges team ([CON29 and CON29O Environmental Information](https://www.torfaen.gov.uk/en/Related-Documents/Local-Land-Charges/CON29-and-CON29O-Environmental-Information.pdf)). HM Land Registry's current programme list records Torfaen's transfer on 10 May 2023 and says that, after transfer, local authorities continue to supply source documents and answer additional enquiries ([Local Land Charges Programme](https://www.gov.uk/government/publications/hm-land-registry-local-land-charges-programme/local-land-charges-programme)).

The registers have different purposes and custodial routes:

- HM Land Registry's Local Land Charges service searches financial charges or governmental restrictions affecting land. Its official-search result can show the search area and the boundary of each **local land charge**, plus the originating authority and reference ([search terms](https://search-local-land-charges.service.gov.uk/terms-and-conditions); [practice guide 79](https://www.gov.uk/government/publications/local-land-charges-pg79/local-land-charges)). It does not certify that a returned charge boundary is the boundary of a common-land register unit.
- Official commons guidance says each common's register unit has a land section that describes the registered land and refers to the register map, which is part of the register. Commons registration authorities hold these registers and provide inspection and copies ([Commons registers guidance](https://www.gov.uk/guidance/commons-registers-how-to-apply-to-make-changes)). The [Commons Act 2006](https://www.legislation.gov.uk/ukpga/2006/26/pdfs/ukpga_20060026_en.pdf) separately places Welsh common-land registers with county or county-borough registration authorities, provides inspection and official-copy routes, and distinguishes rights of common from the register of title. For CL18, the commons registration authority remains Torfaen.

Three HM Land Registry products were assessed:

1. **Personal or official LLC search.** A search could reveal local land charges that happen to intersect Blorenge, but common-land registration is a separate CON29O enquiry. An official certificate's “local land charge boundary” is the charge geometry, not the maintained CL18 register map. The service terms prohibit automated copying or display on another website and say that reuse beyond conducting a register search requires specific consent; a purchased or free result therefore does not authorise public display, derivatives, or republication ([search terms](https://search-local-land-charges.service.gov.uk/terms-and-conditions)).
2. **Local land charges spatial data (INSPIRE).** HM Land Registry publishes a monthly Torfaen GML download under the OGL, with no API, showing indicative positions of local land charges that fall within specified INSPIRE themes ([dataset description and conditions](https://use-land-property-data.service.gov.uk/datasets/llc); [download listing](https://use-land-property-data.service.gov.uk/datasets/llc/download)). HM Land Registry expressly says that the definitive extent of a charge must be established from source documents held by the originating authority. The OGL and required HMLR/OS attributions allow reuse of those indicative LLC polygons, but do not convert them into, or license, Torfaen's separate CL18 register map. A spatial match would remain an unsupported inference and could instead identify another charge, such as a protected-site designation.

   The current Torfaen ZIP was downloaded and inspected directly on 9 August 2026. It contains 196 forestry, 25,353 residential-use, and 311 protected-site features, with no area-management features. Searching all four GML files found no `CL18`, `Blorenge`, `common land`, or `commons` text. Each populated feature exposes only an INSPIRE identifier, validity/lifespan dates, and geometry; it has no charge description, originating-authority reference, common name, or commons register-unit field. The bulk package therefore has neither an attribute join nor a textual basis for identifying any polygon as CL18.
3. **Title/INSPIRE ownership polygons.** HMLR's Index Polygons show the indicative position and extent of registered freehold titles and link an INSPIRE ID to a title. HMLR warns that the extent of land in a title cannot be established from those polygons and must be checked against the title plan ([Index polygons spatial data](https://use-land-property-data.service.gov.uk/datasets/inspire)). Title ownership is distinct from status as registered common land, so title or INSPIRE data cannot identify or export the CL18 register-map boundary.

The [Local Land Charges Search API](https://www.api.gov.uk/hmlr/local-land-charges-search/) is a Business Gateway integration for conducting the same search; it is not an open bulk-export API and supplies no separate authority to reuse search results. Consequently, HMLR may be useful for discovering unrelated charges affecting a chosen area, but it is neither the authoritative source nor a licensing route for CL18.

## Welsh Government `wom_commons` candidate

The DataMapWales layer [Woodland Opportunity Map - Commons](https://datamap.gov.wales/layers/geonode%3Awom_commons) is published by Welsh Government under the Open Government Licence. Its catalogue offers vector download and WMS/WFS access, and its metadata gives EPSG:27700. The layer has only the attributes `objectid`, `en_status`, `layer`, `shape_length`, `shape_area`, and `geom`; it has no common name, registration authority, or register-unit identifier.

The publisher's description says that the layer was created for the Woodland Opportunity Map only and may not reflect the most current dataset. Its WFS response contains four Wales-wide aggregate features; the feature for urban common is classified as `Urban Common` / `Open Access - Other Statutory Access Land` ([WFS attributes](https://datamap.gov.wales/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=geonode%3Awom_commons&outputFormat=application%2Fjson&propertyName=objectid%2Cen_status%2Clayer%2Cshape_area)).

A local spatial inspection of that official WFS geometry found an urban-common component at array index 114 with bounding box `[321850.688, 202484, 329836.773, 213182.391]` and calculated area 1,969.682 hectares. That is close to, but not equal to, the decision report's approximate 2,017 hectares. The array index is not a published stable component identifier and the component has no register linkage; numerical proximity is not evidence that it is CL18.

The layer is reusable on its own terms, but it cannot satisfy the CL18 requirement: it is purpose-derived, potentially stale, aggregated, and cannot be joined to the register identity. Selecting polygons by location would be an unsupported inference rather than an authoritative CL18 boundary. Welsh Government's `data@gov.wales` can be asked whether a current register-linked source or component-to-register crosswalk exists, but this should not delay the request to Torfaen.

## Re-use assessment

The [Open Government Licence version 3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) permits copying, publishing, distributing, adapting, combining, and commercial or non-commercial exploitation, subject to attribution, indication of modifications, and its exclusions. That licence supports display, clipping, reprojection, derived areas, accessible adaptations, retention, and republication **only where it has expressly been applied**—as it has to `wom_commons`, but not to a Torfaen CL18 register extract found in this research.

| Required use | Current authority for an authoritative CL18 boundary | Gate result |
|---|---|---|
| Public web-map and static display | No express permission found | Closed |
| Clipping, cropping, reprojection, generalisation, format conversion, or tiles | No express permission found | Closed |
| Union, buffer, or other derived AOI | No express permission found | Closed |
| Accessible text, table, or other non-map presentation | No express permission found | Closed |
| Indefinite internal retention and versioned snapshots | No express permission found | Closed |
| Republication, download, or export | No express permission found | Closed |

There is an additional rights question. Ordnance Survey explains that OS OpenData-derived data can be published under the OGL with acknowledgement, while publication of other PSGA-derived data depends on the presumption-to-publish process or an exemption ([OS derived-data guidance](https://www.ordnancesurvey.co.uk/customers/public-sector/public-sector-licensing/publish-derived-data)). Because Torfaen's assessment mentions OS MasterMap, the council must confirm whether the supplied boundary is OS-derived and whether it has authority to license the intended onward uses. The MasterMap reference must not be treated as proof that a future CL18 file is OS-derived, or that republication is prohibited or permitted.

## Acceptance and validation gate

Do not publish a purported CL18 boundary until the custodian supplies or confirms all applicable items below.

| Field | Current result |
|---|---|
| Stable register identifier and title | `CL18`, Blorenge Common, historically confirmed |
| Registration authority/custodian | Torfaen County Borough Council confirmed |
| Current maintained geometry | Missing |
| Current registered extent | Missing; approximately 2,017 ha is historical only |
| Effective date, last amendment, and version date | Missing |
| Register-map scale and source | Missing |
| CRS and axis order | Missing for the authoritative geometry |
| Delivery format | Missing |
| Geometry validity and topology | Cannot test until delivery |
| Extent/area reconciliation with register | Cannot test until delivery |
| Redaction, simplification, or generalisation | Missing |
| Definitive versus indicative status | Missing |
| File checksum | Not applicable until delivery; record SHA-256 on receipt |
| Exact attribution, disclaimer, and modified-data notice | Missing |
| OS or other third-party rights | Missing |
| Express permission for every required use | Missing |

On receipt, preserve the original file unchanged, record its delivery date and SHA-256 checksum, retain the covering correspondence, validate the declared CRS and geometry, compare feature identity and stated area with the register metadata, document every transformation, and publish only from a versioned derivative linked back to that evidence.

## Ready-to-send access and re-use request

**To:** `LocalLandChargesTeam@torfaen.gov.uk`
**Cc:** `foi@torfaen.gov.uk`
**Subject:** Access and re-use request — Blorenge Common CL18 maintained boundary

> Dear Local Land Charges Team,
>
> I am requesting access to, and permission to re-use, the current maintained register-map boundary for Blorenge Common, register unit CL18. This request combines access under the Environmental Information Regulations 2004 and/or the public right to inspect the common-land register with a re-use request under the Re-use of Public Sector Information Regulations 2015.
>
> For clarity, this request concerns the Common Land Register and its register map held by Torfaen as commons registration authority. It is not an LLC1 search of HM Land Registry's national Local Land Charges Register. I understand that Torfaen continues to answer CON29O common-registration enquiries following the Local Land Charges migration.
>
> We have reviewed HM Land Registry's current Torfaen Local Land Charges bulk GML download. It contains no `CL18`, `Blorenge`, or common-land identifier, and its features expose only INSPIRE identifiers, dates, and indicative charge geometry. It therefore provides no defensible means to identify or verify the maintained CL18 register-map boundary. If Torfaen considers a particular HMLR Local Land Charges entry to correspond to CL18, please provide its originating-authority reference and explain how it links to the Common Land Register; this does not replace our request for the maintained CL18 register map.
>
> Please provide the information in the electronic, machine-readable format in which it is already held; there is no request to create or adapt information that is not held. In particular, please provide:
>
> 1. The current maintained land-section register map for CL18, including all amendments currently in force. If a native GIS polygon is held, please provide it. If only paper or raster material is held, please provide the highest-resolution available scan and confirm whether we may digitise it.
> 2. The stable identifier and title, current registered extent, effective or last-amendment date, dataset/version date, register-map scale and source, coordinate reference system and axis order, file format, and whether the geometry has been redacted, simplified, or generalised. Please state whether it is definitive or indicative.
> 3. The exact licence or written permission covering: public web-map and static display; clipping/cropping; reprojection; generalisation; format conversion and tile creation; union, buffering, and other derived-area creation; accessible text, table, or other non-map presentation; indefinite internal retention and versioned snapshots; and republication, download, or export. Please give the required attribution, disclaimer, and wording for indicating modifications.
> 4. Whether any part is derived from Ordnance Survey or other third-party material. If so, please identify the material and rights owner and confirm whether Torfaen is authorised to license the uses above under the PSGA presumption to publish, OGL, or another stated route. If Torfaen cannot authorise them, please identify the permissible alternative and the party from whom permission must be obtained.
> 5. Any delivery checksum already held. If none is held, we will calculate and record a SHA-256 checksum on receipt.
>
> If any information or requested re-use is refused or restricted, please provide the written reason, identify any known third-party rights owner, and explain the applicable review or complaint route. Please process the access and re-use elements concurrently where possible.
>
> Preferred delivery is by email or secure download. Please also provide any accessible alternative needed to communicate the boundary without reliance on a visual map, under the same re-use terms.
>
> Requester name: [name]
> Organisation, if applicable: [organisation]
> Correspondence address: [address]
> Email/telephone: [details]
>
> Yours faithfully,
>
> [name]

Torfaen says written environmental-information requests should include the applicant's name, contact address, detailed description, and preferred form, and that it normally responds within 20 working days ([Freedom of Information and EIR](https://www.torfaen.gov.uk/en/AboutTheCouncil/DataProtectionFreedomofInformation/FreedomofInformationAct/Freedom-of-Information.aspx)). The National Archives' official RPSI guidance says access and re-use are distinct but can be handled concurrently, public bodies need only supply an existing format, and refusals should give reasons and identify known third-party copyright holders ([RPSI implementation guidance](https://cdn.nationalarchives.gov.uk/documents/information-management/psi-implementation-guidance-public-sector-bodies.pdf); [2015 Regulations](https://www.legislation.gov.uk/uksi/2015/1415/pdfs/uksi_20151415_en.pdf)).

## Settled launch boundary decision

The launch will proceed with the properly licensed Blorenge SSSI boundary only, using the SSSI geometry plus a 2 km buffer as the launch area of interest. Label it as an SSSI boundary, not as Blorenge Common CL18; omit common-area statistics and controls; and retain a visible provenance note explaining that the common-land boundary is awaiting authoritative supply and re-use clearance. Treat CL18 as a post-launch enhancement. Do not substitute NRW Open Access Registered Common Land, HM Land Registry Local Land Charges geometry, the Woodland Opportunity Map aggregate, or a hand-traced/spatially inferred approximation.

This is a data-provenance and publication-risk assessment, not legal advice.
