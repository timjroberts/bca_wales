import Link from "next/link";

export const metadata = { title: "Security · Blorenge landscape explorer" };

export default function SecurityPage() {
  return (
    <main className="info-page">
      <p><Link href="/">← Back to the explorer</Link></p>
      <h1>Security</h1>
      <p>This is a public, static, read-only service. It does not accept accounts, submissions or private datasets.</p>
      <p>For a suspected vulnerability, use the repository’s <a href="https://github.com/timjroberts/bca_wales/security/advisories/new">private vulnerability-reporting route</a>. Do not disclose exploitable details in a public issue.</p>
      <p>For non-sensitive service problems, use the <a href="https://github.com/timjroberts/bca_wales/issues/new">public issue route</a>.</p>
      <p><small>Service owner: Tim Roberts.</small></p>
    </main>
  );
}
