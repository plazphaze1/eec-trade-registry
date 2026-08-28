"use client";

import { type FormEvent, useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { guidedTradeOrderAction } from "@/app/staff/launch/actions";
import type { LaunchWorkspace } from "@/lib/launch-workspace";
import type { GuidedOrderState, TradeOrderPreview } from "@/lib/order-preview";
import { REGISTRY_CONFIG } from "@/lib/registry-config";

const initialState: GuidedOrderState = {};
type CartLine = { key: number; itemId: string; quantity: string };
export type OrderStock = Record<string, { available: number; unit: string }>;

function amount(value: number | null, currency: string | null) {
  return value === null ? "To be confirmed" : `${new Intl.NumberFormat().format(value)} ${currency ?? REGISTRY_CONFIG.currency.code}`;
}

function OrderPreview({ preview }: { preview: TradeOrderPreview }) {
  return (
    <section className="shop-price-summary" aria-live="polite">
      <div className="shop-price-heading"><strong>{preview.valid ? "Ready to place" : "Check this order"}</strong><span>{preview.channel === "direct_individual" ? "Individual price" : "Business price"}</span></div>
      {preview.lines.map((line) => <div className="shop-price-line" key={line.item_id}><span>{line.quantity} × {line.item_name}</span><strong>{amount(line.unit_price_minor === null ? null : line.unit_price_minor * line.quantity, line.currency_code)}</strong>{line.weekly_limit !== null && <small>{line.weekly_remaining} of {line.weekly_limit} available this week before this order</small>}</div>)}
      <div className="shop-price-total"><span>Total</span><strong>{amount(preview.total_amount_minor, preview.currency_code)}</strong></div>
      {preview.warnings.map((warning) => <p className="staff-flash staff-flash-error" key={warning}>{warning}</p>)}
    </section>
  );
}

export function GuidedOrderForm({ stock, workspace }: { stock: OrderStock; workspace: LaunchWorkspace }) {
  const jurisdiction = workspace.jurisdictions.find((item) => item.code === REGISTRY_CONFIG.jurisdiction.code) ?? workspace.jurisdictions[0];
  const businessOptions = workspace.businesses.flatMap((business) => business.licenses.map((license) => ({
    businessKey: `${business.party_id}|${business.dealer_authorization_id}|${license.id}|${business.jurisdiction_id}`,
    channel: "staff_assisted_business" as const,
    directId: "",
    key: `business:${license.id}`,
    label: business.party_name,
  })));
  const directOptions = workspace.direct_customers.map((customer) => ({
    businessKey: "",
    channel: "direct_individual" as const,
    directId: customer.party_id,
    key: `direct:${customer.party_id}`,
    label: customer.name,
  }));
  const buyerOptions = [...businessOptions, ...directOptions];
  const [buyerKey, setBuyerKey] = useState(buyerOptions[0]?.key ?? "new");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [fulfillment, setFulfillment] = useState<"collection" | "delivery">("collection");
  const [contactLabel, setContactLabel] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const revisionRef = useRef(revision);
  const [previewRevision, setPreviewRevision] = useState(-1);
  const [state, dispatch, actionPending] = useActionState(guidedTradeOrderAction, initialState);
  const [transitionPending, startTransition] = useTransition();
  const pending = actionPending || transitionPending;
  const selectedBuyer = buyerOptions.find((buyer) => buyer.key === buyerKey);
  const isNewCustomer = buyerKey === "new";
  const isDirect = isNewCustomer || selectedBuyer?.channel === "direct_individual";
  const visibleItems = useMemo(() => isDirect ? workspace.items.filter((item) => item.direct_allowed) : workspace.items, [isDirect, workspace.items]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? visibleItems.filter((item) => item.name.toLocaleLowerCase().includes(query)) : visibleItems;
  }, [search, visibleItems]);
  const previewIsCurrent = Boolean(state.preview) && previewRevision === revision;

  useEffect(() => { revisionRef.current = revision; }, [revision]);
  useEffect(() => {
    if (state.fingerprint) setPreviewRevision(revisionRef.current);
  }, [state.fingerprint]);

  function changed() {
    setRevision((value) => value + 1);
  }

  function addItem(itemId: string) {
    setCart((current) => {
      const existing = current.find((line) => line.itemId === itemId);
      if (existing) return current.map((line) => line.itemId === itemId ? { ...line, quantity: String(Number(line.quantity || "0") + 1) } : line);
      const key = [1, 2, 3, 4, 5].find((candidate) => !current.some((line) => line.key === candidate));
      return key ? [...current, { key, itemId, quantity: "1" }] : current;
    });
    changed();
  }

  function changeBuyer(key: string) {
    const nextBuyer = buyerOptions.find((buyer) => buyer.key === key);
    const nextDirect = key === "new" || nextBuyer?.channel === "direct_individual";
    setBuyerKey(key);
    if (nextDirect) {
      const allowed = new Set(workspace.items.filter((item) => item.direct_allowed).map((item) => item.id));
      setCart((current) => current.filter((line) => allowed.has(line.itemId)));
    }
    changed();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.name) formData.set(submitter.name, submitter.value);
    startTransition(() => dispatch(formData));
  }

  return (
    <form className="shop-checkout" onSubmit={handleSubmit}>
      <input name="channel" type="hidden" value={isDirect ? "direct_individual" : "staff_assisted_business"} />
      <input name="business_key" type="hidden" value={selectedBuyer?.businessKey ?? ""} />
      <input name="direct_customer_id" type="hidden" value={selectedBuyer?.directId ?? ""} />
      <input name="jurisdiction_id" type="hidden" value={jurisdiction?.id ?? ""} />
      <input name="fulfillment_mode" type="hidden" value={fulfillment} />
      <input name="reason" type="hidden" value="Staff recorded the customer order." />
      {cart.map((line) => <span key={line.key}><input name={`item_id_${line.key}`} type="hidden" value={line.itemId} /><input name={`quantity_${line.key}`} type="hidden" value={line.quantity} /></span>)}

      <section className="shop-products">
        <div className="shop-buyer-bar">
          <label className="field"><span>Ordering for</span><select onChange={(event) => changeBuyer(event.target.value)} value={buyerKey}>{businessOptions.length > 0 && <optgroup label="Businesses">{businessOptions.map((buyer) => <option key={buyer.key} value={buyer.key}>{buyer.label}</option>)}</optgroup>}{directOptions.length > 0 && <optgroup label="Individuals">{directOptions.map((buyer) => <option key={buyer.key} value={buyer.key}>{buyer.label}</option>)}</optgroup>}<option value="new">+ New individual</option></select></label>
          <p>{isDirect ? "Individual pricing and limits apply automatically." : "Licensed business pricing applies automatically."}</p>
        </div>
        {isNewCustomer && <div className="shop-new-customer"><label className="field"><span>Name</span><input autoFocus maxLength={200} name="new_customer_name" onChange={(event) => { setCustomerName(event.target.value); changed(); }} required value={customerName} /></label><label className="field"><span>Discord name <small>optional</small></span><input maxLength={300} name="contact_label" onChange={(event) => { setContactLabel(event.target.value); changed(); }} value={contactLabel} /></label></div>}
        {!isNewCustomer && <input name="new_customer_name" type="hidden" value="" />}
        {!isNewCustomer && isDirect && <input name="contact_label" type="hidden" value="" />}

        <div className="shop-catalogue-heading"><div><p className="eyebrow">Catalogue</p><h2>Choose goods</h2></div><label><span className="sr-only">Search goods</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Search goods" type="search" value={search} /></label></div>
        <div className="shop-product-grid">{filteredItems.map((item) => {
          const cartLine = cart.find((line) => line.itemId === item.id);
          const availability = stock[item.id];
          return <article className="shop-product-card" key={item.id}><div><h3>{item.name}</h3><p>{availability ? availability.available > 0 ? `${availability.available} ${availability.unit} in stock` : "Out of stock · ordering is still available" : "Ordering is available"}</p></div><button className={cartLine ? "button button-secondary" : "button button-primary"} disabled={cart.length >= 5 && !cartLine} onClick={() => addItem(item.id)} type="button">{cartLine ? `Add another · ${cartLine.quantity} in order` : "Add to order"}</button></article>;
        })}</div>
        {filteredItems.length === 0 && <div className="empty-state"><h3>No matching goods</h3><p>Try another name.</p></div>}
      </section>

      <aside className="shop-cart" aria-label="Order cart">
        <header><div><p className="eyebrow">Your order</p><h2>{cart.length ? `${cart.length} item${cart.length === 1 ? "" : "s"}` : "Cart is empty"}</h2></div><span>{selectedBuyer?.label ?? (customerName || "New individual")}</span></header>
        <div className="shop-cart-lines">{cart.map((line) => {
          const item = workspace.items.find((candidate) => candidate.id === line.itemId);
          return <div className="shop-cart-line" key={line.key}><div><strong>{item?.name}</strong><small>{stock[line.itemId]?.available ?? 0} currently in stock</small></div><label><span className="sr-only">Quantity of {item?.name}</span><input min="0.001" onChange={(event) => { setCart((current) => current.map((candidate) => candidate.key === line.key ? { ...candidate, quantity: event.target.value } : candidate)); changed(); }} step="0.001" type="number" value={line.quantity} /></label><button aria-label={`Remove ${item?.name}`} onClick={() => { setCart((current) => current.filter((candidate) => candidate.key !== line.key)); changed(); }} type="button">Remove</button></div>;
        })}</div>

        {cart.length > 0 && <>
          {!isNewCustomer && !isDirect && <label className="field shop-recipient"><span>For someone else? <small>optional</small></span><input maxLength={300} name="contact_label" onChange={(event) => { setContactLabel(event.target.value); changed(); }} placeholder="Recipient name" value={contactLabel} /></label>}
          <fieldset className="simple-choice-field"><legend>How will they get it?</legend><div><label><input checked={fulfillment === "collection"} name="handoff_choice" onChange={() => { setFulfillment("collection"); changed(); }} type="radio" /><span><strong>Collect</strong><small>Keep it ready for pickup</small></span></label><label><input checked={fulfillment === "delivery"} name="handoff_choice" onChange={() => { setFulfillment("delivery"); changed(); }} type="radio" /><span><strong>Deliver</strong><small>An Agent will bring it</small></span></label></div></fieldset>
          <details className="shop-order-note"><summary>Add a note</summary><label className="field"><span>Order note</span><textarea maxLength={2000} name="notes" onChange={(event) => { setNotes(event.target.value); changed(); }} rows={3} value={notes} /></label></details>
        </>}

        {state.error && <p className="staff-flash staff-flash-error" role="alert">{state.error}</p>}
        {previewIsCurrent && state.preview && <OrderPreview preview={state.preview} />}
        {!previewIsCurrent && cart.length > 0 && <p className="shop-checkout-note">Prices, license rules, and limits are checked automatically before the order is placed.</p>}
        <button className="button button-primary shop-checkout-button" disabled={pending || !jurisdiction || cart.length === 0 || (isNewCustomer && !customerName.trim())} name="_intent" value={previewIsCurrent ? "submit" : "preview"}>{pending ? "Working…" : previewIsCurrent ? "Place order" : "Review order"}</button>
      </aside>
    </form>
  );
}
