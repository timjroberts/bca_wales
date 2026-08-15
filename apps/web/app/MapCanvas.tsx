"use client";

import type { ContrastLevel, ExplorerState, Language } from "@bca/domain";
import { localise } from "@bca/domain";
import type { ExplorerRelease } from "@bca/publication";
import maplibregl, { type LayerSpecification, type Map as MapLibreMap, type StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useEffect, useRef } from "react";

const SOURCE = {
  context: "release-context",
  terrain: "release-terrain",
  contours: "release-contours",
  change: "release-change",
  effis: "release-effis"
} as const;

const STYLE_LAYER_IDS: Record<string, readonly string[]> = {
  change: ["change-raster"],
  fire: ["effis-fill", "effis-outline"],
  protected: ["national-park", "blorenge-sssi"],
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
      [SOURCE.effis]: {
        type: "geojson",
        data: `${origin}${explorer.map.assets.effis}`,
        attribution: "European Union, Copernicus EFFIS · BCA clipping"
      }
    },
    layers
  };
}

export function MapCanvas({
  explorer,
  language,
  state
}: {
  explorer: ExplorerRelease;
  language: Language;
  state: ExplorerState;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const initialStateRef = useRef(state);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!pmtilesProtocolInstalled) {
      const protocol = new Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile);
      pmtilesProtocolInstalled = true;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = new maplibregl.Map({
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
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
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
        <strong>{language === "en" ? "Selected observation state:" : "Cyflwr arsylwi dethol:"}</strong> {summary}. {language === "en" ? "The published change surface compares the 2025 seasonal baseline with the first suitable post-report observation on 11 August 2026; EFFIS remains a separate provisional boundary." : "Mae’r arwyneb newid cyhoeddedig yn cymharu llinell sylfaen dymhorol 2025 â’r arsylwad addas cyntaf ar ôl yr adroddiad ar 11 Awst 2026; mae EFFIS yn aros yn ffin dros dro ar wahân."}
      </figcaption>
    </figure>
  );
}
