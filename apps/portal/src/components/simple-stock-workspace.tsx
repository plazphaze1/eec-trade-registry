"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  recordDeliveryAction,
  registerSupplierAction,
  setBuyingPriceAction,
} from "@/app/staff/economy/actions";
import {
  postInventoryReceiptAction,
  setInventorySalePriceAction,
} from "@/app/staff/inventory/actions";
import { UiIcon } from "@/components/ui-icon";

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

type Supplier = { id: string; name: string };

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
    return <div className="stock-sheet-cell-message"><span>Not published</span><Link href="/staff/configuration">Publish</Link></div>;
  }
  if (!item.salePrice.canEdit) {
    return <span className="stock-sheet-readonly-value">{money(item.salePrice.amount, item.salePrice.currencyCode)}</span>;
  }
  return (
    <form action={setInventorySalePriceAction} className="stock-sheet-price-form">
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
      <input name="return_to" type="hidden" value="/staff/inventory" />
      <input name="currency_id" type="hidden" value={item.buyingPrice.currencyId} />
      <input name="item_id" type="hidden" value={item.id} />
      <MoneyField ariaLabel={`${item.name} Company buying price`} currency={item.buyingPrice.currencyCode} defaultValue={item.buyingPrice.amount} min="1" name="amount_minor" />
      <button aria-label={`Save ${item.name} Company buying price`} className="button button-secondary button-compact stock-sheet-save" title="Save Company buying price" type="submit">Save</button>
    </form>
  );
}

function StockIntakeCell({
  defaultPurchaseLocationId,
  defaultReceiptLocationId,
  item,
  suppliers,
}: {
  defaultPurchaseLocationId: string | null;
  defaultReceiptLocationId: string | null;
  item: StockItem;
  suppliers: Supplier[];
}) {
  if (item.action === "asset") {
    return <Link className="stock-sheet-text-link" href="/staff/assets">Open unique goods</Link>;
  }
  if (item.action === "receipt") {
    if (!defaultReceiptLocationId) return <span className="stock-sheet-muted">Receiving location needed</span>;
    return (
      <form action={postInventoryReceiptAction} className="stock-sheet-intake-form">
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
  if (!item.buyingPrice?.offerId) return <span className="stock-sheet-muted">Set buying price first</span>;
  if (suppliers.length === 0) return <span className="stock-sheet-muted">Add the first seller above</span>;
  if (!defaultPurchaseLocationId) return <span className="stock-sheet-muted">Receiving location needed</span>;
  return (
    <form action={recordDeliveryAction} className={`stock-sheet-intake-form ${suppliers.length > 1 ? "has-seller" : ""}`}>
      <input name="return_to" type="hidden" value="/staff/inventory" />
      <input name="offer_id" type="hidden" value={item.buyingPrice.offerId} />
      <input name="stock_location_id" type="hidden" value={defaultPurchaseLocationId} />
      <input name="reason" type="hidden" value="Player-supplied material counted and accepted from Stock and prices." />
      {suppliers.length === 1
        ? <input name="supplier_id" type="hidden" value={suppliers[0].id} />
        : <select aria-label={`Seller of ${item.name}`} defaultValue="" name="supplier_id" required><option disabled value="">Seller</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>}
      <div className="stock-sheet-input-unit">
        <input aria-label={`Quantity of ${item.name} purchased`} min="0.001" name="quantity" placeholder="0" required step="0.001" type="number" />
        <span>{item.unit}</span>
      </div>
      <button className="button button-primary button-compact" type="submit">Buy + add</button>
    </form>
  );
}

export function SimpleStockWorkspace({
  defaultPurchaseLocationId,
  defaultReceiptLocationId,
  defaultSupplierSetup,
  items,
  suppliers,
}: {
  defaultPurchaseLocationId: string | null;
  defaultReceiptLocationId: string | null;
  defaultSupplierSetup: {
    jurisdictionId: string;
    partyTypeCode: string;
  } | null;
  items: StockItem[];
  suppliers: Supplier[];
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? items.filter((item) => item.name.toLocaleLowerCase().includes(query)) : items;
  }, [items, search]);
  const readyCount = items.filter((item) => item.available > 0).length;
  const needsFirstSeller = suppliers.length === 0 && items.some((item) => item.action === "purchase");

  return (
    <section className="stock-storefront">
      <div className="stock-storefront-bar">
        <div className="stock-overview">
          <span><strong>{items.length}</strong><small>items</small></span>
          <span><strong>{readyCount}</strong><small>in stock</small></span>
          <span><strong>{items.length - readyCount}</strong><small>out of stock</small></span>
        </div>
        <label className="stock-search"><UiIcon name="search" size={19} /><span className="sr-only">Search stock</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Find an item…" type="search" value={search} /></label>
      </div>

      {needsFirstSeller && defaultSupplierSetup && (
        <div className="stock-sheet-setup">
          <div><strong>Add your first seller</strong><span>This is needed once before player materials can be received.</span></div>
          <form action={registerSupplierAction}>
            <input name="return_to" type="hidden" value="/staff/inventory" />
            <input name="jurisdiction_id" type="hidden" value={defaultSupplierSetup.jurisdictionId} />
            <input name="party_type_code" type="hidden" value={defaultSupplierSetup.partyTypeCode} />
            <input name="display_name" type="hidden" value="" />
            <input name="notes" type="hidden" value="" />
            <input name="reason" type="hidden" value="Seller added from Stock and prices." />
            <input aria-label="First seller name" maxLength={300} name="legal_name" placeholder="Player or organization" required />
            <button className="button button-secondary button-compact" type="submit">Add seller</button>
          </form>
        </div>
      )}

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
            {filtered.map((item) => (
              <div className={`stock-sheet-row ${item.available > 0 ? "is-ready" : "is-empty"}`} key={item.id} role="row">
                <div className="stock-sheet-product stock-sheet-cell" data-label="Item" role="cell">
                  <span className="stock-sheet-product-icon"><UiIcon name={item.action === "asset" ? "key" : "box"} size={19} /></span>
                  <span><strong>{item.name}</strong><small>{item.action === "asset" ? "Unique good" : item.action === "purchase" ? "Player supplied" : "Ordinary stock"}</small></span>
                </div>
                <div className="stock-sheet-available stock-sheet-cell" data-label="Available" role="cell"><strong>{number(item.available)}</strong><small>{item.unit}</small></div>
                <div className="stock-sheet-cell stock-sheet-action-cell" data-label="Add stock" role="cell"><StockIntakeCell defaultPurchaseLocationId={defaultPurchaseLocationId} defaultReceiptLocationId={defaultReceiptLocationId} item={item} suppliers={suppliers} /></div>
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
      {filtered.length === 0 && <div className="empty-state"><h2>No matching item</h2><p>Try another name.</p></div>}
    </section>
  );
}
