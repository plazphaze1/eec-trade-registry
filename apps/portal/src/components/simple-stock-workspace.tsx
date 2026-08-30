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
  const [editing, setEditing] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? items.filter((item) => item.name.toLocaleLowerCase().includes(query)) : items;
  }, [items, search]);
  const readyCount = items.filter((item) => item.available > 0).length;

  return (
    <section className="stock-storefront">
      <div className="stock-storefront-bar">
        <div className="stock-overview">
          <span><strong>{readyCount}</strong><small>ready now</small></span>
          <span><strong>{items.length - readyCount}</strong><small>need stock</small></span>
        </div>
        <label className="stock-search"><UiIcon name="search" size={19} /><span className="sr-only">Search stock</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Search stock…" type="search" value={search} /></label>
      </div>
      <div className="stock-card-grid">{filtered.map((item) => (
        <article className={`stock-card ${item.available > 0 ? "is-ready" : "is-empty"}`} key={item.id}>
          <div className="stock-card-icon"><UiIcon name={item.action === "asset" ? "key" : "box"} size={23} /></div>
          <div className="stock-card-copy"><h2>{item.name}</h2><p>{item.available > 0 ? "Ready to use" : item.action === "purchase" ? "Buy from a player to restock" : "No stock available"}</p></div>
          <div className="stock-card-count"><strong>{number(item.available)}</strong><span>{item.unit}</span></div>
          <div className="stock-card-prices">
            <span><small>Sale price</small><strong>{item.salePrice ? money(item.salePrice.amount, item.salePrice.currencyCode) : "Not published"}</strong></span>
            {item.buyingPrice && <span><small>Company pays</small><strong>{money(item.buyingPrice.amount, item.buyingPrice.currencyCode)}</strong></span>}
          </div>
          {item.action === "asset" ? <Link className="button button-secondary" href="/staff/assets">Open unique goods</Link> : (
            <button className="button button-primary" onClick={() => setEditing((current) => current === item.id ? null : item.id)} type="button">
              {editing === item.id ? "Close" : "Manage"}
            </button>
          )}

          {editing === item.id && item.action !== "asset" && (
            <div className="stock-card-editor">
              <section className="stock-editor-section">
                <div><span className="stock-editor-step">1</span><div><strong>Add stock</strong><small>{item.action === "purchase" ? "Record what a player sold to the Company." : "Enter the amount that arrived."}</small></div></div>
                {item.action === "receipt" && defaultReceiptLocationId && <form action={postInventoryReceiptAction} className="stock-inline-form">
                  <input name="item_id" type="hidden" value={item.id} />
                  <input name="source_reference" type="hidden" value="Routine staff stock intake" />
                  <input name="reason" type="hidden" value="Ordinary stock received and counted by staff." />
                  <input name="stock_location_id" type="hidden" value={defaultReceiptLocationId} />
                  <label className="field"><span>Quantity</span><div className="quantity-with-unit"><input autoFocus min="0.001" name="quantity" placeholder="0" required step="0.001" type="number" /><span>{item.unit}</span></div></label>
                  <button className="button button-primary" type="submit">Add</button>
                </form>}
                {item.action === "receipt" && !defaultReceiptLocationId && <p className="field-help">A stock location must be configured before goods can be received.</p>}

                {item.action === "purchase" && item.buyingPrice && (
                  <>
                    {item.buyingPrice.offerId && suppliers.length > 0 && defaultPurchaseLocationId ? <form action={recordDeliveryAction} className="stock-purchase-form">
                      <input name="return_to" type="hidden" value="/staff/inventory" />
                      <input name="offer_id" type="hidden" value={item.buyingPrice.offerId} />
                      <input name="stock_location_id" type="hidden" value={defaultPurchaseLocationId} />
                      <input name="reason" type="hidden" value="Player-supplied material counted and accepted from Stock and prices." />
                      {suppliers.length === 1 ? <input name="supplier_id" type="hidden" value={suppliers[0].id} /> : <label className="field"><span>Seller</span><select defaultValue="" name="supplier_id" required><option disabled value="">Choose seller</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>}
                      <label className="field"><span>Quantity</span><div className="quantity-with-unit"><input min="0.001" name="quantity" placeholder="0" required step="0.001" type="number" /><span>{item.unit}</span></div></label>
                      <button className="button button-primary" type="submit">Buy &amp; add</button>
                    </form> : item.buyingPrice.offerId === null ? <p className="stock-editor-hint">Set the Company buying price below, then this purchase box will be ready.</p> : suppliers.length === 0 && defaultSupplierSetup ? <form action={registerSupplierAction} className="stock-inline-form">
                      <input name="return_to" type="hidden" value="/staff/inventory" />
                      <input name="jurisdiction_id" type="hidden" value={defaultSupplierSetup.jurisdictionId} />
                      <input name="party_type_code" type="hidden" value={defaultSupplierSetup.partyTypeCode} />
                      <input name="display_name" type="hidden" value="" />
                      <input name="notes" type="hidden" value="" />
                      <input name="reason" type="hidden" value="Seller added from Stock and prices." />
                      <label className="field"><span>First seller</span><input maxLength={300} name="legal_name" placeholder="Player or organization" required /></label>
                      <button className="button button-secondary" type="submit">Save seller</button>
                    </form> : <p className="field-help">A receiving location must be configured before a purchase can be recorded.</p>}
                  </>
                )}
                {item.action === "purchase" && !item.buyingPrice && <p className="stock-editor-hint">Player-purchase controls are unavailable for your current assignment.</p>}
              </section>

              <section className="stock-editor-section">
                <div><span className="stock-editor-step">2</span><div><strong>Prices</strong><small>New prices affect future transactions only.</small></div></div>
                <div className="stock-price-forms">
                  {item.salePrice?.canEdit ? <form action={setInventorySalePriceAction} className="stock-price-form">
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
                    <label className="field"><span>Base selling price</span><div className="quantity-with-unit"><input aria-label={`${item.name} base selling price`} defaultValue={item.salePrice.amount ?? ""} min="0" name="price_amount_minor" placeholder="Enter price" required step="1" type="number" /><span>{item.salePrice.currencyCode}</span></div></label>
                    <button className="button button-secondary" type="submit">Update</button>
                  </form> : item.salePrice ? <p className="stock-editor-hint">Your current assignment can view this selling price but cannot change it.</p> : <p className="stock-editor-hint">Publish this item in <Link href="/staff/configuration">Products</Link> before setting its sale price.</p>}

                  {item.buyingPrice && <form action={setBuyingPriceAction} className="stock-price-form">
                    <input name="return_to" type="hidden" value="/staff/inventory" />
                    <input name="currency_id" type="hidden" value={item.buyingPrice.currencyId} />
                    <input name="item_id" type="hidden" value={item.id} />
                    <label className="field"><span>Company buying price</span><div className="quantity-with-unit"><input aria-label={`${item.name} Company buying price`} defaultValue={item.buyingPrice.amount ?? ""} min="1" name="amount_minor" placeholder="Enter price" required step="1" type="number" /><span>{item.buyingPrice.currencyCode}</span></div></label>
                    <button className="button button-secondary" type="submit">Update</button>
                  </form>}
                </div>
              </section>
            </div>
          )}
        </article>
      ))}</div>
      {filtered.length === 0 && <div className="empty-state"><h2>No matching item</h2><p>Try another name.</p></div>}
    </section>
  );
}
