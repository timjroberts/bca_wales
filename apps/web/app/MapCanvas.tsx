"use client";

import type { ContrastLevel, ExplorerState, Language } from "@bca/domain";
import { localise } from "@bca/domain";
import type { ExplorerRelease } from "@bca/publication";
import * as maplibregl from "maplibre-gl";
import { type GeoJSONSource, type LayerSpecification, type Map as MapLibreMap, type StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useEffect, useRef } from "react";
import type { ActiveFireFeatureCollection, ActiveFireState } from "./activeFire";

const SOURCE = {
  context: "release-context",
  terrain: "release-terrain",
  contours: "release-contours",
  change: "release-change",
  ndvi: "release-ndvi",
  ndmi: "release-ndmi",
  effis: "release-effis",
  thermal: "operational-thermal"
} as const;

const STYLE_LAYER_IDS: Record<string, readonly string[]> = {
  change: ["change-raster"],
  ndvi: ["ndvi-raster"],
  ndmi: ["ndmi-raster"],
  thermal: ["thermal-outline", "thermal-centre"],
  fire: ["effis-fill", "effis-outline"],
  protected: ["national-park", "blorenge-sssi", "bca-core"],
  access: ["basemap-land", "contextual-paths"],
  water: ["principal-watercourses"],
  terrain: ["terrain-hillshade", "terrain-contours"],
  habitat: ["historical-habitat"]
};

const contrastOpacity: Record<ContrastLevel, number> = {
  low: 0.25,
  medium: 0.48,
  high: 0.72
};

const contrastLabel: Record<ContrastLevel, { en: string; cy: string }> = {
  low: { en: "low", cy: "isel" },
  medium: { en: "medium", cy: "canolig" },
  high: { en: "high", cy: "uchel" }
};

let pmtilesProtocolInstalled = false;

function assetOrigin(): string {
  const configuredOrigin = (process.env.NEXT_PUBLIC_ASSET_ORIGIN ?? "").trim();
  return (configuredOrigin || window.location.origin).replace(/\/$/, "");
}

function makeStyle(explorer: ExplorerRelease, state: ExplorerState): StyleSpecification {
  const origin = assetOrigin();
  const layers: LayerSpecification[] = [
    { id: "background", type: "background", paint: { "background-color": "#e7eadf" } },
    {
      id: "basemap-land", type: "fill", source: SOURCE.context, "source-layer": "context",
      filter: ["==", ["get", "layer_id"], "basemap-land"],
      paint: { "fill-color": "#d9dfcf", "fill-opacity": 0.72 }
    },
    {
      id: "terrain-hillshade", type: "raster", source: SOURCE.terrain,
      paint: { "raster-opacity": 0.32, "raster-saturation": -1, "raster-contrast": 0.18 }
    },
    {
      id: "change-raster", type: "raster", source: SOURCE.change,
      paint: { "raster-opacity": contrastOpacity[state.contrast], "raster-resampling": "nearest" }
    },
    {
      id: "ndvi-raster", type: "raster", source: SOURCE.ndvi,
      paint: { "raster-opacity": contrastOpacity[state.contrast], "raster-resampling": "nearest" }
    },
    {
      id: "ndmi-raster", type: "raster", source: SOURCE.ndmi,
      paint: { "raster-opacity": contrastOpacity[state.contrast], "raster-resampling": "nearest" }
    },
    {
      id: "historical-habitat", type: "fill", source: SOURCE.context, "source-layer": "context",
      filter: ["==", ["get", "layer_id"], "historical-phase1-habitat"],
      paint: { "fill-color": "#79a653", "fill-opacity": 0.28, "fill-outline-color": "#527538" }
    },
    {
      id: "national-park", type: "fill", source: SOURCE.context, "source-layer": "context",
      filter: ["==", ["get", "layer_id"], "bannau-brycheiniog-national-park"],
      paint: { "fill-color": "#7e58a0", "fill-opacity": 0.09, "fill-outline-color": "#694287" }
    },
    {
      id: "blorenge-sssi", type: "line", source: SOURCE.context, "source-layer": "context",
      filter: ["==", ["get", "layer_id"], "blorenge-sssi"],
      paint: { "line-color": "#6f3f91", "line-width": 4, "line-opacity": 0.95 }
    },
    {
      id: "bca-core", type: "line", source: SOURCE.context, "source-layer": "context",
      filter: ["==", ["get", "layer_id"], "bca-area-of-interest"],
      paint: { "line-color": "#1f4d3b", "line-width": 2.5, "line-opacity": 0.95, "line-dasharray": [4, 2] }
    },
    {
      id: "contextual-paths", type: "line", source: SOURCE.context, "source-layer": "context",
      filter: ["==", ["get", "layer_id"], "contextual-paths"],
      paint: { "line-color": "#3e463c", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 14, 2.2], "line-opacity": 0.68, "line-dasharray": [2, 1.5] }
    },
    {
      id: "principal-watercourses", type: "line", source: SOURCE.context, "source-layer": "context",
      filter: ["==", ["get", "layer_id"], "principal-watercourses"],
      paint: { "line-color": "#167fa9", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1, 14, 3.5] }
    },
    {
      id: "terrain-contours", type: "line", source: SOURCE.contours, "source-layer": "terraincontours",
      paint: { "line-color": "#786b59", "line-width": 1, "line-opacity": 0.58 }
    },
    {
      id: "effis-fill", type: "fill", source: SOURCE.effis,
      paint: { "fill-color": "#d95c39", "fill-opacity": 0.22 }
    },
    {
      id: "effis-outline", type: "line", source: SOURCE.effis,
      paint: { "line-color": "#7b281a", "line-width": 3, "line-dasharray": [2, 1] }
    },
    {
      id: "thermal-outline", type: "circle", source: SOURCE.thermal,
      paint: {
        "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 8, 0.7, 12, 7, 16, 108],
        "circle-color": "rgba(109, 40, 217, 0.05)",
        "circle-stroke-color": "#6D28D9",
        "circle-stroke-width": 2
      }
    },
    {
      id: "thermal-centre", type: "symbol", source: SOURCE.thermal,
      layout: { "icon-image": "thermal-diamond", "icon-allow-overlap": true }
    }
  ];

  return {
    version: 8,
    sources: {
      [SOURCE.context]: {
        type: "vector",
        url: `pmtiles://${origin}${explorer.map.assets.context}`,
        attribution: "Natural Resources Wales · © OpenStreetMap contributors · Geofabrik"
      },
      [SOURCE.terrain]: {
        type: "raster",
        url: `pmtiles://${origin}${explorer.map.assets.terrain}`,
        tileSize: 256,
        attribution: "Welsh Government LiDAR"
      },
      [SOURCE.contours]: {
        type: "vector",
        url: `pmtiles://${origin}${explorer.map.assets.contours}`,
        attribution: "Welsh Government LiDAR"
      },
      [SOURCE.change]: {
        type: "raster",
        url: `pmtiles://${origin}${explorer.map.assets.change}`,
        tileSize: 256,
        attribution: "Modified Copernicus Sentinel data 2025–2026 · USGS Landsat · BCA processing"
      },
      [SOURCE.ndvi]: {
        type: "raster",
        url: `pmtiles://${origin}${explorer.map.assets.ndvi}`,
        tileSize: 256,
        attribution: "Modified Copernicus Sentinel data 2025–2026 · BCA processing"
      },
      [SOURCE.ndmi]: {
        type: "raster",
        url: `pmtiles://${origin}${explorer.map.assets.ndmi}`,
        tileSize: 256,
        attribution: "Modified Copernicus Sentinel data 2025–2026 · BCA processing"
      },
      [SOURCE.effis]: {
        type: "geojson",
        data: `${origin}${explorer.map.assets.effis}`,
        attribution: "European Union, Copernicus EFFIS · BCA clipping"
      },
      [SOURCE.thermal]: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        attribution: "NASA FIRMS · VIIRS NOAA-21 and NOAA-20 · BCA clipping"
      }
    },
    layers
  };
}

export function MapCanvas({
  explorer,
  language,
  state,
  activeFire,
  activeFireMapOverride
}: {
  explorer: ExplorerRelease;
  language: Language;
  state: ExplorerState;
  activeFire: ActiveFireState;
  activeFireMapOverride: ActiveFireFeatureCollection | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const initialStateRef = useRef(state);
  const languageRef = useRef(language);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!pmtilesProtocolInstalled) {
      const protocol = new Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile);
      pmtilesProtocolInstalled = true;
    }

    maplibregl.setWorkerUrl(`/maplibre/${maplibregl.getVersion()}/maplibre-gl-worker.mjs`);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const options: maplibregl.MapOptions = {
      container: containerRef.current,
      style: makeStyle(explorer, initialStateRef.current),
      center: [...explorer.map.center],
      zoom: explorer.map.zoom,
      minZoom: 8,
      maxZoom: 16,
      maxBounds: [[-3.2, 51.67], [-2.92, 51.9]],
      attributionControl: false,
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      fadeDuration: reduceMotion ? 0 : 300
    };
    // Upstream documents undefined to retain v5 overscaling, but its optional
    // number type does not permit that value with exactOptionalPropertyTypes.
    Object.assign(options, { zoomLevelsToOverscale: undefined });
    const map = new maplibregl.Map(options);

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.setMissingStyleImageResolver((id) => {
      if (id !== "thermal-diamond" || map.hasImage(id)) return;
      const size = 18;
      const data = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          if (Math.abs(x - (size - 1) / 2) + Math.abs(y - (size - 1) / 2) > 7) continue;
          const offset = (y * size + x) * 4;
          data[offset] = 109;
          data[offset + 1] = 40;
          data[offset + 2] = 217;
          data[offset + 3] = 255;
        }
      }
      map.addImage(id, { width: size, height: size, data }, { pixelRatio: 2 });
    });
    map.on("click", "thermal-centre", (event) => {
      const observations = map.queryRenderedFeatures(event.point, { layers: ["thermal-centre"] });
      if (!observations.length) return;
      const root = document.createElement("div");
      root.className = "thermal-popup";
      const title = document.createElement("strong");
      title.textContent = languageRef.current === "en" ? "Satellite observations at this pixel" : "Arsylwadau lloeren yn y picsel hwn";
      root.append(title);
      for (const observation of observations) {
        const row = document.createElement("p");
        const observedAt = typeof observation.properties?.observed_at === "string" ? new Date(observation.properties.observed_at) : null;
        const timestamp = observedAt && Number.isFinite(observedAt.getTime()) ? observedAt.toISOString().replace("T", " ").replace(".000Z", " UTC") : "unknown";
        row.textContent = `${observation.properties?.sensor ?? "NOAA"} · ${timestamp} · ${observation.properties?.confidence ?? "unknown"} · FRP ${observation.properties?.frp_mw ?? "unknown"} MW`;
        root.append(row);
      }
      const note = document.createElement("small");
      note.textContent = languageRef.current === "en" ? "Nominal 375 m pixel centre — not an exact fire location or verified incident." : "Canol picsel enwol 375 m — nid union leoliad tân na digwyddiad wedi’i gadarnhau.";
      root.append(note);
      new maplibregl.Popup({ closeButton: true, maxWidth: "330px" }).setLngLat(event.lngLat).setDOMContent(root).addTo(map);
    });
    map.on("mouseenter", "thermal-centre", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "thermal-centre", () => { map.getCanvas().style.cursor = ""; });
    mapRef.current = map;
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [explorer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => (map.getSource(SOURCE.thermal) as GeoJSONSource | undefined)?.setData((activeFireMapOverride ?? activeFire.map) as never);
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [activeFire.map, activeFireMapOverride]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      for (const layer of explorer.layers) {
        const visibility = state.visibleLayerIds.includes(layer.id) ? "visible" : "none";
        for (const styleLayerId of STYLE_LAYER_IDS[layer.id] ?? []) {
          if (map.getLayer(styleLayerId)) map.setLayoutProperty(styleLayerId, "visibility", visibility);
        }
      }
      if (map.getLayer("change-raster")) {
        map.setPaintProperty("change-raster", "raster-opacity", contrastOpacity[state.contrast]);
      }
      for (const component of ["ndvi-raster", "ndmi-raster"]) {
        if (map.getLayer(component)) map.setPaintProperty(component, "raster-opacity", contrastOpacity[state.contrast]);
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [explorer.layers, state]);

  const primary = explorer.dates.find((date) => date.id === state.primaryDate);
  const comparison = explorer.dates.find((date) => date.id === state.comparisonDate);
  const summary = state.comparisonEnabled && comparison
    ? `${localise(comparison.label, language)} (${localise(comparison.displayDate, language)}) + ${localise(primary?.label ?? comparison.label, language)} (${localise(primary?.displayDate ?? comparison.displayDate, language)}), ${localise(contrastLabel[state.contrast], language)}`
    : `${localise(primary?.label ?? explorer.dates[0]!.label, language)} (${localise(primary?.displayDate ?? explorer.dates[0]!.displayDate, language)})`;

  return (
    <figure className="map-figure">
      <div
        ref={containerRef}
        className="map-canvas"
        role="region"
        aria-label={language === "en" ? "Interactive evidence map of the Blorenge" : "Map tystiolaeth rhyngweithiol o’r Blorens"}
        aria-describedby="map-description"
      />
      <figcaption id="map-description" className="map-caption">
        <strong>{language === "en" ? "Selected observation state:" : "Cyflwr arsylwi dethol:"}</strong> {summary}. {language === "en" ? "The change layers compare the 2025 seasonal baseline with a 29 July / 11 August 2026 narrow same-season composite. EFFIS and the rolling thermal-anomaly points remain separate sources." : "Mae’r haenau newid yn cymharu llinell sylfaen dymhorol 2025 â chyfansawdd tymor cul 29 Gorffennaf / 11 Awst 2026. Mae EFFIS a’r pwyntiau anomaledd thermol treigl yn aros yn ffynonellau ar wahân."} {state.visibleLayerIds.includes("thermal") ? (language === "en" ? `Thermal feed: ${activeFire.health}; ${activeFire.counts.map24h} observations in the 24-hour view.` : `Ffrwd thermol: ${activeFire.health}; ${activeFire.counts.map24h} arsylwad yn yr olwg 24 awr.`) : null}
      </figcaption>
    </figure>
  );
}
