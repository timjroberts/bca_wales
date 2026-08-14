"use client";

import { localise, type ContrastLevel, type ExplorerState, type Language } from "@bca/domain";
import type { ExplorerLayer, ExplorerRelease } from "@bca/publication";
import { useState } from "react";

type MapToolsCopy = {
  mapTools: string;
  toolCount: string;
  layers: string;
  observations: string;
  fixed: string;
  fixedComparison: string;
  observationHelp: string;
  coverage: string;
  contrast: string;
  low: string;
  medium: string;
  high: string;
  details: string;
  stateArea: string;
  share: string;
};

type MapToolsProps = {
  fixture: ExplorerRelease;
  state: ExplorerState;
  language: Language;
  copy: MapToolsCopy;
  detailLayerId: string | null;
  onLayerToggle: (layerId: string) => void;
  onLayerDetail: (layerId: string) => void;
  onContrastChange: (contrast: ContrastLevel) => void;
};

const evidenceStateNames = {
  not_observed: { en: "Not observed", cy: "Heb ei arsylwi" },
  observed_no_thresholded_change: { en: "No thresholded change", cy: "Dim newid uwchlaw’r trothwy" },
  lower_confidence_observed_change: { en: "Lower-confidence change", cy: "Newid â hyder is" },
  higher_confidence_observed_change: { en: "Higher-confidence change", cy: "Newid â hyder uwch" }
} as const;

function MapToolLayerName({ layer, language }: { layer: ExplorerLayer; language: Language }) {
  const fallback = language === "cy" && !layer.name.cy;
  return (
    <>
      {localise(layer.name, language)}
      {fallback ? <span className="fallback-badge" lang="en">EN</span> : null}
    </>
  );
}

export function MapTools({
  fixture,
  state,
  language,
  copy,
  detailLayerId,
  onLayerToggle,
  onLayerDetail,
  onContrastChange
}: MapToolsProps) {
  const totalAreaHa = fixture.evidenceStates.reduce((total, item) => total + item.areaHaRounded, 0);
  const [openPanels, setOpenPanels] = useState({ tools: true, layers: false, observations: false });

  function setPanelOpen(panel: keyof typeof openPanels, open: boolean) {
    setOpenPanels((current) => current[panel] === open ? current : { ...current, [panel]: open });
  }

  return (
    <details className="map-tools" open={openPanels.tools} onToggle={(event) => setPanelOpen("tools", event.currentTarget.open)}>
      <summary>
        <span className="tool-disclosure-icon" aria-hidden="true">›</span>
        <strong>{copy.mapTools}</strong>
        <small>{copy.toolCount}</small>
      </summary>

      <div className="map-tools-grid">
        <details className="map-tool-panel map-tool-layers" open={openPanels.layers} onToggle={(event) => setPanelOpen("layers", event.currentTarget.open)}>
          <summary>
            <span className="tool-disclosure-icon" aria-hidden="true">›</span>
            <strong>{copy.layers}</strong>
            <small>{state.visibleLayerIds.length}/{fixture.layers.length}</small>
          </summary>

          <div className="map-tool-layer-groups">
            {fixture.groups.map((group) => {
              const layers = fixture.layers.filter((layer) => layer.groupId === group.id);
              const activeCount = layers.filter((layer) => state.visibleLayerIds.includes(layer.id)).length;
              return (
                <details open={group.id === "evidence"} key={group.id}>
                  <summary>
                    <strong>{localise(group.name, language)}</strong>
                    <small>{activeCount}/{layers.length}</small>
                  </summary>
                  <div>
                    {layers.map((layer) => (
                      <div className="map-tool-layer-row" key={layer.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={state.visibleLayerIds.includes(layer.id)}
                            onChange={() => onLayerToggle(layer.id)}
                          />
                          <span className={`legend-swatch swatch-${layer.mapStyle}`} aria-hidden="true" />
                          <span><MapToolLayerName layer={layer} language={language} /></span>
                        </label>
                        <button
                          id={`details-${layer.id}`}
                          type="button"
                          className="map-tool-info-button"
                          aria-label={`${copy.details}: ${localise(layer.name, language)}`}
                          aria-expanded={detailLayerId === layer.id}
                          aria-controls="source-details"
                          onClick={() => onLayerDetail(layer.id)}
                        >i</button>
                      </div>
                    ))}
                  </div>
                  {group.id === "evidence" ? (
                    <div className="evidence-state-legend" aria-label={language === "en" ? "Observed-change evidence states" : "Cyflyrau tystiolaeth newid a welwyd"}>
                      <strong>{language === "en" ? "Published change surface" : "Arwyneb newid cyhoeddedig"}</strong>
                      <ul>
                        {fixture.evidenceStates.map((item, index) => (
                          <li key={item.id}>
                            <span className={`evidence-state evidence-state-${index}`} aria-hidden="true" />
                            <span>
                              <b>{localise(evidenceStateNames[item.id as keyof typeof evidenceStateNames] ?? { en: item.id, cy: item.id }, language)}</b>
                              <small>{copy.stateArea} {item.areaHaRounded.toLocaleString(language === "cy" ? "cy-GB" : "en-GB")} ha · {copy.share} {(item.areaHaRounded * 100 / totalAreaHa).toFixed(1)}%</small>
                            </span>
                          </li>
                        ))}
                      </ul>
                      <fieldset className="map-tool-contrast">
                        <legend>{copy.contrast}</legend>
                        <div>
                          {(["low", "medium", "high"] as const).map((contrast) => (
                            <button
                              key={contrast}
                              type="button"
                              aria-pressed={state.contrast === contrast}
                              onClick={() => onContrastChange(contrast)}
                            >{copy[contrast]}</button>
                          ))}
                        </div>
                      </fieldset>
                    </div>
                  ) : null}
                </details>
              );
            })}
          </div>
        </details>

        <details className="map-tool-panel map-tool-observations" open={openPanels.observations} onToggle={(event) => setPanelOpen("observations", event.currentTarget.open)}>
          <summary>
            <span className="tool-disclosure-icon" aria-hidden="true">›</span>
            <strong>{copy.observations}</strong>
            <small>{copy.fixed}</small>
          </summary>

          <div className="map-tool-observation-record">
            <strong>{copy.fixedComparison}</strong>
            <p>{copy.observationHelp}</p>
            <ol>
              {fixture.dates.map((date) => (
                <li key={date.id}>
                  <span>{localise(date.label, language)} · {localise(date.displayDate, language)}</span>
                  <small>{copy.coverage}: {date.validAoiPercent}%</small>
                </li>
              ))}
            </ol>
          </div>
        </details>
      </div>
    </details>
  );
}
