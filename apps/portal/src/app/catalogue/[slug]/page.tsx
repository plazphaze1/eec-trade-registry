import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogueUnavailable } from "@/components/catalogue-unavailable";
import { RelativeTime } from "@/components/relative-time";
import { getPublicCatalogueItem } from "@/lib/catalogue";
import { getDefaultLocale } from "@/lib/env";
import { formatMinorAmount, formatQuantity } from "@/lib/format";

export const revalidate = 60;

interface CatalogueItemPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: CatalogueItemPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicCatalogueItem(slug);
  if (!result.ok || !result.data) {
    return {
      title: "Catalogue entry",
      description: "View current public trade terms and purchasing requirements from the authoritative registry.",
    };
  }

  return {
    title: result.data.display_name,
    description: result.data.description,
    openGraph: {
      description: result.data.description,
      title: result.data.display_name,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      description: result.data.description,
      title: result.data.display_name,
    },
  };
}

export default async function CatalogueItemPage({
  params,
}: CatalogueItemPageProps) {
  const { slug } = await params;
  const result = await getPublicCatalogueItem(slug);

  if (!result.ok) {
    return (
      <main className="detail-main">
        <CatalogueUnavailable notConfigured={result.code === "not_configured"} />
      </main>
    );
  }

  if (result.data === null) {
    notFound();
  }

  const item = result.data;
  const locale = getDefaultLocale();
  const price = formatMinorAmount(
    item.price_amount_minor,
    item.currency_symbol,
    item.currency_symbol_position,
    item.minor_unit_scale,
    locale,
  );
  const minimum = formatQuantity(
    item.bulk_minimum,
    item.unit_symbol,
    locale,
  );
  const increment = formatQuantity(
    item.order_increment,
    item.unit_symbol,
    locale,
  );

  return (
    <main className="detail-main">
      <Link className="back-link" href="/">
        <span aria-hidden="true">←</span> Return to catalogue
      </Link>

      <article className="registry-entry">
        <header>
          <p className="eyebrow">
            {item.category_name}
          </p>
          <h1>{item.display_name}</h1>
          <p className="registry-description">{item.description}</p>
        </header>

        <section className="entry-status" aria-label="Catalogue status">
          <div>
            <span>Price</span>
            <strong>{price ?? "Ask when ordering"}</strong>
            <p>The final total is shown before the order is submitted.</p>
          </div>
          <div>
            <span>Availability</span>
            <strong>{item.availability_label}</strong>
            <p>{item.availability_description}</p>
          </div>
          {item.control_code !== "ordinary-economic" && <div>
            <span>Additional requirements</span>
            <strong>{item.control_label}</strong>
            <p>{item.control_description}</p>
          </div>}
        </section>

        <section className="entry-requirements">
          <div>
            <p className="eyebrow">How to order</p>
            <h2>{item.requirement_summary}</h2>
          </div>
          <dl>
            {minimum && (
              <div>
                <dt>Minimum order</dt>
                <dd>{minimum}</dd>
              </div>
            )}
            {item.order_increment !== 1 && <div>
              <dt>Sold in amounts of</dt>
              <dd>{increment}</dd>
            </div>}
            <div>
              <dt>Sold as</dt>
              <dd>{item.unit_name}</dd>
            </div>
          </dl>
        </section>

        <section className="public-detail-actions" aria-label="Ordering options">
          <div>
            <h2>Ready to order?</h2>
            <p>Licensed businesses can sign in and order. New businesses can apply for a license.</p>
          </div>
          <div>
            <Link className="button button-primary" href="/dealer/login">Business sign in</Link>
            <Link className="button button-secondary" href="/apply">Get a trade license</Link>
          </div>
        </section>

        {item.tags.length > 0 && (
          <ul className="tag-list" aria-label="Catalogue tags">
            {item.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}

        <footer>
          <p>
            Updated <RelativeTime value={item.generated_at} />. Price and
            availability are confirmed when the order is placed.
          </p>
        </footer>
      </article>
    </main>
  );
}
