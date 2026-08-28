"use client";

import { useMemo, useState } from "react";

import { submitDealerOrderAction } from "@/app/dealer/orders/actions";
import type { DealerOrderReferenceData } from "@/lib/orders";

type CartLine = { itemId: string; quantity: string };

export function DealerOrderShop({ data }: { data: DealerOrderReferenceData }) {
  const [representationId, setRepresentationId] = useState(data.representations[0]?.party_id ?? "");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [fulfillment, setFulfillment] = useState<"collection" | "delivery">("collection");
  const representation = data.representations.find((entry) => entry.party_id === representationId) ?? data.representations[0];
  const authorization = representation?.dealer_authorizations[0];
  const license = representation?.licenses[0];
  const items = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? data.items.filter((item) => item.display_name.toLocaleLowerCase().includes(query)) : data.items;
  }, [data.items, search]);

  function add(itemId: string) {
    setCart((current) => {
      const existing = current.find((line) => line.itemId === itemId);
      return existing
        ? current.map((line) => line.itemId === itemId ? { ...line, quantity: String(Number(line.quantity || "0") + 1) } : line)
        : [...current, { itemId, quantity: "1" }];
    });
  }

  return (
    <form action={submitDealerOrderAction} className="shop-checkout dealer-shop-checkout">
      <input name="ordering_party_id" type="hidden" value={representation?.party_id ?? ""} />
      <input name="dealer_authorization_id" type="hidden" value={authorization?.id ?? ""} />
      <input name="license_id" type="hidden" value={license?.id ?? ""} />
      <input name="fulfillment_mode" type="hidden" value={fulfillment} />
      <input name="reason" type="hidden" value="Business representative placed this order." />
      {cart.map((line) => <span key={line.itemId}><input name="item_ids" type="hidden" value={line.itemId} /><input name="quantities" type="hidden" value={line.quantity} /></span>)}

      <section className="shop-products">
        <div className="shop-buyer-bar">
          <label className="field"><span>Ordering as</span><select onChange={(event) => setRepresentationId(event.target.value)} value={representation?.party_id}>{data.representations.map((entry) => <option key={entry.party_id} value={entry.party_id}>{entry.party_name}</option>)}</select></label>
          <p>{license ? `${license.class_label} pricing and authorization are applied automatically.` : "Your current business authorization is checked automatically."}</p>
        </div>
        <div className="shop-catalogue-heading"><div><p className="eyebrow">Catalogue</p><h2>Choose goods</h2></div><label><span className="sr-only">Search goods</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Search goods" type="search" value={search} /></label></div>
        <div className="shop-product-grid">{items.map((item) => {
          const line = cart.find((entry) => entry.itemId === item.id);
          return <article className="shop-product-card" key={item.id}><div><h3>{item.display_name}</h3><p>{item.availability_label}</p></div><button className={line ? "button button-secondary" : "button button-primary"} onClick={() => add(item.id)} type="button">{line ? `Add another · ${line.quantity} in order` : "Add to order"}</button></article>;
        })}</div>
        {items.length === 0 && <div className="empty-state"><h3>No matching goods</h3><p>Try another name.</p></div>}
      </section>

      <aside className="shop-cart" aria-label="Order cart">
        <header><div><p className="eyebrow">Your order</p><h2>{cart.length ? `${cart.length} item${cart.length === 1 ? "" : "s"}` : "Cart is empty"}</h2></div><span>{representation?.party_name}</span></header>
        <div className="shop-cart-lines">{cart.map((line) => {
          const item = data.items.find((entry) => entry.id === line.itemId);
          return <div className="shop-cart-line" key={line.itemId}><div><strong>{item?.display_name}</strong><small>{item?.availability_label}</small></div><label><span className="sr-only">Quantity of {item?.display_name}</span><input min="0.001" onChange={(event) => setCart((current) => current.map((entry) => entry.itemId === line.itemId ? { ...entry, quantity: event.target.value } : entry))} step="0.001" type="number" value={line.quantity} /></label><button onClick={() => setCart((current) => current.filter((entry) => entry.itemId !== line.itemId))} type="button">Remove</button></div>;
        })}</div>
        {cart.length > 0 && <><fieldset className="simple-choice-field"><legend>How will you get it?</legend><div><label><input checked={fulfillment === "collection"} onChange={() => setFulfillment("collection")} type="radio" /><span><strong>Collect</strong><small>We will keep it ready</small></span></label><label><input checked={fulfillment === "delivery"} onChange={() => setFulfillment("delivery")} type="radio" /><span><strong>Deliver</strong><small>An Agent will bring it</small></span></label></div></fieldset><details className="shop-order-note"><summary>Add a note</summary><label className="field"><span>Order note</span><textarea maxLength={2000} name="dealer_notes" rows={3} /></label></details></>}
        {cart.length === 0 && <input name="dealer_notes" type="hidden" value="" />}
        <p className="shop-checkout-note">Business pricing, license requirements, and limits are applied automatically.</p>
        <button className="button button-primary shop-checkout-button" disabled={!authorization || cart.length === 0} type="submit">Place order</button>
      </aside>
    </form>
  );
}
