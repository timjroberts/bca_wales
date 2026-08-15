# Can the Caerphilly open Common Land dataset supply Blorenge Common CL18?

**Research date:** 15 August 2026  
**Decision:** **No — do not publish a CL18 boundary derived from this dataset.**

## Decision summary

The linked [Data.gov.uk record](https://www.data.gov.uk/dataset/759f775e-bbb4-4b85-a217-bbd755caccb3/common-land2) is Caerphilly County Borough Council's `Common Land` dataset, not a national Welsh common-land register export and not a Torfaen CL18 dataset. Its official catalogue record describes commons “within the Borough”, while noting that some commons straddle adjoining authorities; it does not name Blorenge or `CL18` ([Data.gov.uk dataset](https://www.data.gov.uk/dataset/759f775e-bbb4-4b85-a217-bbd755caccb3/common-land2); [machine-readable CKAN record](https://ckan.publishing.service.gov.uk/api/3/action/package_show?id=759f775e-bbb4-4b85-a217-bbd755caccb3)). Welsh Government separately identifies Blorenge Common as register unit `CL18`, names Torfaen County Borough Council as its Registration Authority, and gives only an approximate total area of 2,017 hectares ([Welsh Government decision report](https://www.gov.wales/sites/default/files/publications/2018-01/common-land-blorenge-common-report.pdf)).

The catalogue offers no downloadable file. Its only two resources are a MISOportal WMS and WFS created in August 2015; the catalogue was last modified on 10 February 2016 and gives no resource `last_modified` date ([CKAN record](https://ckan.publishing.service.gov.uk/api/3/action/package_show?id=759f775e-bbb4-4b85-a217-bbd755caccb3)). Data.gov.uk currently marks both data links “Not available”, and direct probes of both services over HTTPS, plus the WFS over HTTP, timed out on 15 August 2026 ([Data.gov.uk dataset](https://www.data.gov.uk/dataset/759f775e-bbb4-4b85-a217-bbd755caccb3/common-land2); [catalogued WFS URL](http://inspire.misoportal.com/geoserver/caerphilly_county_borough_council_common_land/wfs?service=wfs&version=2.0.0&request=GetCapabilities); [catalogued WMS URL](http://inspire.misoportal.com/geoserver/caerphilly_county_borough_council_common_land/wms?request=getCapabilities)). There is therefore no current service payload from which to establish the feature type, schema, attributes, feature identifiers, geometry, topology, or actual presence of `CL18`.

The record is also not openly licensed for the intended public derivative. CKAN records `isopen: false`, blank standard-licence fields and an openness score of zero because the licence is not open; the dataset-specific terms say “Subject to PSMA licencing” and “Public Sector End User Licence for INSPIRE” ([CKAN record](https://ckan.publishing.service.gov.uk/api/3/action/package_show?id=759f775e-bbb4-4b85-a217-bbd755caccb3); [official ISO 19139 source metadata](https://ckan.publishing.service.gov.uk/harvest/object/16436371-d7f8-49cb-941b-b04467436efd)). The lineage says the data was digitised with reference to Ordnance Survey MasterMap ([source metadata](https://ckan.publishing.service.gov.uk/harvest/object/16436371-d7f8-49cb-941b-b04467436efd)). Ordnance Survey says the INSPIRE end-user licence is non-exclusive and non-transferable, allows personal non-commercial use only, and concerns access rather than onward reuse; it directs users needing third-party reuse to another licensing route ([OS INSPIRE licence guidance](https://www.ordnancesurvey.co.uk/licensing/eu-inspire-end-user-licence)). OS also says OGL publication of OS-derived data requires the applicable publishing criteria/process or an exemption ([OS public-sector licensing guide](https://www.ordnancesurvey.co.uk/customers/public-sector/public-sector-licensing)). The generic OGL footer on Data.gov.uk does not replace these explicit dataset-specific restrictions.

This leaves three independent publication blockers:

1. no live geometry or schema to inspect;
2. no attribute-selectable `CL18` record or official register-linked crosswalk; and
3. no demonstrated right to adapt and republish the geometry on BCA's public website.

Spatially choosing a polygon because it is near Blorenge, resembles an expected outline, or has an area near 2,017 hectares would be an unsupported inference. It would not establish that the polygon is the current register-map boundary for `CL18`.

## What the official record actually provides

| Item | Current evidence | Consequence |
|---|---|---|
| Publisher and contact | Caerphilly County Borough Council; `gis@caerphilly.gov.uk` ([Data.gov.uk](https://www.data.gov.uk/dataset/759f775e-bbb4-4b85-a217-bbd755caccb3/common-land2)) | It is not published by CL18's named Registration Authority, Torfaen ([Welsh Government decision](https://www.gov.wales/sites/default/files/publications/2018-01/common-land-blorenge-common-report.pdf)). |
| Dataset identifier | Catalogue UUID `759f775e-bbb4-4b85-a217-bbd755caccb3`; source metadata identifier `84ebd4fc-9beb-448d-9618-0f68922238da`; citation code `CCBCIN003` ([CKAN record](https://ckan.publishing.service.gov.uk/api/3/action/package_show?id=759f775e-bbb4-4b85-a217-bbd755caccb3); [source metadata](https://ckan.publishing.service.gov.uk/harvest/object/16436371-d7f8-49cb-941b-b04467436efd)) | These identify the dataset/metadata, not a common-land register unit. |
| Scope | The abstract discusses Caerphilly borough commons and commons shared with neighbouring authorities; it does not identify `CL18` or Blorenge ([source metadata](https://ckan.publishing.service.gov.uk/harvest/object/16436371-d7f8-49cb-941b-b04467436efd)) | Cross-boundary coverage cannot be turned into a CL18 identity without a register-linked field or official crosswalk. |
| Date and maintenance | Publication date 10 August 2015; metadata date 11 August 2015; catalogue modified 10 February 2016; frequency `asNeeded` ([CKAN record](https://ckan.publishing.service.gov.uk/api/3/action/package_show?id=759f775e-bbb4-4b85-a217-bbd755caccb3)) | The record supplies no evidence of the current register state or later amendments. |
| CRS and scale | Metadata declares EPSG:27700 and a representative scale of 1:10,000 ([source metadata](https://ckan.publishing.service.gov.uk/harvest/object/16436371-d7f8-49cb-941b-b04467436efd)) | These are catalogue declarations only; no live geometry was available to verify CRS, axis order, precision, or scale effects. |
| Distribution | Metadata says ESRI Shapefile, but publishes only WMS/WFS capability URLs; CKAN contains no file resource ([source metadata](https://ckan.publishing.service.gov.uk/harvest/object/16436371-d7f8-49cb-941b-b04467436efd); [CKAN record](https://ckan.publishing.service.gov.uk/api/3/action/package_show?id=759f775e-bbb4-4b85-a217-bbd755caccb3)) | There is no current file or feature response to acquire. |
| Lineage | “Digitised with reference to Ordnance Survey Master Map, records maintained in a GIS” ([source metadata](https://ckan.publishing.service.gov.uk/harvest/object/16436371-d7f8-49cb-941b-b04467436efd)) | Third-party derived-data rights must be resolved before public adaptation or republication. |
| Licence | `isopen: false`, openness score zero, PSMA access constraint and Public Sector End User Licence for INSPIRE ([CKAN record](https://ckan.publishing.service.gov.uk/api/3/action/package_show?id=759f775e-bbb4-4b85-a217-bbd755caccb3); [source metadata](https://ckan.publishing.service.gov.uk/harvest/object/16436371-d7f8-49cb-941b-b04467436efd)) | The record does not grant BCA an OGL-style right to clip, buffer, tile, display, retain, or redistribute a derivative. |

### Reproducible live-service check

The following probes were run on 15 August 2026. DNS resolved `inspire.misoportal.com` to `52.16.156.33`, but TCP connections to ports 80 and 443 timed out; no HTTP status, capabilities document, feature schema, or feature collection was returned.

```sh
curl --connect-timeout 15 --max-time 30 \
  'https://inspire.misoportal.com/geoserver/caerphilly_county_borough_council_common_land/wfs?service=wfs&version=2.0.0&request=GetCapabilities'

curl --connect-timeout 10 --max-time 20 \
  'http://inspire.misoportal.com/geoserver/caerphilly_county_borough_council_common_land/wfs?service=wfs&version=2.0.0&request=GetCapabilities'

curl --connect-timeout 10 --max-time 15 \
  'https://inspire.misoportal.com/geoserver/caerphilly_county_borough_council_common_land/wms?request=GetCapabilities&service=WMS'
```

CKAN's embedded 2016 archiver record says it once cached a 79,070-byte WFS capabilities document; its WMS check was already timing out intermittently. Both old cache URLs returned HTTP 404 on 15 August 2026 ([CKAN resource records](https://ckan.publishing.service.gov.uk/api/3/action/package_show?id=759f775e-bbb4-4b85-a217-bbd755caccb3)). A historical capabilities document would in any event describe a service, not prove that an archived `CL18` feature or geometry exists.

The machine-readable catalogue and source metadata remain retrievable independently:

```sh
curl -L 'https://ckan.publishing.service.gov.uk/api/3/action/package_show?id=759f775e-bbb4-4b85-a217-bbd755caccb3'

curl -L 'https://www.data.gov.uk/api/2/rest/harvestobject/16436371-d7f8-49cb-941b-b04467436efd/xml'
```

## Publishability gate

| Required evidence | Result | Gate |
|---|---|---|
| Official identity as Blorenge Common `CL18` | No `CL18` or Blorenge field, record, or crosswalk can be demonstrated | Closed |
| Current geometry from the Registration Authority | No geometry available; publisher is Caerphilly while the official CL18 decision names Torfaen | Closed |
| Current effective/version date | Only 2015 publication/metadata and 2016 catalogue-modification dates | Closed |
| CRS and axis order verified from data | Metadata declares EPSG:27700; data cannot be checked | Closed |
| Geometry validity and topology | No feature payload | Closed |
| Area reconciliation | No candidate feature; 2,017 ha is an approximate 2014 description, not a checksum or selection key ([Welsh Government decision](https://www.gov.wales/sites/default/files/publications/2018-01/common-land-blorenge-common-report.pdf)) | Closed |
| Public display, transformation, buffering, tiling, retention, and republication rights | Dataset-specific terms do not grant these uses to BCA | Closed |

**Release decision:** exclude this dataset from the second release's authoritative sources and do not derive, label, or imply a legal `CL18` boundary from it.

## Conditional acquisition and validation recipe if the publisher restores the service

Restoration alone would not make the data publishable. Use this sequence only to reassess it; stop at the first failed gate.

1. Save the WFS `GetCapabilities` response, HTTP headers, retrieval timestamp, and SHA-256 checksum from the exact CKAN-listed endpoint. Confirm the advertised feature type and output formats.
2. Request `DescribeFeatureType` for the advertised type and preserve it unchanged. Require either (a) a stable register-unit field whose exact value is `CL18`, or (b) an official Caerphilly/Torfaen crosswalk that maps a stable feature identifier to `CL18`. A name, location, object ID, visual resemblance, or area match is insufficient.
3. If and only if that identity gate passes, issue a WFS `GetFeature` equality filter on the documented register-unit field. Save the unmodified response, headers, timestamp, request URL, and SHA-256 checksum. Do not select by bounding box or intersection.
4. Obtain written confirmation from Torfaen, as the Registration Authority named in the Welsh Government decision, that the selected feature represents the current CL18 register-map land boundary and record its effective/amendment date ([Welsh Government decision](https://www.gov.wales/sites/default/files/publications/2018-01/common-land-blorenge-common-report.pdf); [Law Wales on registration authorities](https://law.gov.wales/environment/countryside-and-access/common-land)).
5. Obtain written terms from the publisher and any Ordnance Survey rights holder permitting BCA's public display, clipping, reprojection, generalisation, format conversion, tile creation, 2 km buffering, indefinite/versioned retention, and republication/export. Record exact attribution and modification notices ([OS public-sector licensing guide](https://www.ordnancesurvey.co.uk/customers/public-sector/public-sector-licensing)).
6. Validate the declared CRS and axis order; transform only from the preserved source; run geometry-validity checks; reject empty or self-intersecting geometry; inspect multipart components, holes, overlaps and gaps; and record source and transformed areas. Compare with the official register metadata. Treat the historic “some 2,017 hectares” only as a coarse anomaly check, never as proof of identity ([Welsh Government decision](https://www.gov.wales/sites/default/files/publications/2018-01/common-land-blorenge-common-report.pdf)).
7. Publish a versioned derivative only after every identity, currency, geometry, and rights gate passes. Document every transformation, including the separate 2 km buffer.

No exact `typeName` or attribute filter can responsibly be supplied now because the current WFS returns no capabilities/schema. Inventing either would pretend the missing evidence exists.

## GPS-defined fallback: permitted and prohibited claims

The second release may proceed with a BCA-defined working boundary built from user-supplied GPS coordinates, but it must be a new BCA dataset with its own provenance. It should be labelled along the lines of **“BCA approximate Blorenge working area”**, with the coordinate source, collection method/date, editor, version, CRS, transformation steps, geometry checks, and the separately calculated 2 km buffer recorded.

It must **not** be described as:

- the legal, registered, definitive, official, certified, maintained, or current boundary of Blorenge Common `CL18`;
- an extract or derivative of Caerphilly's Common Land dataset;
- supplied, endorsed, or verified by Caerphilly, Torfaen, Welsh Government, or Ordnance Survey; or
- proof of common-land status, ownership, grazing rights, public-access rights, or the extent of any register entry.

The existing, accurately labelled **“Blorenge SSSI and National Park”** layer can remain separate. Neither it nor the BCA working boundary should be represented as the legal CL18 register map.

## Comparison with the earlier boundary research

This result confirms rather than overturns [`blorenge-cl18-boundary-and-reuse.md`](./blorenge-cl18-boundary-and-reuse.md). That research found no maintained, register-linked CL18 geometry with explicit public-reuse terms and rejected spatial inference from Welsh Government `wom_commons`, NRW registered-common access data, and HM Land Registry Local Land Charges data. The exact Data.gov.uk dataset tested here adds no register-linked route: it is an old Caerphilly catalogue record whose sole services are currently unavailable and whose stated licence is not an open public-derivative licence.

The earlier recommendation to request the maintained CL18 register map and explicit reuse terms from Torfaen remains the route to an authoritative future CL18 layer. The GPS-defined boundary is instead a transparent product choice for the second release, not a substitute legal boundary.
