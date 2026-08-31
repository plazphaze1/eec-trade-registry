import Link from "next/link";

import type { PublicCatalogueItem } from "@/lib/catalogue";
import { formatMinorAmount, formatQuantity } from "@/lib/format";

interface CatalogueCardProps {
  item: PublicCatalogueItem;
  locale: string;
}

export function CatalogueCard({ item, locale }: CatalogueCardProps) {
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

  return (
    <article className="catalogue-list-item">
      <div className="catalogue-list-product">
        <span className="product-category">{item.category_name}</span>
        <h2 className="product-name">
          <Link href={`/catalogue/${item.slug}`}>{item.display_name}</Link>
        </h2>
        <p>{item.description}</p>
      </div>

      <div className="catalogue-list-fact">
        <span>Price</span>
        <strong>{price ?? "By request"}</strong>
        {minimum && <small>Minimum {minimum}</small>}
      </div>

      <div className="catalogue-list-fact">
        <span>Availability</span>
        <strong>{item.availability_label}</strong>
      </div>

      <Link aria-label={`View ${item.display_name}`} className="button button-secondary button-compact catalogue-list-action" href={`/catalogue/${item.slug}`}>
        View <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
