"use client";

import { useMemo, useState } from "react";

import { recordDeliveryAction, registerSupplierAction } from "@/app/staff/economy/actions";
import type { EconomyWorkspace } from "@/lib/economy";
import { REGISTRY_CONFIG } from "@/lib/registry-config";

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

export function GuidedMaterialPurchaseForm({ workspace }: { workspace: EconomyWorkspace }) {
  const offers = useMemo(() => workspace.offers.filter((offer) => offer.is_current), [workspace.offers]);
  const suppliers = useMemo(() => workspace.suppliers.filter((supplier) => supplier.status === "active"), [workspace.suppliers]);
  const locations = useMemo(() => workspace.warehouses.flatMap((warehouse) => warehouse.locations
    .filter((location) => location.location_type === "receiving")
    .map((location) => ({ ...location, warehouseName: warehouse.display_name }))), [workspace.warehouses]);
  const [offerId, setOfferId] = useState(offers[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const offer = offers.find((candidate) => candidate.id === offerId) ?? offers[0];
  const numericQuantity = Number(quantity);
  const total = offer && Number.isFinite(numericQuantity) && numericQuantity > 0
    ? Math.round(offer.amount_minor * numericQuantity)
    : 0;
  const jurisdiction = workspace.jurisdictions[0];
  const defaultSupplierType = workspace.party_types.find(
    (type) => type.code === REGISTRY_CONFIG.procurement.defaultSupplierPartyTypeCode,
  ) ?? workspace.party_types[0];

  if (!offers.length) return null;

  if (!suppliers.length && jurisdiction) {
    return <section className="simple-task-card first-supplier-card"><div className="task-intro"><span className="setup-step-number">2</span><div><p className="eyebrow">One last setup step</p><h2>Add your first seller</h2><p>Enter the player or organization once. You can select them next time.</p></div></div><form action={registerSupplierAction} className="simple-task-form">
      <input name="return_to" type="hidden" value="/staff/buy" />
      <input name="jurisdiction_id" type="hidden" value={jurisdiction.id} />
      <input name="party_type_code" type="hidden" value={defaultSupplierType?.code ?? ""} />
      <input name="display_name" type="hidden" value="" />
      <input name="notes" type="hidden" value="" />
      <input name="reason" type="hidden" value="Supplier registered during material intake." />
      <label className="field simple-primary-field"><span>Who are you buying from?</span><input autoFocus maxLength={300} name="legal_name" placeholder="Player or organization name" required /></label>
      <button className="button button-primary" type="submit">Save seller</button>
    </form></section>;
  }

  return (
    <div className="simple-task-layout">
      <section className="simple-task-card">
        <div className="task-intro compact-task-intro"><span className="setup-step-number">✓</span><div><p className="eyebrow">New material purchase</p><h2>Record what the player brought</h2></div></div>
        <form action={recordDeliveryAction} className="simple-task-form">
          <input name="return_to" type="hidden" value="/staff/buy" />
          <input name="reason" type="hidden" value="Player-supplied material counted and accepted at receiving." />

          <label className="field simple-primary-field">
            <span>1. Who is selling?</span>
            <select defaultValue={suppliers.length === 1 ? suppliers[0].id : ""} name="supplier_id" required>
              <option disabled value="">Choose a supplier</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.display_name}</option>)}
            </select>
          </label>

          <label className="field simple-primary-field">
            <span>2. What did they bring?</span>
            <select name="offer_id" onChange={(event) => setOfferId(event.target.value)} value={offerId}>
              {offers.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.item_name}</option>)}
            </select>
          </label>

          <label className="field simple-primary-field">
            <span>3. How many?</span>
            <div className="quantity-with-unit"><input min={offer?.minimum_quantity ?? 0.001} name="quantity" onChange={(event) => setQuantity(event.target.value)} required step="0.001" type="number" value={quantity} /><span>{offer?.unit_code}</span></div>
          </label>

          {locations.length === 1 ? <input name="stock_location_id" type="hidden" value={locations[0].id} /> : (
            <label className="field"><span>Receiving location</span><select defaultValue="" name="stock_location_id" required><option disabled value="">Choose a location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.warehouseName} · {location.display_name}</option>)}</select></label>
          )}

          <button className="button button-primary simple-task-submit" disabled={!locations.length} type="submit">Pay seller and add to stock</button>
          {!locations.length && <p className="field-help">A receiving location must be configured before a purchase can be recorded.</p>}
        </form>

        {jurisdiction && <details className="advanced-fields new-supplier-panel"><summary>Add another seller</summary><form action={registerSupplierAction} className="inventory-command-form">
          <input name="return_to" type="hidden" value="/staff/buy" />
          <input name="jurisdiction_id" type="hidden" value={jurisdiction.id} />
          <input name="reason" type="hidden" value="Supplier registered during material intake." />
          <input name="party_type_code" type="hidden" value={defaultSupplierType?.code ?? ""} />
          <label className="field"><span>Character or organization name</span><input maxLength={300} name="legal_name" required /></label>
          <input name="display_name" type="hidden" value="" />
          <label className="field"><span>Private note (optional)</span><input maxLength={2000} name="notes" /></label>
          <button className="button button-secondary" type="submit">Register supplier</button>
        </form></details>}
      </section>

      <aside className="simple-task-summary" aria-live="polite">
        <p className="eyebrow">You are about to buy</p>
        <h2>{offer?.item_name ?? "Choose a material"}</h2>
        <dl>
          <div><dt>Price each</dt><dd>{offer ? `${formatNumber(offer.amount_minor)} ${offer.currency_code}` : "—"}</dd></div>
          <div><dt>Amount</dt><dd>{formatNumber(numericQuantity || 0)} {offer?.unit_code}</dd></div>
        </dl>
        <div className="simple-task-total"><span>Company pays</span><strong>{formatNumber(total)} {offer?.currency_code}</strong></div>
        <p>This records the payment and puts the material into warehouse stock in one step.</p>
      </aside>
    </div>
  );
}
