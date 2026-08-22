# Sentinel-2 observation set for the release-two EFFIS coverage gate

Research date: 22 August 2026.

## Decision

Use a four-observation, checksum-pinned Sentinel-2 L2A set for the second Blorenge release:

1. retain 12 July 2025 as the single **seasonal baseline**;
2. retain 12 July 2026 as the single **before-first-report** observation; and
3. replace the single 11 August 2026 **first-suitable-after-report** observation with the first passing narrow same-season composite: 29 July 2026 first, with 11 August 2026 filling only pixels invalid on 29 July.

No single post-report observation in the official catalogue through 22 August passes all of the settled gates. The narrow composite is not a threshold relaxation or an average across a broad window. It is the replacement route explicitly permitted by the resolution of [Define the second-release environmental layer contract](https://github.com/timjroberts/bca_wales/issues/74) when reselection is required: each constituent is independently masked with the same SCL classes and one native 20 m dilation; the earlier valid observation wins per pixel; the later observation fills only an invalid earlier pixel; a pixel invalid on both dates remains **Not observed**. The post-role invalid mask is therefore `invalid_2026-07-29 AND invalid_2026-08-11`, and combined comparability remains `valid_baseline AND valid_before_report AND valid_post_composite`.

This preserves the role's temporal meaning. Both inputs are after the documented first-report date, both are in the same July–August season, the composite ends on the already settled 11 August date, and exhaustive chronological testing shows that 22, 24, 26 and 27 July cannot form a passing composite with 11 August. The 29 July/11 August pair is the first chronological post-report composite that passes. It must be disclosed as a date range, with a per-pixel source-date provenance mask; it must never be described as a single-date observation.

## Primary catalogue evidence

The official Copernicus Data Space Ecosystem (CDSE) STAC queries used the exact expanded-AOI WGS84 bounds and fixed publication cut-off:

- [official 2026 CDSE query](https://stac.dataspace.copernicus.eu/v1/collections/sentinel-2-l2a/items?bbox=-3.1141917079035677,51.680022769546724,-2.9576185245017776,51.83740107116975&datetime=2026-07-01T00:00:00Z/2026-08-22T23:59:59Z&limit=100) — 47 returned items; captured response 3,352,796 bytes, SHA-256 `3728152432a677a4b490797726b5c289ef3bb701c018868584bfec3b9442fb05`;
- [official 2025 CDSE query](https://stac.dataspace.copernicus.eu/v1/collections/sentinel-2-l2a/items?bbox=-3.1141917079035677,51.680022769546724,-2.9576185245017776,51.83740107116975&datetime=2025-07-01T00:00:00Z/2025-08-31T23:59:59Z&limit=100) — 56 returned items; captured response 3,666,170 bytes, SHA-256 `bdb7f773881d40eea24335c44c98c99cb7a56b44fc971138d898aa7c83a3ecb0`.

Every intersecting `MGRS-30UVC` post-report item returned by the 2026 query was screened with the checked-in release recipe's actual SCL logic. The relative-orbit-37 candidates were 22, 27 and 29 July and 1, 6, 8, 11, 16 and 21 August. The relative-orbit-137 candidates were 24, 26 and 29 July and 3, 5, 8, 13, 15 and 18 August. Only 11 August passes the 95% single-observation AOI gate, but it leaves 197 of the 3,900 rasterised EFFIS pixels invalid and therefore cannot exceed `94.949%` EFFIS comparability. Changing the already 100%-valid-over-EFFIS baseline or before-report observations cannot raise that ceiling.

Earth Search is the exact public COG mirror already pinned by the release recipe. Its STAC items link each mirror identity to the CDSE SAFE product through `s2:product_uri`, expose byte sizes and SHA-256 multihashes, and provide the asset URLs used below: [2025 baseline item](https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/S2C_T30UVC_20250712T112136_L2A), [2026 before-report item](https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/S2B_T30UVC_20260712T112112_L2A), [29 July composite item](https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/S2A_T30UVC_20260729T112319_L2A), and [11 August composite item](https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/S2B_T30UVC_20260811T112205_L2A).

## Exact observations and roles

| Role | Sensing date/time | Official CDSE identity | Earth Search COG identity | Processing baseline |
| --- | --- | --- | --- | --- |
| Seasonal baseline | `2025-07-12T11:21:41.025Z` | `S2C_MSIL2A_20250712T112141_N0511_R037_T30UVC_20250712T145316` | `S2C_T30UVC_20250712T112136_L2A` | `05.11` |
| Before first report | `2026-07-12T11:21:09.024Z` | `S2B_MSIL2A_20260712T112109_N0512_R037_T30UVC_20260712T133747` | `S2B_T30UVC_20260712T112112_L2A` | `05.12` |
| First suitable after report, earliest-valid source | `2026-07-29T11:21:31.024Z` | `S2A_MSIL2A_20260729T112131_N0512_R037_T30UVC_20260729T195715` | `S2A_T30UVC_20260729T112319_L2A` | `05.12` |
| First suitable after report, invalid-pixel fill | `2026-08-11T11:21:09.025Z` | `S2B_MSIL2A_20260811T112109_N0512_R037_T30UVC_20260811T134112` | `S2B_T30UVC_20260811T112205_L2A` | `05.12` |

The provider times above are the CDSE product sensing times. Earth Search item `datetime` values are granule-specific and differ by seconds; the exact Earth Search identities remove ambiguity.

## Exact COG assets and SHA-256 pins

For each observation, the asset base is its Earth Search item directory:

`https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/sentinel-2-c1-l2a/30/U/VC/<year>/<month>/<earth-search-identity>/`

Every SHA-256 below was checked against the complete downloaded COG bytes. The existing 18 files also match recipe `2.0.5`; all six newly selected 29 July files match the SHA-256 payload in their Earth Search `file:checksum` multihashes.

### Seasonal baseline — `S2C_T30UVC_20250712T112136_L2A`

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `B04.tif` | 205,639,653 | `12f9ce808052f014bc7f2ef7c92e01fc7f6a1884ea56c7f2bbc79d0e9e4b1aba` |
| `B08.tif` | 230,421,426 | `6c91a2b1da08c8dc059bb6d0298cacfdae91003b8dfc8d4ab3cf14eab6265a8b` |
| `B8A.tif` | 59,074,530 | `ff48a89bd446d274af47a76e853b60c71fb9df79c22a09a285427a494c987582` |
| `B11.tif` | 55,363,259 | `d1d749c26fc89926d750d7c106ec0128de599b5732234edb764a13afcf4dcd77` |
| `B12.tif` | 53,898,653 | `857318b2b342321179255415cb6246a418b8cd2e8b876e9414f8458600c8e88d` |
| `SCL.tif` | 1,356,175 | `16c7af1b9f23404843e27b41340ec5c1f8a2e8a692d379cacb31a57181c50160` |

### Before first report — `S2B_T30UVC_20260712T112112_L2A`

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `B04.tif` | 185,117,842 | `8a6f1cc800eb41fb97857311bea79b3ce2981b32c4be1a374275c11763ccfedb` |
| `B08.tif` | 209,596,186 | `ede4f363fa57e22fee6f01589ae96badd27332be2a4b1af51f20753a01aff5ba` |
| `B8A.tif` | 53,133,316 | `fa478ca113bf99f6bb7c163f8b14d7a1d8ab162000e120c3900c7e6a7138325b` |
| `B11.tif` | 50,462,922 | `c31dd8b86553a82fe124805d8bba6b47572e1a34e58578dbda213b791f6cf78f` |
| `B12.tif` | 49,135,930 | `5a90a501e58caa2164874c1c1f0dc009f98828d19431a43c568650cbdf976685` |
| `SCL.tif` | 1,369,827 | `4f1e3fc0950f76a3c428f0bf2dfcb0a13f307fd53108a815b3a7be9b83a357e7` |

### Post-report composite, earliest-valid source — `S2A_T30UVC_20260729T112319_L2A`

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `B04.tif` | 211,311,651 | `105e0cf7af60e739fd63144453f61c8ba40258ce0ae69e9e197d648b69ee6e58` |
| `B08.tif` | 212,023,277 | `6ae8cf08d918973a65ee39bf296f0bbc6d41b67518d0576013a4983e427a54e4` |
| `B8A.tif` | 59,744,355 | `afad123898fa827341c482c5c29ef9a2df5ec2a1bd80a81177b297643454bb76` |
| `B11.tif` | 58,129,390 | `b72178273f1d58b94ddedfc176163bb6024bebad3210f67f9b279dd245053ee4` |
| `B12.tif` | 57,861,144 | `881ea6eeb8053aa99fe7d2f8288f2b8e7c430488d808d015ac3f3a59f918e034` |
| `SCL.tif` | 2,185,691 | `c43552a40dc3e89b10727b70ea305c4d1b7913174336de9c51e1a82e5eabddf5` |

The 29 July COGs are `EPSG:32630` on the same tile grid as the retained inputs. B04/B08 are 10 m, `10980 x 10980`; B8A/B11/B12/SCL are 20 m, `5490 x 5490`. Reflectance bands carry scale `0.0001`, offset `-0.1` and no-data `0`; SCL carries no-data `0`.

### Post-report composite, invalid-pixel fill — `S2B_T30UVC_20260811T112205_L2A`

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `B04.tif` | 215,576,297 | `9be588fc6a4d9cb91782224d35ba5514ef7258e2c01e672969ef9bfbbc4fb90e` |
| `B08.tif` | 232,217,627 | `ffbd44a350782bbd30e3a9eff1a18832873ca6b328e8b818f9faeb3c247e5916` |
| `B8A.tif` | 58,696,540 | `ae8bef05bd61404255a5b2f62e4f0269a2a8c5dcf8774185189a61fbfd7687c6` |
| `B11.tif` | 56,895,785 | `2dec43eee86f00ef9603588745641bfd4c65d1908ce87e7eb07484c4e994899b` |
| `B12.tif` | 55,901,538 | `9600f116bab6abe0491808a73428c91fa5328582ea856774cc0b1fb5f8961f9d` |
| `SCL.tif` | 2,247,909 | `6b0e087dde7182d38cde38eef10da49a20223ee080b952a07a6e3d1be856b640` |

## Gate validation

Validation imported the checked-in [`build_change_evidence_v2.py`](../../tooling/geodata/recipes/build_change_evidence_v2.py) at commit `1c003a092a3fdf6b3809a22da1d10207cfc6d7bf` inside the pinned, network-disabled `bca/geodata-toolchain:1.0.0` image (local image SHA-256 `6569e77896e3d296c70dcb67f1086789464909982a1a5ba33294cbe5999a6cca`). It used canonical BCA-area version `2026-08-21.1`, transformed to `EPSG:27700` and buffered by exactly 2,000 m; the preserved historic EFFIS response and feature `592404`; invalid SCL classes `0, 1, 2, 3, 8, 9, 10, 11`; one native 20 m invalidity dilation; nearest-neighbour mask reprojection; and the unchanged `95%` scene, `90%` product and `95%` EFFIS gates. Those are the same contracts enforced by [publication recipe `2.0.5`](../../data/launch/publication-recipe-2026-08-21.json).

| Gate | Threshold | Original three-scene set | Revised four-observation set | Result |
| --- | ---: | ---: | ---: | --- |
| Seasonal-baseline valid AOI | >=95% | 99.865% | 99.865% | pass |
| Before-first-report valid AOI | >=95% | 99.719% | 99.719% | pass |
| First-suitable-after-report valid AOI | >=95% | 99.295% | 99.479% | pass |
| NDVI comparable AOI | >=90% | 99.286% | 99.442% | pass |
| NDMI comparable AOI | >=90% | 99.286% | 99.442% | pass |
| Combined comparable AOI | >=90% | 99.124% | 99.277% | pass |
| Combined comparable EFFIS | >=95% | 94.949% | 95.538% | **pass** |

The EFFIS denominator is 3,900 20 m pixels. The original set observes 3,703 and misses 197; the revised composite observes 3,726 and misses 174, recovering 23 pixels without altering the EFFIS geometry or rasterisation. The 20 m expanded-AOI denominator is 335,170 pixels and combined comparability is 332,748 pixels.

The real-band path was exercised, not only the SCL masks. On every revised comparable pixel, dNBR, 20 m delta-NDVI and delta-NDMI are finite after the recipe's scale/offset and ratio operations; native 10 m delta-NDVI is likewise finite on every observed pixel. At 20 m the post composite selects 29 July for 178,369 AOI pixels, fills 155,055 from 11 August and leaves 1,746 not observed. At 10 m those counts are 713,486, 620,183 and 6,983 respectively.

## Chronological composite proof

The following results apply the candidate's independently dilated invalid mask together with 11 August, then run the unchanged role/product/EFFIS gates. They prove that 29 July is the first qualifying constituent, not an arbitrary later selection.

| Added post-report date | Post role valid AOI | NDVI comparable | NDMI comparable | Combined AOI | Combined EFFIS | Outcome |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 22 July | 99.295% | 99.286% | 99.286% | 99.124% | 94.949% | fail EFFIS |
| 24 July | 99.295% | 99.286% | 99.286% | 99.124% | 94.949% | fail EFFIS |
| 26 July | 99.295% | 99.286% | 99.286% | 99.124% | 94.949% | fail EFFIS |
| 27 July | 99.343% | 99.307% | 99.307% | 99.144% | 94.949% | fail EFFIS |
| **29 July, R037 S2A** | **99.479%** | **99.442%** | **99.442%** | **99.277%** | **95.538%** | **first pass** |

A 1 August/11 August pair also reaches 95.538% EFFIS comparability, but it is later and therefore does not preserve the “first suitable” role as closely. The other 29 July `R137` scene does not cover the AOI after no-data masking and is not a substitute.

## Release contract for implementation

1. Keep the 12 July 2025 and 12 July 2026 observations and their 12 asset pins unchanged.
2. Add all six pinned 29 July assets; keep all six pinned 11 August assets. Do not replace either with a same-day alternate-orbit item or a neighbouring tile.
3. Build the post role deterministically at each analytic grid: independently create each observation's existing common QA mask, including dilation; choose 29 July for every valid pixel; choose 11 August only where 29 July is invalid and 11 August is valid; otherwise set **Not observed**. Select all reflectance bands from the same per-pixel date.
4. Do not average, median, blend, interpolate or cloud-fill reflectance. Do not dilate only after merging raw SCL values: that would change the common-mask result. The composite invalid mask is the intersection of the two already-dilated invalid masks.
5. Describe the comparison observation as `2026-07-29/2026-08-11 narrow same-season post-report composite`, retain both provider identities, and emit per-pixel source-date provenance plus the date/count/coverage summary. Do not retain single-date 11 August wording.
6. Re-run the exact existing scene, product and EFFIS gates on the controlled offline build. All thresholds, AOI lineage, EFFIS geometry/rasterisation, mask classes, dilation and not-observed semantics remain unchanged and fail closed.

## Conclusion

The release does not need a presentation or scope retreat. No defensible single post-report replacement exists by the 22 August cut-off, but the settled contract already provides the precise route for that result: an explicitly decided narrow same-season composite. The four observations above are exact, checksum-pinned and pass every existing coverage gate while preserving the seasonal-baseline, before-first-report and first-suitable-after-report roles.
