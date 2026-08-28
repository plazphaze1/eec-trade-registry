"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { postInventoryReceiptAction } from "@/app/staff/inventory/actions";

type StockItem = {
  action: "asset" | "purchase" | "receipt";
  available: number;
  id: string;
  name: string;
  unit: string;
};

function number(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

export function SimpleStockWorkspace({
  defaultLocationId,
  items,
}: {
  defaultLocationId: string | null;
  items: StockItem[];
}) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? items.filter((item) => item.name.toLocaleLowerCase().includes(query)) : items;
  }, [items, search]);

  return (
    <section className="stock-storefront">
      <div className="stock-storefront-bar">
        <div><strong>{items.length} catalogue item{items.length === 1 ? "" : "s"}</strong><span>The number on each card is what can be used right now.</span></div>
        <label><span className="sr-only">Search stock</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Find an item" type="search" value={search} /></label>
      </div>
      <div className="stock-card-grid">{filtered.map((item) => (
        <article className="stock-card" key={item.id}>
          <div className="stock-card-count"><strong>{number(item.available)}</strong><span>{item.unit} available</span></div>
          <div className="stock-card-copy"><h2>{item.name}</h2><p>{item.available > 0 ? "In stock" : "Out of stock"}</p></div>
          {item.action === "receipt" && (
            <button className="button button-secondary" disabled={!defaultLocationId} onClick={() => setAdding((current) => current === item.id ? null : item.id)} type="button">
              {adding === item.id ? "Cancel" : "Add stock"}
            </button>
          )}
          {item.action === "purchase" && <Link className="button button-secondary" href="/staff/buy">Buy from a player</Link>}
          {item.action === "asset" && <Link className="button button-secondary" href="/staff/assets">Open unique goods</Link>}
          {adding === item.id && defaultLocationId && (
            <form action={postInventoryReceiptAction} className="stock-quick-add">
              <input name="item_id" type="hidden" value={item.id} />
              <input name="source_reference" type="hidden" value="Routine staff stock intake" />
              <input name="reason" type="hidden" value="Ordinary stock received and counted by staff." />
              <input name="stock_location_id" type="hidden" value={defaultLocationId} />
              <label className="field"><span>How many are you adding?</span><input autoFocus min="0.001" name="quantity" placeholder="0" required step="0.001" type="number" /></label>
              <button className="button button-primary" type="submit">Save</button>
            </form>
          )}
        </article>
      ))}</div>
      {filtered.length === 0 && <div className="empty-state"><h2>No matching item</h2><p>Try another name.</p></div>}
    </section>
  );
}
