import Link from "next/link";

export const metadata = { title: "Privacy · Blorenge landscape explorer" };

export default function PrivacyPage() {
  return (
    <main className="info-page">
      <p><Link href="/">← Back to the explorer</Link></p>
      <h1>Privacy notice</h1>
      <p>The explorer is public and read-only. It has no accounts, analytics, advertising, fingerprinting, visitor submissions or client-side telemetry.</p>
      <h2>Information stored</h2>
      <p>The site stores one first-party <code>bca-language</code> cookie for up to one year so it can remember an English or Welsh preference. Map position, visible layers and observation selections stay in the page URL and are not sent to an analytics service.</p>
      <h2>Delivery information</h2>
      <p>Cloudflare necessarily processes limited request and security information to deliver the static site and evidence files over HTTPS. The operator uses only the provider’s minimum aggregate delivery and security information and does not add visitor tracking.</p>
      <p>Questions can be raised through the project’s <a href="https://github.com/timjroberts/bca_wales/issues/new">public contact route</a>. Do not post personal or sensitive information.</p>
      <p><small>Published 14 August 2026. Service owner: Tim Roberts.</small></p>
    </main>
  );
}
