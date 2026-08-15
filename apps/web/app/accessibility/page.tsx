import Link from "next/link";

export const metadata = { title: "Accessibility · Blorenge landscape explorer" };

export default function AccessibilityPage() {
  return (
    <main className="info-page">
      <p><Link href="/">← Back to the explorer</Link></p>
      <h1>Accessibility statement</h1>
      <p>This service is designed for keyboard use, readable reflow, accessible map controls and clear access to source information and downloadable data. We do not yet claim full WCAG 2.2 AA conformance.</p>
      <h2>What is available</h2>
      <ul>
        <li>labelled, keyboard-operable Map Tools and language controls;</li>
        <li>source status, provenance, licence and limitations through each layer’s information control;</li>
        <li>visible focus, colour-independent evidence labels and reduced-motion support;</li>
        <li>English navigation and evidence content, with verified Welsh for core controls and warnings; and</li>
        <li>a downloadable CSV of evidence-state counts and meanings.</li>
      </ul>
      <h2>Known limitations</h2>
      <ul>
        <li>Full independent WCAG 2.2 AA and assistive-technology audits have not yet been completed.</li>
        <li>Some provider names, legal titles and source metadata remain in English.</li>
        <li>The interactive map requires WebGL, and the service does not currently provide an equivalent non-map view of every layer and selection.</li>
      </ul>
      <p>Report an accessibility problem through the project’s <a href="https://github.com/timjroberts/bca_wales/issues/new">public contact route</a>. Do not include private or sensitive information.</p>
      <p><small>Published 14 August 2026. Service owner: Tim Roberts.</small></p>
    </main>
  );
}
