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
    brand: "Blorenge Landscape Explorer",
    fixture: "Published evidence · 13 August 2026",
    title: "Explore the Blorenge landscape and see how it changes over time",
    intro: "After exploring this beautiful landscape on foot, why not explore its data and compare and observe how it changes over time.",
    caution: "Observed vegetation change is not proof of ecological recovery. The EFFIS boundary is provisional, not an authority or surveyed perimeter.",
    map: "Explore map",
    mapTools: "Map Tools",
    toolCount: "2 tools",
    layers: "Layers and legend",
    dates: "Observation date",
    primaryDate: "Date",
    compare: "Compare two dates",
    earlierDate: "Earlier date",
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
    download: "Download accessible evidence states (CSV)",
    noSources: "No layers are currently shown.",
    area: "Launch area: Blorenge SSSI plus exactly 2 km"
  },
  cy: {
    skip: "Neidio i’r archwiliwr",
    brand: "Archwiliwr Tirwedd y Blorens",
    fixture: "Tystiolaeth gyhoeddedig · 13 Awst 2026",
    title: "Archwiliwch dirwedd y Blorens a gweld sut mae’n newid dros amser",
    intro: "Ar ôl archwilio’r dirwedd hardd hon ar droed, beth am archwilio ei data a chymharu a gweld sut mae’n newid dros amser.",
    caution: "Nid yw newid llystyfiant a welwyd yn brawf o adferiad ecolegol. Mae ffin EFFIS yn dros dro, nid yn derfyn awdurdod nac arolwg.",
    map: "Archwilio’r map",
    mapTools: "Offer map",
    toolCount: "2 offer",
    layers: "Haenau ac allwedd",
    dates: "Dyddiad arsylwi",
    primaryDate: "Dyddiad",
    compare: "Cymharu dau ddyddiad",
    earlierDate: "Dyddiad cynharach",
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
    download: "Lawrlwytho cyflyrau tystiolaeth hygyrch (CSV)",
    noSources: "Nid oes haenau’n cael eu dangos ar hyn o bryd.",
    area: "Ardal lansio: SoDdGA y Blorens ynghyd ag union 2 km"
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

function stateHref(state: ExplorerState): string {
  const params = new URLSearchParams();
  params.set("layers", state.visibleLayerIds.join(","));
  if (state.primaryDate) params.set("date", state.primaryDate);
  if (state.comparisonEnabled && state.comparisonDate) params.set("compare", state.comparisonDate);
  if (state.comparisonEnabled) params.set("contrast", state.contrast);
  return `/?${params.toString()}`;
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

export function Explorer() {
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
    window.history.replaceState(null, "", stateHref(state));
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
  const sourcesStrip = (
    <aside className="sources-strip" aria-live="polite" aria-labelledby="sources-heading">
      <p><strong id="sources-heading">{c.sources}:</strong> {visibleLayers.length ? [...new Set(visibleLayers.map((layer) => layer.attribution))].join(" · ") : c.noSources}</p>
      <span>{c.sourceHelp}{state.language === "cy" ? <small className="global-fallback"><b lang="en">EN</b> {c.fallback}</small> : null}</span>
      <a className="download-link" href={`${(process.env.NEXT_PUBLIC_ASSET_ORIGIN ?? "").trim()}${explorer.map.assets.download}`} download>{c.download}</a>
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
        <a className="brand" href={stateHref(state)} aria-label={`${c.brand} — ${c.map}`}>
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
          <div className="view-toolbar">
            <strong>{c.map}</strong>
            <p className="area-label">⌖ {c.area}</p>
          </div>

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
        </section>
      </main>
      <footer><p>Evidence release {explorer.release.datasetVersion} · published 13 August 2026 · owner {explorer.release.owner} · next review {explorer.release.nextReviewAt}</p><nav aria-label="Service information"><a href="/accessibility/">Accessibility</a> · <a href="/privacy/">Privacy</a> · <a href="/security/">Security</a></nav><a href="#explorer-main">{c.skip}</a></footer>
    </>
  );
}
