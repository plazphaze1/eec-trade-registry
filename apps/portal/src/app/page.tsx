import type { Metadata } from "next";
import Link from "next/link";

import { CatalogueCard } from "@/components/catalogue-card";
import { CatalogueFilter } from "@/components/catalogue-filter";
import { CatalogueUnavailable } from "@/components/catalogue-unavailable";
import { EecHeroEmblem } from "@/components/eec-seal";
import { RelativeTime } from "@/components/relative-time";
import { UiIcon } from "@/components/ui-icon";
import {
  getPublicCatalogue,
  getPublicCatalogueCategories,
} from "@/lib/catalogue";
import { getDefaultLocale, getInstitutionName } from "@/lib/env";
import { parseCatalogueQuery } from "@/lib/query";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Trade catalogue",
  description: "Browse East Empire Company goods, current prices, availability, and ordering requirements.",
};

interface CataloguePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CataloguePage({
  searchParams,
}: CataloguePageProps) {
  const query = parseCatalogueQuery(await searchParams);
  const [catalogueResult, categoriesResult] = await Promise.all([
    getPublicCatalogue(query),
    getPublicCatalogueCategories(),
  ]);
  const institutionName = getInstitutionName();
  const locale = getDefaultLocale();

  const categories = categoriesResult.ok ? categoriesResult.data : [];
  const generatedAt = catalogueResult.ok
    ? catalogueResult.data[0]?.generated_at ?? null
    : null;

  return (
    <main>
      <section className="hero catalogue-hero">
        <div>
          <p className="eyebrow">East Empire Company marketplace</p>
          <h1>Find what you need.</h1>
          <p className="hero-copy">
            Browse everything {institutionName} buys and sells. Prices,
            availability, and business requirements are shown in plain language.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#catalogue-title">
              <UiIcon name="search" /> Start shopping
            </a>
            <Link className="button button-secondary" href="/how-it-works">
              <UiIcon name="spark" /> How it works
            </Link>
            <Link className="button button-secondary" href="/verify">
              <UiIcon name="shield" /> Check a license
            </Link>
            <Link className="text-link hero-quiet-link" href="/apply">
              Need a business license? <UiIcon name="arrow" size={15} />
            </Link>
          </div>
        </div>
        <EecHeroEmblem institutionName={institutionName} />
      </section>

      <section className="catalogue-shell" aria-labelledby="catalogue-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Browse all goods</p>
            <h2 id="catalogue-title">Shop the catalogue</h2>
          </div>
          {generatedAt && <p>Updated <RelativeTime value={generatedAt} /></p>}
        </div>

        <CatalogueFilter categories={categories} query={query} />

        {!catalogueResult.ok ? (
          <CatalogueUnavailable
            notConfigured={catalogueResult.code === "not_configured"}
          />
        ) : catalogueResult.data.length === 0 ? (
          <section className="empty-state" role="status">
            <p className="eyebrow">No matching records</p>
            <h2>No published goods match those filters.</h2>
            <p>Clear the filters or try a broader catalogue search.</p>
          </section>
        ) : (
          <>
            <p className="result-count" aria-live="polite">
              {catalogueResult.data.length} published
              {catalogueResult.data.length === 1 ? " entry" : " entries"}
            </p>
            <div className="catalogue-list">
              <div className="catalogue-list-heading">
                <span>Product</span>
                <span>Price</span>
                <span>Availability</span>
                <span />
              </div>
              {catalogueResult.data.map((item) => (
                <CatalogueCard key={item.item_code} item={item} locale={locale} />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
