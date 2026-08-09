"use client";

import { useEffect, useState } from "react";

type Language = "en" | "cy";
type ViewMode = "map" | "list";
type ContrastLevel = "low" | "medium" | "high";
type LayerGroup = "evidence" | "landscape" | "historical";

const LANGUAGE_COOKIE = "bca-language";

type Layer = {
  id: string;
  group: LayerGroup;
  name: { en: string; cy?: string };
  description: { en: string; cy?: string };
  kind: { en: string; cy: string };
  className: string;
  defaultOn: boolean;
  source: string;
  attribution: string;
  status: { en: string; cy: string };
  updated: string;
  licence: string;
};

const layers: Layer[] = [
  {
    id: "fire",
    group: "evidence",
    name: { en: "July 2026 fire extent", cy: "Maint tân Gorffennaf 2026" },
    description: {
      en: "A provisional boundary assembled from the best open evidence available.",
      cy: "Ffin dros dro wedi’i llunio o’r dystiolaeth agored orau sydd ar gael.",
    },
    kind: { en: "Provisional evidence", cy: "Tystiolaeth dros dro" },
    className: "swatch-fire",
    defaultOn: true,
    source: "BCA evidence synthesis",
    attribution: "BCA evidence synthesis",
    status: { en: "Draft — evidence review in progress", cy: "Drafft — adolygiad tystiolaeth ar y gweill" },
    updated: "9 August 2026",
    licence: "To be confirmed per contributing source",
  },
  {
    id: "change",
    group: "evidence",
    name: { en: "Observed vegetation change", cy: "Newid llystyfiant a welwyd" },
    description: {
      en: "Satellite-derived change compared with the selected pre-fire baseline. This is not proof of ecological recovery.",
      cy: "Newid o ddelweddau lloeren o’i gymharu â’r llinell sylfaen cyn y tân. Nid yw hyn yn brawf o adferiad ecolegol.",
    },
    kind: { en: "Derived indicator", cy: "Dangosydd deilliedig" },
    className: "swatch-change",
    defaultOn: true,
    source: "Copernicus Sentinel-2 observations",
    attribution: "Copernicus Sentinel-2",
    status: { en: "Illustrative prototype", cy: "Prototeip enghreifftiol" },
    updated: "Observation dates under review",
    licence: "Copernicus Sentinel data — attribution required",
  },
  {
    id: "protected",
    group: "landscape",
    name: { en: "Protected landscape", cy: "Tirwedd warchodedig" },
    description: {
      en: "Blorenge SSSI and Bannau Brycheiniog National Park boundaries.",
      cy: "Ffiniau SoDdGA Blorens a Pharc Cenedlaethol Bannau Brycheiniog.",
    },
    kind: { en: "Authoritative context", cy: "Cyd-destun awdurdodol" },
    className: "swatch-protected",
    defaultOn: true,
    source: "Natural Resources Wales",
    attribution: "Natural Resources Wales",
    status: { en: "Published boundary context", cy: "Cyd-destun ffiniau cyhoeddedig" },
    updated: "Source date shown at publication",
    licence: "Open Government Licence",
  },
  {
    id: "access",
    group: "landscape",
    name: { en: "Access and paths", cy: "Mynediad a llwybrau" },
    description: {
      en: "Open-access land and contextual paths. Not a definitive legal rights-of-way record.",
      cy: "Tir mynediad agored a llwybrau cyd-destunol. Nid cofnod cyfreithiol diffiniol o hawliau tramwy mohono.",
    },
    kind: { en: "Context with limitations", cy: "Cyd-destun â chyfyngiadau" },
    className: "swatch-access",
    defaultOn: false,
    source: "Natural Resources Wales and open path data",
    attribution: "NRW and open path data",
    status: { en: "Context only", cy: "Cyd-destun yn unig" },
    updated: "Source date shown at publication",
    licence: "Open Government Licence / source-specific",
  },
  {
    id: "water",
    group: "landscape",
    name: { en: "Terrain and water", cy: "Tirwedd a dŵr" },
    description: {
      en: "Hillshade, contours and principal watercourses for orientation.",
      cy: "Cysgod bryniau, cyfuchliniau a phrif gyrsiau dŵr ar gyfer cyfeiriadedd.",
    },
    kind: { en: "Context", cy: "Cyd-destun" },
    className: "swatch-water",
    defaultOn: true,
    source: "Open elevation and NRW watercourse data",
    attribution: "Open elevation and NRW",
    status: { en: "Context only", cy: "Cyd-destun yn unig" },
    updated: "Source date shown at publication",
    licence: "Source-specific open licences",
  },
  {
    id: "habitat",
    group: "historical",
    name: { en: "Historical habitat survey", cy: "Arolwg cynefinoedd hanesyddol" },
    description: {
      en: "Dated Phase 1 habitat survey. It does not describe current habitat condition.",
      cy: "Arolwg cynefinoedd Cam 1 â dyddiad. Nid yw’n disgrifio cyflwr cynefinoedd presennol.",
    },
    kind: { en: "Historical context", cy: "Cyd-destun hanesyddol" },
    className: "swatch-habitat",
    defaultOn: false,
    source: "Natural Resources Wales",
    attribution: "Natural Resources Wales",
    status: { en: "Historical — not current condition", cy: "Hanesyddol — nid cyflwr presennol" },
    updated: "Survey date shown at publication",
    licence: "Open Government Licence",
  },
];

const layerGroups: Array<{
  id: LayerGroup;
  name: { en: string; cy: string };
  description: { en: string; cy: string };
}> = [
  {
    id: "evidence",
    name: { en: "Fire and change", cy: "Tân a newid" },
    description: { en: "The launch story and its observed indicators", cy: "Stori’r lansiad a’i dangosyddion a welwyd" },
  },
  {
    id: "landscape",
    name: { en: "Landscape context", cy: "Cyd-destun y dirwedd" },
    description: { en: "Protection, access, terrain and water", cy: "Gwarchodaeth, mynediad, tirwedd a dŵr" },
  },
  {
    id: "historical",
    name: { en: "Historical context", cy: "Cyd-destun hanesyddol" },
    description: { en: "Dated evidence that is not current condition", cy: "Tystiolaeth â dyddiad nad yw’n gyflwr presennol" },
  },
];

const dates = [
  { id: "baseline", en: "Before fire", cy: "Cyn y tân", date: "Jul–Aug 2025" },
  { id: "after", en: "After fire", cy: "Ar ôl y tân", date: "July 2026" },
  { id: "latest", en: "Latest", cy: "Diweddaraf", date: "August 2026" },
] as const;

const copy = {
  en: {
    brand: "Blorenge landscape",
    prototype: "Interaction prototype — not live evidence",
    title: "What changed after the July 2026 fire?",
    intro: "Explore the provisional fire extent, compare satellite observations and understand the landscape around it.",
    caution: "Observed vegetation change is an indicator from satellite imagery. It does not prove ecological recovery.",
    map: "Explore map",
    list: "Read without a map",
    layers: "Layers and legend",
    dates: "Observation date",
    compare: "Compare two dates",
    compareHint: "Optional: place a later observation over an earlier one and choose how strongly it appears.",
    earlier: "Earlier observation",
    later: "Later overlay",
    base: "Base",
    overlay: "Overlay",
    contrast: "Overlay contrast",
    low: "Low",
    medium: "Medium",
    high: "High",
    comparisonSummary: "The later observation is shown over the earlier one at the selected contrast. Pattern and text summaries remain available so change is not communicated by colour alone.",
    area: "Blorenge SSSI and registered common, plus 2 km context",
    source: "Source details",
    sourcesInView: "Sources in view",
    sourceInstruction: "Use each layer’s ⓘ button for licence, date, status and limitations.",
    close: "Close details",
    shown: "Shown",
    hidden: "Hidden",
    mapSummary: "Map summary",
    summaryText: "The provisional fire area crosses upland vegetation within the protected landscape. The strongest illustrative vegetation change appears in the central and north-eastern parts of the draft boundary.",
    places: "Nearby places and features",
    download: "Download accessible data (prototype)",
    methods: "How to read this evidence",
    feedback: "Is this understandable?",
    fallback: "Some source names remain in English while verified Welsh labels are prepared.",
    detailsFor: "Details for",
    classification: "Classification",
    provider: "Provider",
    evidenceStatus: "Evidence status",
    date: "Date",
    licence: "Licence and reuse",
    limitations: "What this does not tell you",
    limitationText: "The map cannot establish ecological condition, causation, legal access, ownership or precise fire timing on its own.",
  },
  cy: {
    brand: "Tirwedd y Blorens",
    prototype: "Prototeip rhyngweithio — nid tystiolaeth fyw",
    title: "Beth newidiodd ar ôl tân Gorffennaf 2026?",
    intro: "Archwiliwch faint dros dro y tân, cymharwch arsylwadau lloeren a deallwch y dirwedd o’i gwmpas.",
    caution: "Dangosydd o ddelweddau lloeren yw newid llystyfiant a welwyd. Nid yw’n profi adferiad ecolegol.",
    map: "Archwilio’r map",
    list: "Darllen heb fap",
    layers: "Haenau ac allwedd",
    dates: "Dyddiad arsylwi",
    compare: "Cymharu dau ddyddiad",
    compareHint: "Dewisol: gosodwch arsylwad diweddarach dros un cynharach a dewiswch pa mor gryf y mae’n ymddangos.",
    earlier: "Arsylwad cynharach",
    later: "Troshaen ddiweddarach",
    base: "Sylfaen",
    overlay: "Troshaen",
    contrast: "Cyferbyniad y droshaen",
    low: "Isel",
    medium: "Canolig",
    high: "Uchel",
    comparisonSummary: "Dangosir yr arsylwad diweddarach dros yr un cynharach ar y cyferbyniad a ddewiswyd. Mae patrymau a chrynodebau testun ar gael o hyd fel nad yw newid yn cael ei gyfleu drwy liw yn unig.",
    area: "SoDdGA Blorens a’r comin cofrestredig, ynghyd â 2 km o gyd-destun",
    source: "Manylion y ffynhonnell",
    sourcesInView: "Ffynonellau yn y golwg",
    sourceInstruction: "Defnyddiwch fotwm ⓘ pob haen ar gyfer trwydded, dyddiad, statws a chyfyngiadau.",
    close: "Cau’r manylion",
    shown: "Wedi’i dangos",
    hidden: "Wedi’i chuddio",
    mapSummary: "Crynodeb o’r map",
    summaryText: "Mae ardal dros dro y tân yn croesi llystyfiant ucheldirol yn y dirwedd warchodedig. Mae’r newid llystyfiant enghreifftiol cryfaf yn ymddangos yng nghanol a gogledd-ddwyrain y ffin ddrafft.",
    places: "Lleoedd a nodweddion cyfagos",
    download: "Lawrlwytho data hygyrch (prototeip)",
    methods: "Sut i ddarllen y dystiolaeth hon",
    feedback: "Ydy hyn yn ddealladwy?",
    fallback: "Mae rhai enwau ffynonellau’n aros yn Saesneg tra bod labeli Cymraeg wedi’u dilysu yn cael eu paratoi.",
    detailsFor: "Manylion am",
    classification: "Dosbarthiad",
    provider: "Darparwr",
    evidenceStatus: "Statws y dystiolaeth",
    date: "Dyddiad",
    licence: "Trwydded ac ailddefnyddio",
    limitations: "Beth nad yw hyn yn ei ddweud wrthych",
    limitationText: "Ni all y map ar ei ben ei hun sefydlu cyflwr ecolegol, achosiaeth, mynediad cyfreithiol, perchnogaeth nac union amseriad y tân.",
  },
};

export function Explorer({ initialView = "map" }: { initialView?: ViewMode }) {
  const [language, setLanguage] = useState<Language>("en");
  const view = initialView;
  const [activeDate, setActiveDate] = useState("latest");
  const [compareMode, setCompareMode] = useState(false);
  const [earlierDate, setEarlierDate] = useState("baseline");
  const [overlayContrast, setOverlayContrast] = useState<ContrastLevel>("medium");
  const [activeLayers, setActiveLayers] = useState(
    () => new Set(layers.filter((layer) => layer.defaultOn).map((layer) => layer.id)),
  );
  const [detailLayer, setDetailLayer] = useState<string | null>(null);
  const t = copy[language];

  useEffect(() => {
    const savedLanguage = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${LANGUAGE_COOKIE}=`))
      ?.split("=")[1];

    if (savedLanguage === "en" || savedLanguage === "cy") {
      setLanguage(savedLanguage);
      document.documentElement.lang = savedLanguage;
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  function chooseLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${LANGUAGE_COOKIE}=${nextLanguage}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
  }

  function label(value: { en: string; cy?: string }) {
    return language === "cy" && value.cy ? value.cy : value.en;
  }

  function toggleLayer(id: string) {
    setActiveLayers((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedLayer = layers.find((layer) => layer.id === detailLayer);
  const selectedDate = dates.find((date) => date.id === activeDate) ?? dates[2];
  const selectedEarlierDate = dates.find((date) => date.id === earlierDate) ?? dates[0];
  const selectedDateIndex = dates.findIndex((date) => date.id === activeDate);
  const earlierDateIndex = dates.findIndex((date) => date.id === earlierDate);
  const visibleAttributions = Array.from(
    new Set(layers.filter((layer) => activeLayers.has(layer.id)).map((layer) => layer.attribution)),
  );

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to the explorer</a>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Blorenge landscape explorer home">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>{t.brand}</span>
        </a>
        <div className="prototype-pill">{t.prototype}</div>
        <fieldset className="language-switcher" aria-label="Language / Iaith">
          <button type="button" aria-pressed={language === "en"} onClick={() => chooseLanguage("en")}>English</button>
          <button type="button" aria-pressed={language === "cy"} onClick={() => chooseLanguage("cy")}>Cymraeg</button>
        </fieldset>
      </header>

      <main id="main-content">
        <section className="story-intro" id="top">
          <div>
            <p className="eyebrow">Blorenge / Y Blorens · July 2026</p>
            <h1>{t.title}</h1>
            <p className="lede">{t.intro}</p>
          </div>
          <div className="caution-card">
            <span aria-hidden="true">i</span>
            <p>{t.caution}</p>
          </div>
        </section>

        <section className="explorer" aria-label={language === "en" ? "Landscape explorer" : "Archwiliwr tirwedd"}>
          <div className="view-toolbar">
            <div className="segmented" aria-label="Explorer view">
              <a href="/" aria-current={view === "map" ? "page" : undefined}>{t.map}</a>
              <a href="/evidence" aria-current={view === "list" ? "page" : undefined}>{t.list}</a>
            </div>
            <p className="area-label"><span aria-hidden="true">⌖</span> {t.area}</p>
          </div>

          <div className="explorer-grid">
            <aside className="layer-panel" aria-labelledby="layers-title">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">01</p>
                  <h2 id="layers-title">{t.layers}</h2>
                </div>
                <span>{activeLayers.size}/{layers.length}</span>
              </div>
              <div className="layer-list">
                {layerGroups.map((group) => {
                  const groupLayers = layers.filter((layer) => layer.group === group.id);
                  const activeCount = groupLayers.filter((layer) => activeLayers.has(layer.id)).length;
                  return (
                    <details className="layer-group" key={group.id} open>
                      <summary>
                        <span>
                          <strong>{label(group.name)}</strong>
                          <small>{label(group.description)}</small>
                        </span>
                        <span className="group-count" aria-label={`${activeCount} ${language === "en" ? "shown of" : "wedi’u dangos o"} ${groupLayers.length}`}>{activeCount}/{groupLayers.length}</span>
                      </summary>
                      <div className="group-layers">
                        {groupLayers.map((layer) => {
                          const active = activeLayers.has(layer.id);
                          return (
                            <div className="layer-row" key={layer.id}>
                              <label>
                                <input type="checkbox" checked={active} onChange={() => toggleLayer(layer.id)} />
                                <span className={`legend-swatch ${layer.className}`} aria-hidden="true" />
                                <span className="layer-copy">
                                  <strong>{label(layer.name)}</strong>
                                  <small>{label(layer.kind)}</small>
                                </span>
                                <span className="sr-only">{active ? t.shown : t.hidden}</span>
                              </label>
                              <button
                                type="button"
                                className="detail-button"
                                aria-label={`${t.source}: ${label(layer.name)}`}
                                aria-expanded={detailLayer === layer.id}
                                aria-controls="source-details"
                                onClick={() => setDetailLayer(detailLayer === layer.id ? null : layer.id)}
                              >
                                ⓘ
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </div>
            </aside>

            <div className="content-panel">
              <div className="date-control">
                <div>
                  <p className="panel-kicker">02</p>
                  <h2>{t.dates}</h2>
                </div>
                <div className="time-controls">
                  <label className="compare-toggle">
                    <input
                      type="checkbox"
                      checked={compareMode}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setEarlierDate("baseline");
                          setActiveDate("latest");
                        }
                        setCompareMode(event.target.checked);
                      }}
                    />
                    <span>
                      <strong>{t.compare}</strong>
                      <small>{t.compareHint}</small>
                    </span>
                  </label>
                  {compareMode ? (
                    <div className="comparison-selectors">
                      <label>
                        <span>{t.earlier}</span>
                        <select value={earlierDate} onChange={(event) => setEarlierDate(event.target.value)}>
                          {dates.map((date, index) => (
                            <option key={date.id} value={date.id} disabled={index >= selectedDateIndex}>
                              {language === "en" ? date.en : date.cy} · {date.date}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="compare-plus" aria-hidden="true">+</span>
                      <label>
                        <span>{t.later}</span>
                        <select value={activeDate} onChange={(event) => setActiveDate(event.target.value)}>
                          {dates.map((date, index) => (
                            <option key={date.id} value={date.id} disabled={index <= earlierDateIndex}>
                              {language === "en" ? date.en : date.cy} · {date.date}
                            </option>
                          ))}
                        </select>
                      </label>
                      <fieldset className="contrast-controls">
                        <legend>{t.contrast}</legend>
                        <div>
                          {(["low", "medium", "high"] as const).map((level) => (
                            <button
                              type="button"
                              key={level}
                              aria-pressed={overlayContrast === level}
                              onClick={() => setOverlayContrast(level)}
                            >
                              {t[level]}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    </div>
                  ) : (
                    <div className="date-options" role="group" aria-label={t.dates}>
                      {dates.map((date) => (
                        <button type="button" key={date.id} aria-pressed={activeDate === date.id} onClick={() => setActiveDate(date.id)}>
                          <strong>{language === "en" ? date.en : date.cy}</strong>
                          <span>{date.date}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {view === "map" ? (
                <div
                  className="map-view"
                  aria-label={compareMode
                    ? `${t.map}: ${t.base} ${language === "en" ? selectedEarlierDate.en : selectedEarlierDate.cy}, ${selectedEarlierDate.date}; ${t.overlay} ${language === "en" ? selectedDate.en : selectedDate.cy}, ${selectedDate.date}; ${t.contrast}: ${t[overlayContrast]}`
                    : `${t.map}: ${language === "en" ? selectedDate.en : selectedDate.cy}, ${selectedDate.date}`}
                >
                  <div className={`map-canvas observation-${compareMode ? selectedEarlierDate.id : selectedDate.id}`}>
                    <div className="terrain-ridge ridge-one" aria-hidden="true" />
                    <div className="terrain-ridge ridge-two" aria-hidden="true" />
                    {compareMode && (
                      <>
                        <div className={`observation-overlay overlay-${selectedDate.id} contrast-${overlayContrast}`} aria-hidden="true" />
                        <span className="overlay-label">{t.later} · {t.contrast}: {t[overlayContrast]}</span>
                      </>
                    )}
                    {activeLayers.has("protected") && <div className="protected-boundary" aria-hidden="true" />}
                    {activeLayers.has("fire") && <div className="fire-area" aria-hidden="true"><span>Draft fire extent</span></div>}
                    {activeLayers.has("change") && <><div className="change-patch change-one" aria-hidden="true" /><div className="change-patch change-two" aria-hidden="true" /></>}
                    {activeLayers.has("water") && <div className="watercourse" aria-hidden="true" />}
                    {activeLayers.has("access") && <div className="path-line" aria-hidden="true" />}
                    {activeLayers.has("habitat") && <div className="habitat-zone" aria-hidden="true" />}
                    <span className="place-label place-blorenge">Blorenge<br /><small>Y Blorens · 561 m</small></span>
                    <span className="place-label place-govilon">Govilon</span>
                    <span className="place-label place-blaenavon">Blaenavon</span>
                    <div className="map-scale">0 <span /> 1 km</div>
                    <div className="north-arrow" aria-label="North">N ↑</div>
                  </div>
                  <div className="map-caption" role="status" aria-live="polite">
                    <span className="status-dot" />
                    {compareMode ? (
                      <div className="comparison-caption">
                        <span><strong>{t.base}:</strong> {language === "en" ? selectedEarlierDate.en : selectedEarlierDate.cy} · {selectedEarlierDate.date}</span>
                        <span><strong>{t.overlay}:</strong> {language === "en" ? selectedDate.en : selectedDate.cy} · {selectedDate.date} · {t.contrast}: {t[overlayContrast]}</span>
                      </div>
                    ) : (
                      <><strong>{language === "en" ? selectedDate.en : selectedDate.cy}</strong><span>{selectedDate.date}</span></>
                    )}
                    <span className="caption-note">Illustrative geometry — not for operational use</span>
                  </div>
                  <div className="attribution-strip">
                    <p><strong>{t.sourcesInView}:</strong> {visibleAttributions.join(" · ")}</p>
                    <span>{t.sourceInstruction}</span>
                  </div>
                </div>
              ) : (
                <section className="non-map-view" aria-labelledby="summary-heading">
                  <div className="summary-card">
                    <p className="panel-kicker">{compareMode ? `${selectedEarlierDate.date} + ${selectedDate.date}` : selectedDate.date}</p>
                    <h2 id="summary-heading">{t.mapSummary}</h2>
                    <p>{t.summaryText}</p>
                    {compareMode && <p className="comparison-summary"><strong>{t.base}:</strong> {language === "en" ? selectedEarlierDate.en : selectedEarlierDate.cy}. <strong>{t.overlay}:</strong> {language === "en" ? selectedDate.en : selectedDate.cy}. <strong>{t.contrast}:</strong> {t[overlayContrast]}. {t.comparisonSummary}</p>}
                  </div>
                  <div className="evidence-table-wrap">
                    <table>
                      <caption>{language === "en" ? "Visible evidence and context" : "Tystiolaeth a chyd-destun gweladwy"}</caption>
                      <thead><tr><th scope="col">{language === "en" ? "Layer" : "Haen"}</th><th scope="col">{language === "en" ? "What it contributes" : "Beth mae’n ei gyfrannu"}</th><th scope="col">{language === "en" ? "Status" : "Statws"}</th></tr></thead>
                      <tbody>
                        {layers.filter((layer) => activeLayers.has(layer.id)).map((layer) => (
                          <tr key={layer.id}>
                            <th scope="row"><span className={`legend-swatch ${layer.className}`} aria-hidden="true" />{label(layer.name)}</th>
                            <td>{label(layer.description)}</td>
                            <td>{label(layer.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button className="download-button" type="button" onClick={() => alert(language === "en" ? "Prototype: accessible CSV and GeoJSON downloads would be offered here." : "Prototeip: byddai lawrlwythiadau CSV a GeoJSON hygyrch yn cael eu cynnig yma.")}>{t.download} ↓</button>
                </section>
              )}
            </div>

            {selectedLayer && (
              <aside className="source-panel" id="source-details" aria-labelledby="source-title">
                <div className="source-heading">
                  <div>
                    <p className="panel-kicker">{t.detailsFor}</p>
                    <h2 id="source-title">{label(selectedLayer.name)}</h2>
                  </div>
                  <button type="button" onClick={() => setDetailLayer(null)} aria-label={t.close}>×</button>
                </div>
                <p className="source-description">{label(selectedLayer.description)}</p>
                <dl>
                  <div><dt>{t.classification}</dt><dd>{label(selectedLayer.kind)}</dd></div>
                  <div><dt>{t.provider}</dt><dd>{selectedLayer.source}</dd></div>
                  <div><dt>{t.evidenceStatus}</dt><dd>{label(selectedLayer.status)}</dd></div>
                  <div><dt>{t.date}</dt><dd>{selectedLayer.updated}</dd></div>
                  <div><dt>{t.licence}</dt><dd>{selectedLayer.licence}</dd></div>
                </dl>
                <div className="limitation-box">
                  <strong>{t.limitations}</strong>
                  <p>{t.limitationText}</p>
                </div>
                {language === "cy" && <p className="fallback-note"><span>EN</span>{t.fallback}</p>}
              </aside>
            )}
          </div>
        </section>

        <section className="reading-notes">
          <div>
            <p className="panel-kicker">03</p>
            <h2>{t.methods}</h2>
          </div>
          <ol>
            <li><span>1</span><p><strong>{language === "en" ? "Start with the boundary" : "Dechreuwch gyda’r ffin"}</strong>{language === "en" ? "The fire extent is provisional and may change as evidence improves." : "Mae maint y tân dros dro a gall newid wrth i’r dystiolaeth wella."}</p></li>
            <li><span>2</span><p><strong>{language === "en" ? "Compare like with like" : "Cymharwch debyg â’i debyg"}</strong>{language === "en" ? "Use a seasonally comparable baseline and check cloud and image quality." : "Defnyddiwch linell sylfaen dymhorol gymaradwy a gwiriwch ansawdd y cymylau a’r ddelwedd."}</p></li>
            <li><span>3</span><p><strong>{language === "en" ? "Keep claims modest" : "Cadwch honiadau’n gymedrol"}</strong>{language === "en" ? "Satellite change is one observation, not a complete assessment of recovery." : "Un arsylwad yw newid lloeren, nid asesiad cyflawn o adferiad."}</p></li>
          </ol>
        </section>
      </main>

      <footer>
        <p><strong>BCA Wales</strong> · {language === "en" ? "Public landscape evidence, with its limits visible." : "Tystiolaeth tirwedd gyhoeddus, gyda’i chyfyngiadau’n weladwy."}</p>
        <a href="https://github.com/timjroberts/bca_wales/issues/33">{t.feedback}</a>
      </footer>
    </>
  );
}
