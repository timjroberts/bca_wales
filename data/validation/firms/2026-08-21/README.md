# FIRMS signal validation, 21 August 2026

This directory preserves the exact, secret-audited validation output used to decide whether the second Blorenge release should implement **Recent satellite thermal anomalies**.

- GitHub Actions run: <https://github.com/timjroberts/bca_wales/actions/runs/32516416356>
- Validation code commit: [`b3adfdf`](https://github.com/timjroberts/bca_wales/commit/b3adfdf501c61395280287f295a5d1945aaa9dc7)
- Canonical core: `Blorenge.geojson` version `2026-08-21.1`, SHA-256 `825404bb2e7fb85620d874b900a0884e3dc5f0107c26b5491dca665f90f77d73`
- Derived exact 2 km AOI SHA-256: `9261061e51b3b06287e1906c94a6f3380f8e782987980c22af8d79f878bbe557`
- Required sources only: `VIIRS_NOAA21_NRT` and `VIIRS_NOAA20_NRT`; Suomi NPP was not queried.

The event window contains 226 unique inside-AOI observations: 104 NOAA-21 and 122 NOAA-20, spanning 20 July 2026 at 01:05 UTC through 29 July 2026 at 02:34 UTC. The 30-day quiet comparison contains zero inside-AOI observations. One quiet-period row returned by the bounding-box query lies outside the exact AOI and was correctly removed by geometry clipping. The recent five-day check was also a healthy zero for both sources.

The `evidence/raw` tree contains all 27 exact provider responses. `evidence/manifest.json` records redacted request templates, HTTP metadata, byte counts and SHA-256 checksums. `evidence/observations.json` contains normalized inside-AOI observations; `evidence/report.json` and `evidence/report.md` contain the measured assessment. The workflow scanned every retained byte for the exact protected key before upload. No key-bearing URL or secret value is present.
