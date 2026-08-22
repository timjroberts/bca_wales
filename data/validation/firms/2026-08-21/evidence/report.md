# FIRMS signal validation for the release-two Blorenge AOI

Retrieved: 2026-08-21T19:05:25.943Z

## Result

- Validation status: **passed**
- Implementation recommendation: **go**
- Exact buffered AOI: `9261061e51b3b06287e1906c94a6f3380f8e782987980c22af8d79f878bbe557` (-3.1141917079035677, 51.680022769546724, -2.9576185245017776, 51.83740107116975)
- NASA quota at start: 245/5000 per 10 minutes

## Measured signal

- Event window (15 July–3 August 2026): 226 unique inside-AOI observations.
- Quiet comparison (15 June–14 July 2026): 0 unique inside-AOI observations.
- Recent five-day check: 0 unique inside-AOI observations.
- Cross-sensor proximity candidates (≤750 m and ≤12 h): 1215. These remain independent observations, not duplicates or fires.
- Persistent quiet-period clusters (≥3 days within 500 m): 0.
- Provider revisions observed across repeated pulls: 0.

## Required interpretation

Keep every source observation. Deduplicate only exact repeated pulls by BCA observation key; preserve a changed row fingerprint as a provider revision. Do not spatially merge NOAA-21 and NOAA-20 observations or count points as fires. Empty healthy responses mean only that no qualifying anomaly was returned for the queried sensors and window.
