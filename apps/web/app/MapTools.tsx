"use client";

import { localise, type ContrastLevel, type ExplorerState, type Language } from "@bca/domain";
import type { ExplorerLayer, ExplorerRelease } from "@bca/publication";
import { useState } from "react";

type MapToolsCopy = {
  mapTools: string;
  toolCount: string;
  layers: string;
  dates: string;
  primaryDate: string;
  compare: string;
  earlierDate: string;
  contrast: string;
  low: string;
  medium: string;
  high: string;
  details: string;
};

type MapToolsProps = {
  fixture: ExplorerRelease;
  state: ExplorerState;
  language: Language;
  copy: MapToolsCopy;
  detailLayerId: string | null;
  onLayerToggle: (layerId: string) => void;
  onLayerDetail: (layerId: string) => void;
  onPrimaryDateChange: (dateId: string) => void;
  onComparisonToggle: (enabled: boolean) => void;
  onEarlierDateChange: (dateId: string) => void;
  onContrastChange: (contrast: ContrastLevel) => void;
};

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
  onPrimaryDateChange,
  onComparisonToggle,
  onEarlierDateChange,
  onContrastChange
}: MapToolsProps) {
  const primaryDateIndex = fixture.dates.findIndex((date) => date.id === state.primaryDate);
  const [openPanels, setOpenPanels] = useState({ tools: true, layers: true, date: true });

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
                <details open key={group.id}>
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
                      <strong>{language === "en" ? "Change surface states" : "Cyflyrau’r arwyneb newid"}</strong>
                      <ul>
                        {fixture.evidenceStates.map((item, index) => (
                          <li key={item.id}>
                            <span className={`evidence-state evidence-state-${index}`} aria-hidden="true" />
                            <span lang={language === "cy" ? "en" : undefined}>{item.id.replaceAll("_", " ")}</span>
                          </li>
                        ))}
                      </ul>
                      {language === "cy" ? <small className="global-fallback"><b lang="en">EN</b> Mae labeli technegol y cyflwr yn aros yn Saesneg.</small> : null}
                    </div>
                  ) : null}
                </details>
              );
            })}
          </div>
        </details>

        <details className="map-tool-panel map-tool-date" open={openPanels.date} onToggle={(event) => setPanelOpen("date", event.currentTarget.open)}>
          <summary>
            <span className="tool-disclosure-icon" aria-hidden="true">›</span>
            <strong>{copy.dates}</strong>
          </summary>

          <div className="map-tool-date-fields">
            <label className="map-tool-select-field">
              <span>{copy.primaryDate}</span>
              <select value={state.primaryDate ?? ""} onChange={(event) => onPrimaryDateChange(event.target.value)}>
                {fixture.dates.map((date, index) => (
                  <option key={date.id} value={date.id} disabled={state.comparisonEnabled && index === 0}>
                    {localise(date.label, language)} · {localise(date.displayDate, language)}
                  </option>
                ))}
              </select>
            </label>

            <label className="map-tool-compare-toggle">
              <input
                type="checkbox"
                checked={state.comparisonEnabled}
                onChange={(event) => onComparisonToggle(event.target.checked)}
              />
              <span><strong>{copy.compare}</strong></span>
            </label>

            {state.comparisonEnabled ? (
              <div className="map-tool-comparison-fields">
                <label className="map-tool-select-field">
                  <span>{copy.earlierDate}</span>
                  <select value={state.comparisonDate ?? ""} onChange={(event) => onEarlierDateChange(event.target.value)}>
                    {fixture.dates.map((date, index) => (
                      <option key={date.id} value={date.id} disabled={index >= primaryDateIndex}>
                        {localise(date.label, language)} · {localise(date.displayDate, language)}
                      </option>
                    ))}
                  </select>
                </label>

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
          </div>
        </details>
      </div>
    </details>
  );
}
