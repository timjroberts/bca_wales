"use client";

import {
  DEFAULT_EXPLORER_STATE,
  localise,
  toggleVisibleLayer,
  type ExplorerState,
  type Language
} from "@bca/domain";
import type { ExplorerLayer, ExplorerRelease } from "@bca/publication";
import { useEffect, useMemo, useRef, useState } from "react";
import explorerDocument from "../../../data/launch/explorer-release-2026-08-13.json";
import { MapCanvas } from "./MapCanvas";
import { MapTools } from "./MapTools";

const explorer = explorerDocument as unknown as ExplorerRelease;
const LANGUAGE_COOKIE = "bca-language";

const copy = {
  en: {
    skip: "Skip to the explorer",
    brand: "Blorenge landscape",
    fixture: "Published evidence · 13 August 2026",
    title: "What changed after the July 2026 fire?",
    intro: "Explore open landscape evidence, compare dated observations and keep the source and its limits in view.",
    caution: "Observed vegetation change is not proof of ecological recovery. The EFFIS boundary is provisional, not an authority or surveyed perimeter.",
    map: "Explore map",
    evidence: "Read without a map",
    mapTools: "Map Tools",
    toolCount: "2 tools",
    layers: "Layers and legend",
    dates: "Observation date",
    primaryDate: "Date",
    compare: "Compare two dates",
    compareHint: "Place a later observation over an earlier one.",
    earlier: "Earlier observation",
    earlierDate: "Earlier date",
    later: "Later overlay",
    contrast: "Overlay contrast",
    low: "Low",
    medium: "Medium",
    high: "High",
    sources: "Sources in view",
    sourceHelp: "Open a layer’s information panel for status, provenance, licence and limitations.",
    details: "Source details",
    close: "Close source details",
    classification: "Classification",
    provider: "Provider",
    status: "Evidence status",
    date: "Source or publication date",
    licence: "Licence and reuse",
    method: "Method and provenance",
    owner: "Owner and next review",
    limitations: "Limitations",
    fallback: "Some source names and map-control labels remain in English while verified Welsh wording is prepared.",
    table: "Evidence and sources in the current view",
    layer: "Layer",
    shown: "Shown",
    source: "Source and status",
    temporal: "Selected observation",
    download: "Download accessible evidence states (CSV)",
    noSources: "No layers are currently shown.",
    mapSummary: "The selected observations and visible layers are summarised below. The change surface is a derived comparison; the EFFIS boundary remains a separate provisional provider interpretation.",
    area: "Launch area: Blorenge SSSI plus exactly 2 km",
    howTo: "How to read this explorer",
    guidance: [
      "Check the evidence status before interpreting a layer.",
      "Use comparison as a visual aid; the text account carries the same selection.",
      "Read limitations and provenance before downloading or reusing anything."
    ]
  },
  cy: {
    skip: "Neidio i’r archwiliwr",
    brand: "Tirwedd y Blorens",
    fixture: "Tystiolaeth gyhoeddedig · 13 Awst 2026",
    title: "Beth newidiodd ar ôl tân Gorffennaf 2026?",
    intro: "Archwiliwch dystiolaeth agored am y dirwedd, cymharwch arsylwadau â dyddiad a chadwch y ffynhonnell a’i chyfyngiadau yn y golwg.",
    caution: "Nid yw newid llystyfiant a welwyd yn brawf o adferiad ecolegol. Mae ffin EFFIS yn dros dro, nid yn derfyn awdurdod nac arolwg.",
    map: "Archwilio’r map",
    evidence: "Darllen heb fap",
    mapTools: "Offer map",
    toolCount: "2 offer",
    layers: "Haenau ac allwedd",
    dates: "Dyddiad arsylwi",
    primaryDate: "Dyddiad",
    compare: "Cymharu dau ddyddiad",
    compareHint: "Gosodwch arsylwad diweddarach dros un cynharach.",
    earlier: "Arsylwad cynharach",
    earlierDate: "Dyddiad cynharach",
    later: "Troshaen ddiweddarach",
    contrast: "Cyferbyniad y droshaen",
    low: "Isel",
    medium: "Canolig",
    high: "Uchel",
    sources: "Ffynonellau yn y golwg",
    sourceHelp: "Agorwch banel gwybodaeth haen ar gyfer statws, tarddiad, trwydded a chyfyngiadau.",
    details: "Manylion y ffynhonnell",
    close: "Cau manylion y ffynhonnell",
    classification: "Dosbarthiad",
    provider: "Darparwr",
    status: "Statws y dystiolaeth",
    date: "Dyddiad y ffynhonnell neu’r cyhoeddiad",
    licence: "Trwydded ac ailddefnyddio",
    method: "Dull a tharddiad",
    owner: "Perchennog a’r adolygiad nesaf",
    limitations: "Cyfyngiadau",
    fallback: "Mae rhai enwau ffynonellau, metadata a’r crynodeb technegol yn aros yn Saesneg tra bod geiriad Cymraeg wedi’i wirio yn cael ei baratoi.",
    table: "Tystiolaeth a ffynonellau yn yr olygfa gyfredol",
    layer: "Haen",
    shown: "Wedi’i dangos",
    source: "Ffynhonnell a statws",
    temporal: "Arsylwad a ddewiswyd",
    download: "Lawrlwytho cyflyrau tystiolaeth hygyrch (CSV)",
    noSources: "Nid oes haenau’n cael eu dangos ar hyn o bryd.",
    mapSummary: "Crynhoir yr arsylwadau dethol a’r haenau gweladwy isod. Cymhariaeth ddeilliedig yw’r arwyneb newid; mae ffin EFFIS yn aros yn ddehongliad dros dro ar wahân gan ddarparwr.",
    area: "Ardal lansio: SoDdGA y Blorens ynghyd ag union 2 km",
    howTo: "Sut i ddarllen yr archwiliwr hwn",
    guidance: [
      "Gwiriwch statws y dystiolaeth cyn dehongli haen.",
      "Defnyddiwch gymhariaeth fel cymorth gweledol; mae’r testun yn defnyddio’r un dewis.",
      "Darllenwch gyfyngiadau a tharddiad cyn lawrlwytho neu ailddefnyddio unrhyw beth."
    ]
  }
} as const;

function initialState(): ExplorerState {
  return {
    ...DEFAULT_EXPLORER_STATE,
    visibleLayerIds: explorer.layers.filter((layer) => layer.defaultVisible).map((layer) => layer.id),
    primaryDate: explorer.dates.at(-1)?.id ?? null,
    comparisonDate: explorer.dates[0]?.id ?? null
  };
}

function parseState(current: ExplorerState): ExplorerState {
  const params = new URLSearchParams(window.location.search);
  const allowedLayers = new Set(explorer.layers.map((layer) => layer.id));
  const requestedLayers = params.get("layers")?.split(",").filter((id) => allowedLayers.has(id));
  const allowedDates = new Set(explorer.dates.map((date) => date.id));
  const requestedPrimaryDate = params.get("date");
  const requestedComparisonDate = params.get("compare");
  const contrast = params.get("contrast");
  const primaryDate = requestedPrimaryDate && allowedDates.has(requestedPrimaryDate) ? requestedPrimaryDate : current.primaryDate;
  const comparisonDate = requestedComparisonDate && allowedDates.has(requestedComparisonDate) ? requestedComparisonDate : current.comparisonDate;
  const primaryIndex = explorer.dates.findIndex((date) => date.id === primaryDate);
  const comparisonIndex = explorer.dates.findIndex((date) => date.id === comparisonDate);

  return {
    ...current,
    visibleLayerIds: requestedLayers ?? current.visibleLayerIds,
    primaryDate,
    comparisonDate,
    comparisonEnabled: Boolean(requestedComparisonDate && comparisonIndex >= 0 && comparisonIndex < primaryIndex),
    contrast: contrast === "low" || contrast === "medium" || contrast === "high" ? contrast : current.contrast
  };
}

function stateHref(path: string, state: ExplorerState): string {
  const params = new URLSearchParams();
  params.set("layers", state.visibleLayerIds.join(","));
  if (state.primaryDate) params.set("date", state.primaryDate);
  if (state.comparisonEnabled && state.comparisonDate) params.set("compare", state.comparisonDate);
  if (state.comparisonEnabled) params.set("contrast", state.contrast);
  return `${path}?${params.toString()}`;
}

function LayerName({ layer, language }: { layer: ExplorerLayer; language: Language }) {
  const fallback = language === "cy" && !layer.name.cy;
  return (
    <>
      {localise(layer.name, language)}
      {fallback ? <span className="fallback-badge" lang="en">EN</span> : null}
    </>
  );
}

export function Explorer({ initialView }: { initialView: "map" | "evidence" }) {
  const [state, setState] = useState<ExplorerState>(initialState);
  const [ready, setReady] = useState(false);
  const [detailLayerId, setDetailLayerId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const c = copy[state.language];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const cookieLanguage = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith(`${LANGUAGE_COOKIE}=`))
        ?.split("=")[1];
      setState((current) => parseState({
        ...current,
        language: cookieLanguage === "cy" || cookieLanguage === "en" ? cookieLanguage : current.language
      }));
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.lang = state.language;
    if (!ready) return;
    window.history.replaceState(null, "", stateHref(window.location.pathname, state));
  }, [ready, state]);

  useEffect(() => {
    if (!detailLayerId) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDetails(detailLayerId);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailLayerId]);

  function chooseLanguage(language: Language) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${LANGUAGE_COOKIE}=${language}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
    setState((current) => ({ ...current, language }));
  }

  function closeDetails(layerId: string) {
    setDetailLayerId(null);
    window.requestAnimationFrame(() => document.getElementById(`details-${layerId}`)?.focus());
  }

  function selectPrimaryDate(dateId: string) {
    setState((current) => {
      if (!current.comparisonEnabled) return { ...current, primaryDate: dateId };
      const primaryIndex = explorer.dates.findIndex((date) => date.id === dateId);
      const comparisonIndex = explorer.dates.findIndex((date) => date.id === current.comparisonDate);
      return {
        ...current,
        primaryDate: dateId,
        comparisonDate: comparisonIndex < primaryIndex ? current.comparisonDate : explorer.dates[Math.max(0, primaryIndex - 1)]?.id ?? null
      };
    });
  }

  function toggleComparison(enabled: boolean) {
    setState((current) => {
      if (!enabled) return { ...current, comparisonEnabled: false };
      const primaryIndex = explorer.dates.findIndex((date) => date.id === current.primaryDate);
      const comparisonIndex = explorer.dates.findIndex((date) => date.id === current.comparisonDate);
      if (primaryIndex > 0) {
        return {
          ...current,
          comparisonEnabled: true,
          comparisonDate: comparisonIndex >= 0 && comparisonIndex < primaryIndex
            ? current.comparisonDate
            : explorer.dates[primaryIndex - 1]?.id ?? null
        };
      }
      return {
        ...current,
        comparisonEnabled: true,
        comparisonDate: explorer.dates[0]?.id ?? null,
        primaryDate: explorer.dates[1]?.id ?? current.primaryDate
      };
    });
  }

  const visibleLayers = useMemo(
    () => explorer.layers.filter((layer) => state.visibleLayerIds.includes(layer.id)),
    [state.visibleLayerIds]
  );
  const detailLayer = explorer.layers.find((layer) => layer.id === detailLayerId);
  const selectedDate = explorer.dates.find((date) => date.id === state.primaryDate) ?? explorer.dates[0]!;
  const sourcesStrip = (
    <aside className="sources-strip" aria-live="polite" aria-labelledby="sources-heading">
      <p><strong id="sources-heading">{c.sources}:</strong> {visibleLayers.length ? [...new Set(visibleLayers.map((layer) => layer.attribution))].join(" · ") : c.noSources}</p>
      <span>{c.sourceHelp}{state.language === "cy" ? <small className="global-fallback"><b lang="en">EN</b> {c.fallback}</small> : null}</span>
    </aside>
  );
  const sourcePanel = detailLayer ? (
    <aside id="source-details" className="source-panel" aria-labelledby="source-title">
      <div className="source-heading"><div><p className="panel-kicker">{c.details}</p><h2 id="source-title"><LayerName layer={detailLayer} language={state.language} /></h2></div><button ref={closeButtonRef} type="button" aria-label={c.close} onClick={() => closeDetails(detailLayer.id)}>×</button></div>
      <p className="source-description">{localise(detailLayer.description, state.language)}</p>
      <dl>
        <div><dt>{c.classification}</dt><dd><span className={`status-badge status-${detailLayer.classification}`}>{detailLayer.classification}</span></dd></div>
        <div><dt>{c.provider}</dt><dd>{detailLayer.provider}</dd></div>
        <div><dt>{c.status}</dt><dd>{localise(detailLayer.evidenceStatus, state.language)}</dd></div>
        <div><dt>{c.date}</dt><dd>{localise(detailLayer.sourceDate, state.language)}</dd></div>
        <div><dt>{c.licence}</dt><dd>{detailLayer.licence}</dd></div>
        <div><dt>{c.owner}</dt><dd>{detailLayer.owner}; {detailLayer.nextReviewAt}</dd></div>
        <div><dt>{c.method}</dt><dd>{localise(detailLayer.method, state.language)}</dd></div>
      </dl>
      <div className="limitation-box"><strong>{c.limitations}</strong><ul>{detailLayer.limitations.map((limitation) => <li key={limitation.en}>{localise(limitation, state.language)}</li>)}</ul></div>
      {state.language === "cy" && (!detailLayer.name.cy || !detailLayer.description.cy || !detailLayer.method.cy) ? <p className="fallback-note"><span lang="en">EN</span>{c.fallback}</p> : null}
    </aside>
  ) : null;

  return (
    <>
      <a className="skip-link" href="#explorer-main">{c.skip}</a>
      <header className="site-header">
        <a className="brand" href={stateHref("/", state)} aria-label={`${c.brand} — ${c.map}`}>
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>{c.brand}</span>
        </a>
        <span className="fixture-pill">{c.fixture}</span>
        <fieldset className="language-switcher" aria-label="Language / Iaith">
          <legend className="sr-only">Language / Iaith</legend>
          <button type="button" aria-pressed={state.language === "en"} onClick={() => chooseLanguage("en")}>English</button>
          <button type="button" aria-pressed={state.language === "cy"} onClick={() => chooseLanguage("cy")}>Cymraeg</button>
        </fieldset>
      </header>

      <main id="explorer-main">
        <section className="story-intro" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">Blorenge / Y Blorens · 2026</p>
            <h1 id="page-title">{c.title}</h1>
            <p className="lede">{c.intro}</p>
          </div>
          <aside className="caution-card">
            <span aria-hidden="true">i</span>
            <p>{c.caution}</p>
          </aside>
        </section>

        <section className="explorer-shell" aria-label={state.language === "en" ? "Landscape explorer" : "Archwiliwr tirwedd"}>
          <nav className="view-toolbar" aria-label={state.language === "en" ? "Explorer views" : "Golygfeydd yr archwiliwr"}>
            <div className="segmented">
              <a href={stateHref("/", state)} aria-current={initialView === "map" ? "page" : undefined}>{c.map}</a>
              <a href={stateHref("/evidence/", state)} aria-current={initialView === "evidence" ? "page" : undefined}>{c.evidence}</a>
            </div>
            <p className="area-label">⌖ {c.area}</p>
          </nav>

          {initialView === "map" ? (
            <div className="map-workspace">
              <div className="map-stage">
                <MapCanvas explorer={explorer} language={state.language} state={state} />
                <MapTools
                  fixture={explorer}
                  state={state}
                  language={state.language}
                  copy={c}
                  detailLayerId={detailLayerId}
                  onLayerToggle={(layerId) => setState((current) => toggleVisibleLayer(current, layerId))}
                  onLayerDetail={(layerId) => setDetailLayerId(detailLayerId === layerId ? null : layerId)}
                  onPrimaryDateChange={selectPrimaryDate}
                  onComparisonToggle={toggleComparison}
                  onEarlierDateChange={(dateId) => setState((current) => ({ ...current, comparisonDate: dateId }))}
                  onContrastChange={(contrast) => setState((current) => ({ ...current, contrast }))}
                />
              </div>
              {sourcesStrip}
              {sourcePanel}
            </div>
          ) : (
            <div className="explorer-grid">
              <aside className="layer-panel" aria-labelledby="layers-heading">
                <div className="panel-heading">
                  <div><p className="panel-kicker">01</p><h2 id="layers-heading">{c.layers}</h2></div>
                  <span>{visibleLayers.length}/{explorer.layers.length}</span>
                </div>
                {explorer.groups.map((group) => {
                  const groupLayers = explorer.layers.filter((layer) => layer.groupId === group.id);
                  const activeCount = groupLayers.filter((layer) => state.visibleLayerIds.includes(layer.id)).length;
                  return (
                    <details className="layer-group" open key={group.id}>
                      <summary>
                        <span><strong>{localise(group.name, state.language)}</strong><small>{localise(group.description, state.language)}</small></span>
                        <span className="group-count" aria-label={`${activeCount}/${groupLayers.length}`}>{activeCount}/{groupLayers.length}</span>
                      </summary>
                      <div className="group-layers">
                        {groupLayers.map((layer) => (
                          <div className="layer-row" key={layer.id}>
                            <label>
                              <input type="checkbox" checked={state.visibleLayerIds.includes(layer.id)} onChange={() => setState((current) => toggleVisibleLayer(current, layer.id))} />
                              <span className={`legend-swatch swatch-${layer.mapStyle}`} aria-hidden="true" />
                              <span className="layer-copy"><strong><LayerName layer={layer} language={state.language} /></strong><small>{layer.classification}</small></span>
                            </label>
                            <button id={`details-${layer.id}`} type="button" className="detail-button" aria-label={`${c.details}: ${localise(layer.name, state.language)}`} aria-expanded={detailLayerId === layer.id} aria-controls="source-details" onClick={() => setDetailLayerId(detailLayerId === layer.id ? null : layer.id)}>ⓘ</button>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </aside>

              <div className="content-panel">
                <section className="date-control" aria-labelledby="date-heading">
                  <div><p className="panel-kicker">02</p><h2 id="date-heading">{c.dates}</h2></div>
                  <div className="time-controls">
                    <label className="compare-toggle">
                      <input type="checkbox" checked={state.comparisonEnabled} onChange={(event) => toggleComparison(event.target.checked)} />
                      <span><strong>{c.compare}</strong><small>{c.compareHint}</small></span>
                    </label>
                    {state.comparisonEnabled ? (
                      <div className="comparison-controls">
                        <label><span>{c.earlier}</span><select value={state.comparisonDate ?? ""} onChange={(event) => setState((current) => ({ ...current, comparisonDate: event.target.value }))}>
                          {explorer.dates.map((date, index) => <option key={date.id} value={date.id} disabled={index >= explorer.dates.findIndex((item) => item.id === state.primaryDate)}>{localise(date.label, state.language)} · {localise(date.displayDate, state.language)}</option>)}
                        </select></label>
                        <label><span>{c.later}</span><select value={state.primaryDate ?? ""} onChange={(event) => selectPrimaryDate(event.target.value)}>
                          {explorer.dates.map((date, index) => <option key={date.id} value={date.id} disabled={index <= explorer.dates.findIndex((item) => item.id === state.comparisonDate)}>{localise(date.label, state.language)} · {localise(date.displayDate, state.language)}</option>)}
                        </select></label>
                        <fieldset className="contrast-controls"><legend>{c.contrast}</legend><div>
                          {(["low", "medium", "high"] as const).map((contrast) => <button key={contrast} type="button" aria-pressed={state.contrast === contrast} onClick={() => setState((current) => ({ ...current, contrast }))}>{c[contrast]}</button>)}
                        </div></fieldset>
                      </div>
                    ) : (
                      <div className="date-options" aria-label={c.dates}>
                        {explorer.dates.map((date) => <button key={date.id} type="button" aria-pressed={state.primaryDate === date.id} onClick={() => selectPrimaryDate(date.id)}><strong>{localise(date.label, state.language)}</strong><span>{localise(date.displayDate, state.language)}</span></button>)}
                      </div>
                    )}
                  </div>
                </section>

                <section className="evidence-view" aria-labelledby="evidence-heading">
                  <div className="evidence-summary"><p className="panel-kicker">03</p><h2 id="evidence-heading">{c.evidence}</h2><p>{c.mapSummary}</p></div>
                  <div className="table-wrap"><table><caption>{c.table}</caption><thead><tr><th scope="col">{c.layer}</th><th scope="col">{c.shown}</th><th scope="col">{c.source}</th><th scope="col">{c.temporal}</th></tr></thead><tbody>
                    {explorer.layers.map((layer) => <tr key={layer.id}><th scope="row"><span className={`legend-swatch swatch-${layer.mapStyle}`} aria-hidden="true" /> <LayerName layer={layer} language={state.language} /></th><td>{state.visibleLayerIds.includes(layer.id) ? "✓" : "—"}<span className="sr-only">{state.visibleLayerIds.includes(layer.id) ? c.shown : "Hidden"}</span></td><td>{layer.provider}<br /><small>{localise(layer.evidenceStatus, state.language)}</small></td><td>{layer.temporal ? `${localise(selectedDate.label, state.language)} · ${localise(selectedDate.displayDate, state.language)} · ${selectedDate.validAoiPercent}% valid AOI` : "—"}</td></tr>)}
                  </tbody></table></div>
                  {state.language === "cy" ? <p className="fallback-note"><span lang="en">EN</span>{c.fallback}</p> : null}
                  <section className="factual-summary" aria-labelledby="factual-heading" lang={state.language === "cy" ? "en" : undefined}>
                    <h3 id="factual-heading">{explorer.claim}</h3>
                    <p><strong>First report:</strong> {explorer.incident.firstReport}. {explorer.incident.chronology} {explorer.incident.unknowns}</p>
                    <div className="table-wrap"><table><caption>Evidence-state summary for the launch area</caption><thead><tr><th scope="col">State</th><th scope="col">Meaning</th><th scope="col">Pixels</th><th scope="col">Rounded area (ha)</th></tr></thead><tbody>
                      {explorer.evidenceStates.map((item) => <tr key={item.id}><th scope="row">{item.id.replaceAll("_", " ")}</th><td>{item.meaning}</td><td>{item.pixels.toLocaleString()}</td><td>{item.areaHaRounded.toLocaleString()}</td></tr>)}
                    </tbody></table></div>
                    <p><strong>Terrain:</strong> {explorer.terrain.minimumM}–{explorer.terrain.maximumM} m; mean {explorer.terrain.meanM} m; {explorer.terrain.contourIntervalM} m contours.</p>
                    <ul>{explorer.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
                  </section>
                  <a className="download-button" href={`${process.env.NEXT_PUBLIC_ASSET_ORIGIN ?? "https://assets.bca.wales"}${explorer.map.assets.download}`} download>{c.download}</a>
                </section>

                {sourcesStrip}
                {sourcePanel}
              </div>
            </div>
          )}
        </section>

        <section className="reading-notes" aria-labelledby="guidance-heading"><div><p className="panel-kicker">04</p><h2 id="guidance-heading">{c.howTo}</h2></div><ol>{c.guidance.map((item, index) => <li key={item}><span aria-hidden="true">{index + 1}</span><p>{item}</p></li>)}</ol></section>
      </main>
      <footer><p>Evidence release {explorer.release.datasetVersion} · published 13 August 2026 · owner {explorer.release.owner} · next review {explorer.release.nextReviewAt}</p><nav aria-label="Service information"><a href="/accessibility/">Accessibility</a> · <a href="/privacy/">Privacy</a> · <a href="/security/">Security</a></nav><a href="#explorer-main">{c.skip}</a></footer>
    </>
  );
}
