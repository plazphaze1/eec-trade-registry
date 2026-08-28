"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { postInventoryReceiptAction } from "@/app/staff/inventory/actions";

type StockItem = { id: string; name: string; unit: string; available: number; receivable: boolean };
type StockLocation = { id: string; label: string };

function number(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

export function SimpleStockWorkspace({ items, locations }: { items: StockItem[]; locations: StockLocation[] }) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? items.filter((item) => item.name.toLocaleLowerCase().includes(query)) : items;
  }, [items, search]);

  return (
    <section className="stock-storefront">
      <div className="stock-storefront-bar"><div><strong>{items.length} stock item{items.length === 1 ? "" : "s"}</strong><span>Available quantities already exclude goods held for orders.</span></div><label><span className="sr-only">Search stock</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Search stock" type="search" value={search} /></label></div>
      <div className="stock-card-grid">{filtered.map((item) => <article className="stock-card" key={item.id}>
        <div className="stock-card-count"><strong>{number(item.available)}</strong><span>{item.unit} available</span></div>
        <div className="stock-card-copy"><h2>{item.name}</h2><p>{item.available > 0 ? "In stock" : "Out of stock"}</p></div>
        {item.receivable ? <button className="button button-secondary" onClick={() => setAdding((current) => current === item.id ? null : item.id)} type="button">{adding === item.id ? "Close" : "Add stock"}</button> : <Link className="button button-secondary" href="/staff/buy">Buy materials</Link>}
        {adding === item.id && <form action={postInventoryReceiptAction} className="stock-quick-add">
          <input name="item_id" type="hidden" value={item.id} />
          <input name="source_reference" type="hidden" value="Routine staff stock intake" />
          <input name="reason" type="hidden" value="Ordinary stock received and counted by staff." />
          {locations.length === 1 ? <input name="stock_location_id" type="hidden" value={locations[0].id} /> : <label className="field"><span>Location</span><select name="stock_location_id" required>{locations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}</select></label>}
          <label className="field"><span>How many?</span><input autoFocus min="0.001" name="quantity" required step="0.001" type="number" /></label>
          <button className="button button-primary" type="submit">Add</button>
        </form>}
      </article>)}</div>
      {filtered.length === 0 && <div className="empty-state"><h2>No matching stock</h2><p>Try another name.</p></div>}
    </section>
  );
}
