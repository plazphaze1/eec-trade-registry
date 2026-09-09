import type { Metadata } from "next";
import Link from "next/link";

import { CatalogueCard } from "@/components/catalogue-card";
import { CatalogueFilter } from "@/components/catalogue-filter";
import { CatalogueUnavailable } from "@/components/catalogue-unavailable";
import { EecHeroEmblem } from "@/components/eec-logo";
import { RelativeTime } from "@/components/relative-time";
import { UiIcon } from "@/components/ui-icon";
import {
  getPublicCatalogue,
  getPublicCatalogueCategories,
} from "@/lib/catalogue";
import { getDefaultLocale, getInstitutionName } from "@/lib/env";
import { parseCatalogueQuery } from "@/lib/query";

const CATALOGUE_PAGE_SIZE = 30;

function cataloguePageHref(
  page: number,
  query: { category: string | null; search: string | null },
) {
  const parameters = new URLSearchParams();
  if (query.search) parameters.set("q", query.search);
  if (query.category) parameters.set("category", query.category);
  if (page > 1) parameters.set("page", String(page));
  const suffix = parameters.toString();
  return suffix ? `/?${suffix}` : "/";
}

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
  const catalogueQuery = { category: query.category, page: 1, search: query.search };
  const [catalogueResult, categoriesResult] = await Promise.all([
    getPublicCatalogue(catalogueQuery),
    getPublicCatalogueCategories(),
  ]);
  const institutionName = getInstitutionName();
  const locale = getDefaultLocale();

  const categories = categoriesResult.ok ? categoriesResult.data : [];
  const generatedAt = catalogueResult.ok
    ? catalogueResult.data[0]?.generated_at ?? null
    : null;
  const totalItems = catalogueResult.ok ? catalogueResult.data.length : 0;
  const pageCount = Math.max(1, Math.ceil(totalItems / CATALOGUE_PAGE_SIZE));
  const currentPage = Math.min(query.page, pageCount);
  const pageStart = (currentPage - 1) * CATALOGUE_PAGE_SIZE;
  const visibleItems = catalogueResult.ok
    ? catalogueResult.data.slice(pageStart, pageStart + CATALOGUE_PAGE_SIZE)
    : [];
  const showPrice = catalogueResult.ok
    && catalogueResult.data.some((item) => item.price_amount_minor !== null);

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
        <EecHeroEmblem />
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
        ) : totalItems === 0 ? (
          <section className="empty-state" role="status">
            <p className="eyebrow">No matching records</p>
            <h2>No published goods match those filters.</h2>
            <p>Clear the filters or try a broader catalogue search.</p>
          </section>
        ) : (
          <>
            <p className="result-count" aria-live="polite">
              Showing {pageStart + 1}–{Math.min(pageStart + CATALOGUE_PAGE_SIZE, totalItems)} of {totalItems} published goods
            </p>
            <div className={`catalogue-list ${showPrice ? "" : "catalogue-list-no-price"}`}>
              <div className="catalogue-list-heading">
                <span>Product</span>
                {showPrice && <span>Price</span>}
                <span>Availability</span>
                <span />
              </div>
              {visibleItems.map((item) => (
                <CatalogueCard key={item.item_code} item={item} locale={locale} showPrice={showPrice} />
              ))}
            </div>
            {pageCount > 1 && <nav aria-label="Catalogue pages" className="catalogue-pagination">
              {currentPage > 1
                ? <Link className="button button-secondary" href={cataloguePageHref(currentPage - 1, query)}>← Previous</Link>
                : <span />}
              <span>Page {currentPage} of {pageCount}</span>
              {currentPage < pageCount
                ? <Link className="button button-secondary" href={cataloguePageHref(currentPage + 1, query)}>Next →</Link>
                : <span />}
            </nav>}
          </>
        )}
      </section>
    </main>
  );
}
