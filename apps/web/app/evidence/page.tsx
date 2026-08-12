import { EMPTY_PUBLICATION } from "@bca/publication";
import Link from "next/link";

export const metadata = {
  title: "Evidence · Blorenge landscape explorer"
};

export default function EvidencePage() {
  return (
    <main>
      <p className="eyebrow">Non-map evidence view</p>
      <h1>Blorenge evidence</h1>
      <section aria-labelledby="release-heading">
        <h2 id="release-heading">Current publication</h2>
        <p>{EMPTY_PUBLICATION.message}</p>
        <p>
          This production shell contains no illustrative prototype geometry or evidence values.
        </p>
      </section>
      <p>
        <Link href="/">Return to the explorer</Link>
      </p>
    </main>
  );
}
