"use client";

import type { ContrastLevel, ExplorerState, Language } from "@bca/domain";
import { localise } from "@bca/domain";
import type { ExplorerFixture, ExplorerFixtureLayer } from "@bca/publication";
import maplibregl, { type FilterSpecification, type LayerSpecification, type Map as MapLibreMap, type StyleSpecification } from "maplibre-gl";
import { useEffect, useRef } from "react";

const SOURCE_ID = "interface-fixture";

const contrastOpacity: Record<ContrastLevel, number> = {
  low: 0.35,
  medium: 0.58,
  high: 0.82
};

const contrastLabel: Record<ContrastLevel, { en: string; cy: string }> = {
  low: { en: "low", cy: "isel" },
  medium: { en: "medium", cy: "canolig" },
  high: { en: "high", cy: "uchel" }
};

function baseLayer(layer: ExplorerFixtureLayer, dateId: string | null): LayerSpecification {
  const filter = (layer.temporal
    ? ["all", ["==", ["get", "layerId"], layer.id], ["==", ["get", "dateId"], dateId ?? ""]]
    : ["==", ["get", "layerId"], layer.id]) as FilterSpecification;

  const shared = { id: `fixture-${layer.id}`, source: SOURCE_ID, filter };

  switch (layer.mapStyle) {
    case "fire":
      return {
        ...shared,
        type: "fill",
        paint: { "fill-color": "#d95c39", "fill-opacity": 0.38, "fill-outline-color": "#7b281a" }
      } as unknown as LayerSpecification;
    case "change":
      return {
        ...shared,
        type: "circle",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 13, 14, 48],
          "circle-color": "#d8c95a",
          "circle-stroke-color": "#334d2e",
          "circle-stroke-width": 3,
          "circle-opacity": 0.78
        }
      } as unknown as LayerSpecification;
    case "protected":
      return {
        ...shared,
        type: "line",
        paint: { "line-color": "#724593", "line-width": 4, "line-opacity": 0.9 }
      } as LayerSpecification;
    case "access":
      return {
        ...shared,
        type: "line",
        paint: { "line-color": "#2d342d", "line-width": 3, "line-dasharray": [2, 2] }
      } as LayerSpecification;
    case "water":
      return {
        ...shared,
        type: "line",
        paint: { "line-color": "#2186ad", "line-width": 4 }
      } as LayerSpecification;
    case "habitat":
      return {
        ...shared,
        type: "fill",
        paint: { "fill-color": "#83a858", "fill-opacity": 0.35, "fill-outline-color": "#4d6d36" }
      } as LayerSpecification;
  }
}

function comparisonLayer(layer: ExplorerFixtureLayer, dateId: string | null): LayerSpecification {
  const comparison = baseLayer(layer, dateId) as LayerSpecification & { paint?: Record<string, unknown> };
  return {
    ...comparison,
    id: `fixture-${layer.id}-comparison`,
    paint: { ...comparison.paint, "circle-color": "#3f7544", "circle-translate": [10, -7] }
  } as LayerSpecification;
}

function makeStyle(fixture: ExplorerFixture, state: ExplorerState): StyleSpecification {
  const baseDate = state.comparisonEnabled ? state.comparisonDate : state.primaryDate;
  const layers: LayerSpecification[] = [
    { id: "background", type: "background", paint: { "background-color": "#dfe5d4" } },
    ...fixture.layers.map((layer) => baseLayer(layer, baseDate)),
    ...fixture.layers.filter((layer) => layer.temporal).map((layer) => comparisonLayer(layer, state.primaryDate))
  ];

  return {
    version: 8,
    sources: {
      [SOURCE_ID]: {
        type: "geojson",
        data: fixture.map.features as never,
        attribution: "BCA interface fixture — not public evidence"
      }
    },
    layers
  };
}

export function MapCanvas({
  fixture,
  language,
  state
}: {
  fixture: ExplorerFixture;
  language: Language;
  state: ExplorerState;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const initialStateRef = useRef(state);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: makeStyle(fixture, initialStateRef.current),
      center: [...fixture.map.center],
      zoom: fixture.map.zoom,
      attributionControl: false,
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      fadeDuration: reduceMotion ? 0 : 300
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({ compact: true, customAttribution: "Interface fixture — not evidence" }),
      "bottom-right"
    );
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [fixture]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      for (const layer of fixture.layers) {
        const visible = state.visibleLayerIds.includes(layer.id) ? "visible" : "none";
        const baseId = `fixture-${layer.id}`;
        if (map.getLayer(baseId)) {
          map.setLayoutProperty(baseId, "visibility", visible);
          if (layer.temporal) {
            map.setFilter(baseId, [
              "all",
              ["==", ["get", "layerId"], layer.id],
              ["==", ["get", "dateId"], state.comparisonEnabled ? state.comparisonDate ?? "" : state.primaryDate ?? ""]
            ]);
          }
        }

        const comparisonId = `fixture-${layer.id}-comparison`;
        if (map.getLayer(comparisonId)) {
          map.setLayoutProperty(
            comparisonId,
            "visibility",
            state.comparisonEnabled && state.visibleLayerIds.includes(layer.id) ? "visible" : "none"
          );
          map.setFilter(comparisonId, [
            "all",
            ["==", ["get", "layerId"], layer.id],
            ["==", ["get", "dateId"], state.primaryDate ?? ""]
          ]);
          map.setPaintProperty(comparisonId, "circle-opacity", contrastOpacity[state.contrast]);
        }
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [fixture.layers, state]);

  const primary = fixture.dates.find((date) => date.id === state.primaryDate);
  const comparison = fixture.dates.find((date) => date.id === state.comparisonDate);
  const summary = state.comparisonEnabled && comparison
    ? `${localise(comparison.label, language)} (${localise(comparison.displayDate, language)}) + ${localise(primary?.label ?? comparison.label, language)} (${localise(primary?.displayDate ?? comparison.displayDate, language)}), ${localise(contrastLabel[state.contrast], language)}`
    : `${localise(primary?.label ?? fixture.dates[0]!.label, language)} (${localise(primary?.displayDate ?? fixture.dates[0]!.displayDate, language)})`;

  return (
    <figure className="map-figure">
      <div
        ref={containerRef}
        className="map-canvas"
        role="region"
        aria-label={language === "en" ? "Interactive fixture map of the Blorenge" : "Map gosod rhyngweithiol o’r Blorens"}
        aria-describedby="map-description"
      />
      <figcaption id="map-description" className="map-caption">
        <strong>{language === "en" ? "Map state:" : "Cyflwr y map:"}</strong> {summary}. {localise(fixture.fixtureNotice, language)}
      </figcaption>
    </figure>
  );
}
