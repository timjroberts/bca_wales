import { PRODUCT_SCOPE } from "@bca/domain";
import { EMPTY_PUBLICATION } from "@bca/publication";
import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <p className="eyebrow">Bannau Brycheiniog · Brecon Beacons</p>
      <h1>Blorenge landscape explorer</h1>
      <p className="lede">{PRODUCT_SCOPE}</p>
      <section aria-labelledby="release-heading">
        <h2 id="release-heading">Evidence release</h2>
        <p>{EMPTY_PUBLICATION.message}</p>
        <p>
          <Link href="/evidence/">Read the evidence view</Link>
        </p>
      </section>
    </main>
  );
}
