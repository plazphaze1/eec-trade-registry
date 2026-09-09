"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  setBuyingPriceAction,
} from "@/app/staff/economy/actions";
import {
  postInventoryReceiptAction,
  setInventorySalePriceAction,
} from "@/app/staff/inventory/actions";
import { CommandRequestId } from "@/components/command-request-id";
import { UiIcon } from "@/components/ui-icon";

const STOCK_PAGE_SIZE = 40;
type StockView = "all" | "in_stock" | "missing_price" | "player_supplied";

type StockItem = {
  action: "asset" | "purchase" | "receipt";
  available: number;
  buyingPrice: {
    amount: number | null;
    currencyCode: string;
    currencyId: string;
    offerId: string | null;
  } | null;
  id: string;
  name: string;
  salePrice: {
    amount: number | null;
    availabilityProfileCode: string;
    bulkMinimum: number | null;
    controlProfileCode: string;
    currencyCode: string;
    orderIncrement: number;
    priceScheduleId: string;
    publicDescription: string;
    publicName: string;
    requirementSummary: string;
    canEdit: boolean;
  } | null;
  unit: string;
};

function number(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

function money(value: number | null, currency: string) {
  return value === null ? "Not set" : `${number(value)} ${currency}`;
}

function MoneyField({
  ariaLabel,
  currency,
  defaultValue,
  min,
  name,
}: {
  ariaLabel: string;
  currency: string;
  defaultValue: number | null;
  min: string;
  name: string;
}) {
  return (
    <div className="stock-sheet-input-unit">
      <input aria-label={ariaLabel} defaultValue={defaultValue ?? ""} min={min} name={name} placeholder="—" required step="1" type="number" />
      <span>{currency}</span>
    </div>
  );
}

function SalePriceCell({ item }: { item: StockItem }) {
  if (!item.salePrice) {
    return <div className="stock-sheet-cell-message"><span>Not published</span><Link href={`/staff/items/${item.id}/edit`}>Publish</Link></div>;
  }
  if (!item.salePrice.canEdit) {
    return <span className="stock-sheet-readonly-value">{money(item.salePrice.amount, item.salePrice.currencyCode)}</span>;
  }
  return (
    <form action={setInventorySalePriceAction} className="stock-sheet-price-form">
      <CommandRequestId />
      <input name="item_id" type="hidden" value={item.id} />
      <input name="availability_profile_code" type="hidden" value={item.salePrice.availabilityProfileCode} />
      <input name="bulk_minimum" type="hidden" value={item.salePrice.bulkMinimum ?? ""} />
      <input name="control_profile_code" type="hidden" value={item.salePrice.controlProfileCode} />
      <input name="order_increment" type="hidden" value={item.salePrice.orderIncrement} />
      <input name="price_action" type="hidden" value="set" />
      <input name="price_schedule_id" type="hidden" value={item.salePrice.priceScheduleId} />
      <input name="public_description" type="hidden" value={item.salePrice.publicDescription} />
      <input name="public_name" type="hidden" value={item.salePrice.publicName} />
      <input name="publish" type="hidden" value="on" />
      <input name="reason" type="hidden" value={`Base selling price updated for ${item.name} from Stock and prices.`} />
      <input name="requirement_summary" type="hidden" value={item.salePrice.requirementSummary} />
      <MoneyField ariaLabel={`${item.name} selling price`} currency={item.salePrice.currencyCode} defaultValue={item.salePrice.amount} min="0" name="price_amount_minor" />
      <button aria-label={`Save ${item.name} selling price`} className="button button-secondary button-compact stock-sheet-save" title="Save selling price" type="submit">Save</button>
    </form>
  );
}

function BuyingPriceCell({ item }: { item: StockItem }) {
  if (!item.buyingPrice) return <span className="stock-sheet-muted">Not applicable</span>;
  return (
    <form action={setBuyingPriceAction} className="stock-sheet-price-form">
      <CommandRequestId />
      <input name="return_to" type="hidden" value="/staff/inventory" />
      <input name="currency_id" type="hidden" value={item.buyingPrice.currencyId} />
      <input name="item_id" type="hidden" value={item.id} />
      <MoneyField ariaLabel={`${item.name} Company buying price`} currency={item.buyingPrice.currencyCode} defaultValue={item.buyingPrice.amount} min="1" name="amount_minor" />
      <button aria-label={`Save ${item.name} Company buying price`} className="button button-secondary button-compact stock-sheet-save" title="Save Company buying price" type="submit">Save</button>
    </form>
  );
}

function StockIntakeCell({
  defaultReceiptLocationId,
  item,
}: {
  defaultReceiptLocationId: string | null;
  item: StockItem;
}) {
  if (item.action === "asset") {
    return <Link className="stock-sheet-text-link" href="/staff/assets">Open unique goods</Link>;
  }
  if (item.action === "receipt") {
    if (!defaultReceiptLocationId) return <span className="stock-sheet-muted">Receiving location needed</span>;
    return (
      <form action={postInventoryReceiptAction} className="stock-sheet-intake-form">
        <CommandRequestId />
        <input name="item_id" type="hidden" value={item.id} />
        <input name="source_reference" type="hidden" value="Routine staff stock intake" />
        <input name="reason" type="hidden" value="Ordinary stock received and counted by staff." />
        <input name="stock_location_id" type="hidden" value={defaultReceiptLocationId} />
        <div className="stock-sheet-input-unit">
          <input aria-label={`Quantity of ${item.name} to add`} min="0.001" name="quantity" placeholder="0" required step="0.001" type="number" />
          <span>{item.unit}</span>
        </div>
        <button className="button button-primary button-compact" type="submit">Add</button>
      </form>
    );
  }
  return <Link className="button button-primary button-compact" href={`/staff/activity?mode=purchase&item=${item.id}`}>Record purchase</Link>;
}

export function SimpleStockWorkspace({
  defaultReceiptLocationId,
  initialSearch,
  items,
}: {
  defaultReceiptLocationId: string | null;
  initialSearch?: string;
  items: StockItem[];
}) {
  const [search, setSearch] = useState(initialSearch ?? "");
  const [view, setView] = useState<StockView>("all");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return items
      .filter((item) => !query || item.name.toLocaleLowerCase().includes(query))
      .filter((item) => {
        if (view === "in_stock") return item.available > 0;
        if (view === "missing_price") return item.salePrice !== null && item.salePrice.amount === null;
        if (view === "player_supplied") return item.action === "purchase";
        return true;
      })
      .sort((left, right) => {
        const leftRank = left.available > 0 ? 0 : left.salePrice?.amount !== null && left.salePrice?.amount !== undefined ? 1 : left.action === "purchase" ? 2 : 3;
        const rightRank = right.available > 0 ? 0 : right.salePrice?.amount !== null && right.salePrice?.amount !== undefined ? 1 : right.action === "purchase" ? 2 : 3;
        return leftRank - rightRank || left.name.localeCompare(right.name);
      });
  }, [items, search, view]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / STOCK_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * STOCK_PAGE_SIZE, currentPage * STOCK_PAGE_SIZE);
  const readyCount = items.filter((item) => item.available > 0).length;
  return (
    <section className="stock-storefront">
      <div className="stock-storefront-bar">
        <div className="stock-overview">
          <span><strong>{items.length}</strong><small>items</small></span>
          <span><strong>{readyCount}</strong><small>in stock</small></span>
          <span><strong>{items.length - readyCount}</strong><small>out of stock</small></span>
        </div>
        <div className="stock-storefront-controls">
          <label className="stock-view"><span className="sr-only">Filter items</span><select onChange={(event) => { setView(event.target.value as StockView); setPage(1); }} value={view}><option value="all">All items</option><option value="in_stock">In stock</option><option value="missing_price">Needs selling price</option><option value="player_supplied">Player supplied</option></select></label>
          <label className="stock-search"><UiIcon name="search" size={19} /><span className="sr-only">Search stock</span><input onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Find an item…" type="search" value={search} /></label>
        </div>
      </div>

      <div className="stock-result-summary"><span>{filtered.length ? `Showing ${(currentPage - 1) * STOCK_PAGE_SIZE + 1}–${Math.min(currentPage * STOCK_PAGE_SIZE, filtered.length)} of ${filtered.length}` : "No matching items"}</span><span>In-stock and configured goods appear first.</span></div>

      <p className="stock-sheet-mobile-hint">Swipe sideways to edit stock and prices →</p>
      <div className="stock-sheet-scroll">
        <div aria-label="Stock and prices" className="stock-sheet-table" role="table">
          <div className="stock-sheet-header" role="row">
            <span role="columnheader">Item</span>
            <span role="columnheader">Available</span>
            <span role="columnheader">Add stock</span>
            <span role="columnheader">Selling price</span>
            <span role="columnheader">Company pays</span>
            <span aria-label="Item settings" role="columnheader" />
          </div>
          <div role="rowgroup">
            {visible.map((item) => (
              <div className={`stock-sheet-row ${item.available > 0 ? "is-ready" : "is-empty"}`} key={item.id} role="row">
                <div className="stock-sheet-product stock-sheet-cell" data-label="Item" role="cell">
                  <span className="stock-sheet-product-icon"><UiIcon name={item.action === "asset" ? "key" : "box"} size={19} /></span>
                  <span><strong>{item.name}</strong><small>{item.action === "asset" ? "Unique good" : item.action === "purchase" ? "Player supplied" : "Ordinary stock"}</small></span>
                </div>
                <div className="stock-sheet-available stock-sheet-cell" data-label="Available" role="cell"><strong>{number(item.available)}</strong><small>{item.unit}</small></div>
                <div className="stock-sheet-cell stock-sheet-action-cell" data-label="Add stock" role="cell"><StockIntakeCell defaultReceiptLocationId={defaultReceiptLocationId} item={item} /></div>
                <div className="stock-sheet-cell stock-sheet-price-cell" data-label="Selling price" role="cell"><SalePriceCell item={item} /></div>
                <div className="stock-sheet-cell stock-sheet-price-cell" data-label="Company pays" role="cell"><BuyingPriceCell item={item} /></div>
                <div className="stock-sheet-cell stock-sheet-row-action" data-label="Settings" role="cell">
                  <Link aria-label={`Edit ${item.name}`} className="button button-secondary button-compact" href={item.action === "asset" ? "/staff/assets" : `/staff/items/${item.id}/edit`}><UiIcon name="gear" size={17} /><span>Edit</span></Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {pageCount > 1 && <nav aria-label="Stock pages" className="stock-pagination"><button className="button button-secondary button-compact" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">← Previous</button><span>Page {currentPage} of {pageCount}</span><button className="button button-secondary button-compact" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} type="button">Next →</button></nav>}
      {filtered.length === 0 && <div className="empty-state"><h2>No matching item</h2><p>Try another name.</p></div>}
    </section>
  );
}
