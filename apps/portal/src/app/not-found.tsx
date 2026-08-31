import Link from "next/link";

export default function NotFound() {
  return (
    <main className="detail-main">
      <section className="notice-panel">
        <p className="eyebrow">Nothing here</p>
        <h1>Page not found.</h1>
        <p>
          The address may be incorrect, or the page may have moved.
        </p>
        <Link className="button button-primary" href="/">
          Go to the catalogue
        </Link>
      </section>
    </main>
  );
}
