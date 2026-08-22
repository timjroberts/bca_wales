"use client";

import { useEffect, useMemo, useState } from "react";
import type { Language } from "@bca/domain";
import type { ActiveFireFeatureCollection, ActiveFireObservation, ActiveFireState } from "./activeFire";

type TimeWindow = "24h" | "7d" | "30d";

function formatTime(value: string | null, language: Language, empty: "unavailable" | "no-observation" = "unavailable"): string {
  if (!value) {
    if (empty === "no-observation") return language === "en" ? "No observation in the retained history" : "Dim arsylwad yn yr hanes a gedwir";
    return language === "en" ? "Not available" : "Ddim ar gael";
  }
  const date = new Date(value);
  return `${new Intl.DateTimeFormat(language === "en" ? "en-GB" : "cy-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London"
  }).format(date)} (${date.toISOString().replace("T", " ").replace(".000Z", " UTC")})`;
}

function toFeatureCollection(observations: readonly ActiveFireObservation[]): ActiveFireFeatureCollection {
  return {
    type: "FeatureCollection",
    features: observations.map((observation) => ({
      type: "Feature",
      id: observation.observation_key,
      geometry: { type: "Point", coordinates: [observation.longitude, observation.latitude] },
      properties: Object.fromEntries(Object.entries(observation).filter(([key]) => !["latitude", "longitude"].includes(key))) as ActiveFireFeatureCollection["features"][number]["properties"]
    }))
  };
}

export function ActiveFirePanel({
  feed,
  language,
  visible,
  onMapOverride
}: {
  feed: ActiveFireState;
  language: Language;
  visible: boolean;
  onMapOverride: (map: ActiveFireFeatureCollection | null) => void;
}) {
  const [sensor, setSensor] = useState("all");
  const [confidence, setConfidence] = useState("all");
  const [daynight, setDaynight] = useState("all");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("7d");
  const [showHistory, setShowHistory] = useState(false);
  const copy = language === "en" ? {
    heading: "Recent satellite thermal anomalies",
    loading: "Checking the operational feed…",
    current: "Current — both NOAA sources completed within 12 hours.",
    degraded: "Degraded — only one NOAA source completed. An empty result is not reassuring in this state.",
    stale: "Stale — neither a complete two-source refresh nor its healthy status is current.",
    outage: "Outage — the latest attempt failed; the last verified pointer and history are retained.",
    withdrawn: "Withdrawn — operational observations are not being shown.",
    error: "Unavailable — the feed or one of its verified assets could not be loaded.",
    published: "Feed publication",
    complete: "Last complete refresh",
    latest: "Latest source observation",
    window: "24-hour map",
    history: "30-day history",
    hidden: "Old points are hidden because there has been no complete refresh for 24 hours.",
    safety: "A point is the centre of a nominal approximately 375 m observation pixel. It is not a verified incident, exact fire location or perimeter, warning, severity measure or forecast. Absence of detections is not evidence that no fire exists. Do not travel to investigate; report immediate danger through 999 or 112.",
    filters: "Filter accessible history",
    sensor: "Sensor",
    confidence: "Algorithmic confidence",
    daynight: "Day or night",
    period: "Period",
    all: "All",
    day: "Day",
    night: "Night",
    mapHistory: "Show this filtered history on the map",
    mapHistoryWarning: "History is opt-in and may include points older than 24 hours.",
    time: "Observed (UK local and UTC)",
    frp: "FRP (MW)",
    noRows: "No observations match these filters. This does not mean there was no fire.",
    download: "Download the complete accessible 30-day history (CSV)",
    explanations: "Confidence is an algorithmic class. FRP is instantaneous pixel-integrated radiative power; neither confirms a fire or measures temperature, burned area, severity or forecast risk."
  } : {
    heading: "Anomaleddau thermol lloeren diweddar",
    loading: "Wrthi’n gwirio’r ffrwd weithredol…",
    current: "Cyfredol — cwblhaodd y ddwy ffynhonnell NOAA o fewn 12 awr.",
    degraded: "Diraddedig — dim ond un ffynhonnell NOAA a gwblhaodd. Nid yw canlyniad gwag yn galonogol yn y cyflwr hwn.",
    stale: "Hen — nid yw adnewyddiad dwy ffynhonnell gyflawn na’i statws iach yn gyfredol.",
    outage: "Toriad — methodd yr ymgais ddiweddaraf; cedwir y pwyntydd a’r hanes diwethaf a wiriwyd.",
    withdrawn: "Wedi’i dynnu’n ôl — nid yw arsylwadau gweithredol yn cael eu dangos.",
    error: "Ddim ar gael — ni ellid llwytho’r ffrwd nac un o’i hasedau wedi’u gwirio.",
    published: "Cyhoeddiad y ffrwd",
    complete: "Adnewyddiad cyflawn diwethaf",
    latest: "Arsylwad ffynhonnell diweddaraf",
    window: "Map 24 awr",
    history: "Hanes 30 diwrnod",
    hidden: "Mae hen bwyntiau wedi’u cuddio am na fu adnewyddiad cyflawn ers 24 awr.",
    safety: "Canol picsel arsylwi enwol tua 375 m yw pwynt. Nid digwyddiad wedi’i gadarnhau, union leoliad tân na therfyn, rhybudd, mesur difrifoldeb na rhagolwg ydyw. Nid yw diffyg canfyddiadau’n dystiolaeth nad oes tân. Peidiwch â theithio i ymchwilio; rhowch wybod am berygl uniongyrchol drwy 999 neu 112.",
    filters: "Hidlo’r hanes hygyrch",
    sensor: "Synhwyrydd",
    confidence: "Hyder algorithmig",
    daynight: "Dydd neu nos",
    period: "Cyfnod",
    all: "Pob un",
    day: "Dydd",
    night: "Nos",
    mapHistory: "Dangos yr hanes hidledig hwn ar y map",
    mapHistoryWarning: "Mae hanes yn ddewisol a gall gynnwys pwyntiau sy’n hŷn na 24 awr.",
    time: "Arsylwyd (amser lleol y DU ac UTC)",
    frp: "FRP (MW)",
    noRows: "Nid oes arsylwadau’n cyfateb i’r hidlwyr hyn. Nid yw hyn yn golygu nad oedd tân.",
    download: "Lawrlwytho’r hanes hygyrch 30 diwrnod cyflawn (CSV)",
    explanations: "Dosbarth algorithmig yw hyder. Pŵer pelydrol integredig picsel ar unwaith yw FRP; nid yw’r naill na’r llall yn cadarnhau tân nac yn mesur tymheredd, arwynebedd wedi’i losgi, difrifoldeb na risg rhagolwg."
  };

  const filtered = useMemo(() => {
    const hours = timeWindow === "24h" ? 24 : timeWindow === "7d" ? 7 * 24 : 30 * 24;
    const newest = new Date(feed.publishedAt ?? feed.history.at(-1)?.observed_at ?? "1970-01-01T00:00:00Z").getTime();
    const cutoff = newest - hours * 60 * 60 * 1000;
    return feed.history.filter((observation) =>
      new Date(observation.observed_at).getTime() >= cutoff &&
      (sensor === "all" || observation.sensor === sensor) &&
      (confidence === "all" || observation.confidence === confidence) &&
      (daynight === "all" || observation.daynight === daynight)
    );
  }, [confidence, daynight, feed.history, feed.publishedAt, sensor, timeWindow]);

  useEffect(() => {
    onMapOverride(showHistory && visible ? toFeatureCollection(filtered) : null);
  }, [filtered, onMapOverride, showHistory, visible]);

  if (!visible) return null;
  const healthMessage = copy[feed.health];
  const healthyEmpty = feed.health === "current" && feed.counts.map24h === 0
    ? feed.contract?.healthy_empty_message?.[language]
    : null;

  return (
    <section className={`active-fire-panel active-fire-${feed.health}`} aria-labelledby="active-fire-heading" aria-live="polite">
      <div className="active-fire-heading">
        <div>
          <p className="panel-kicker">NASA FIRMS · NOAA-21 / NOAA-20</p>
          <h2 id="active-fire-heading">{copy.heading}</h2>
        </div>
        <span className={`feed-status feed-status-${feed.health}`}>{feed.health}</span>
      </div>
      <p className="feed-health-message">{healthMessage}{feed.error ? ` ${feed.error}` : ""}</p>
      {feed.health !== "loading" ? (
        <dl className="feed-times">
          <div><dt>{copy.published}</dt><dd>{formatTime(feed.publishedAt, language)}</dd></div>
          <div><dt>{copy.complete}</dt><dd>{formatTime(feed.lastCompleteSuccessAt, language)}</dd></div>
          <div><dt>{copy.latest}</dt><dd>{formatTime(feed.latestObservationAt, language, "no-observation")}</dd></div>
          <div><dt>{copy.window}</dt><dd>{feed.counts.map24h} {language === "en" ? "observations" : "arsylwad"}</dd></div>
          <div><dt>{copy.history}</dt><dd>{feed.counts.history30d} {language === "en" ? "observations" : "arsylwad"}</dd></div>
        </dl>
      ) : null}
      {healthyEmpty ? <p className="healthy-empty">{healthyEmpty}</p> : null}
      {!feed.mapVisible && ["stale", "outage"].includes(feed.health) ? <p className="feed-warning">{copy.hidden}</p> : null}
      <p className="feed-safety">{copy.safety}</p>

      {feed.health !== "loading" && feed.health !== "withdrawn" && feed.health !== "error" ? (
        <details className="active-fire-history">
          <summary><strong>{copy.filters}</strong><span>{filtered.length}/{feed.history.length}</span></summary>
          <div className="history-filters">
            <label>{copy.sensor}<select value={sensor} onChange={(event) => setSensor(event.target.value)}><option value="all">{copy.all}</option><option value="NOAA-21">NOAA-21</option><option value="NOAA-20">NOAA-20</option></select></label>
            <label>{copy.confidence}<select value={confidence} onChange={(event) => setConfidence(event.target.value)}><option value="all">{copy.all}</option><option value="low">low</option><option value="nominal">nominal</option><option value="high">high</option></select></label>
            <label>{copy.daynight}<select value={daynight} onChange={(event) => setDaynight(event.target.value)}><option value="all">{copy.all}</option><option value="D">{copy.day}</option><option value="N">{copy.night}</option></select></label>
            <label>{copy.period}<select value={timeWindow} onChange={(event) => setTimeWindow(event.target.value as TimeWindow)}><option value="24h">24 hours</option><option value="7d">7 days</option><option value="30d">30 days</option></select></label>
          </div>
          <label className="history-map-toggle"><input type="checkbox" checked={showHistory} onChange={(event) => setShowHistory(event.target.checked)} /> <strong>{copy.mapHistory}</strong></label>
          {showHistory ? <p className="feed-warning">{copy.mapHistoryWarning}</p> : null}
          <p className="history-explanation">{copy.explanations}</p>
          <div className="history-table-wrap" tabIndex={0}>
            <table>
              <caption className="sr-only">{copy.heading} — {copy.history}</caption>
              <thead><tr><th>{copy.time}</th><th>{copy.sensor}</th><th>{copy.confidence}</th><th>{copy.frp}</th><th>{copy.daynight}</th></tr></thead>
              <tbody>{filtered.map((observation) => <tr key={observation.observation_key}><td>{formatTime(observation.observed_at, language)}</td><td>{observation.sensor}</td><td>{observation.confidence}</td><td>{observation.frp_mw}</td><td>{observation.daynight === "D" ? copy.day : copy.night}</td></tr>)}</tbody>
            </table>
          </div>
          {filtered.length === 0 ? <p>{copy.noRows}</p> : null}
          {feed.accessibleTableUrl ? <p><a className="download-link" href={feed.accessibleTableUrl}>{copy.download}</a></p> : null}
        </details>
      ) : null}
    </section>
  );
}
