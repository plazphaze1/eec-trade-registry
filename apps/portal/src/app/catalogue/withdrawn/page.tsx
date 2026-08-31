import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Catalogue entry withdrawn",
  description:
    "This East Empire Company catalogue entry has been formally withdrawn from public trade.",
  robots: { follow: false, index: false },
};

export default function WithdrawnCataloguePage() {
  return (
    <main className="detail-main">
      <Link className="back-link" href="/">
        ← Return to catalogue
      </Link>
      <section className="notice-panel withdrawn-entry">
        <p className="eyebrow">No longer available</p>
        <h1>This item has been withdrawn.</h1>
        <p>
          The East Empire Company no longer offers this item. Return to the
          catalogue to see what is currently available.
        </p>
      </section>
    </main>
  );
}
