import Link from "next/link";

import {
  expireReservationAction,
  extendReservationAction,
  releaseReservationAction,
  reverseInventoryTransactionAction,
} from "@/app/staff/inventory/actions";
import { InventoryNotice } from "@/components/inventory-notice";
import { SimpleStockWorkspace } from "@/components/simple-stock-workspace";
import { StaffAccessDenied } from "@/components/staff-access-denied";
import { getDefaultLocale } from "@/lib/env";
import { getStaffInventoryWorkspace } from "@/lib/inventory";
import { getMyStaffAccessState } from "@/lib/staff-access";
import { requireStaffSession } from "@/lib/staff-auth";

interface StaffInventoryPageProps {
  searchParams: Promise<{ error?: string; notice?: string; view?: string }>;
}

function quantity(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

export default async function StaffInventoryPage({ searchParams }: StaffInventoryPageProps) {
  const parameters = await searchParams;
  const { client } = await requireStaffSession();
  const [result, access] = await Promise.all([
    getStaffInventoryWorkspace(client),
    getMyStaffAccessState(client),
  ]);
  if (!result.ok && result.code === "access_denied") {
    return <main className="staff-main"><StaffAccessDenied /></main>;
  }
  if (!result.ok) {
    return (
      <main className="staff-main">
        <section className="notice-panel">
          <h1>Inventory desk unavailable</h1>
          <p>No fallback balance was used and no authoritative data was changed.</p>
        </section>
      </main>
    );
  }

  const workspace = result.data;
  const locale = getDefaultLocale();
  const isOwner = access.ok && access.data.state === "authorized" && access.data.access_class === "owner";
  const showSystemRecords = isOwner && parameters.view === "system";
  const receivableIds = new Set(workspace.items.filter((item) => item.inventory_mode === "fungible").map((item) => item.id));
  const stockLocations = workspace.warehouses.flatMap((warehouse) =>
    warehouse.locations.map((location) => ({
      id: location.id,
      label: `${warehouse.display_name} · ${location.display_name}`,
    })),
  );
  const stockItems = Array.from(workspace.positions.reduce((items, position) => {
    const current = items.get(position.item_id) ?? { available: 0, id: position.item_id, name: position.item_name, receivable: receivableIds.has(position.item_id), unit: position.unit_code };
    if (position.stock_state === "available") current.available += position.available;
    items.set(position.item_id, current);
    return items;
  }, new Map<string, { available: number; id: string; name: string; receivable: boolean; unit: string }>()).values());
  for (const item of workspace.items) {
    if (!stockItems.some((candidate) => candidate.id === item.id)) stockItems.push({ available: 0, id: item.id, name: item.display_name, receivable: receivableIds.has(item.id), unit: item.unit_code });
  }
  stockItems.sort((left, right) => left.name.localeCompare(right.name));

  return (
    <main className="staff-main">
      <header className="staff-page-header">
        <div>
          <p className="eyebrow">{showSystemRecords ? "Owner tools" : "Inventory"}</p>
          <h1>{showSystemRecords ? "Stock records" : "Stock"}</h1>
          <p>{showSystemRecords ? "Corrections and historical evidence for exceptional work." : "See what is available or add newly received goods."}</p>
        </div>
        <div className="staff-button-row">
          {showSystemRecords ? <Link className="button button-secondary" href="/staff/inventory">Back to stock</Link> : <Link className="button button-primary" href="/staff/buy">Buy materials</Link>}
        </div>
      </header>

      <InventoryNotice error={parameters.error} notice={parameters.notice} />

      {!showSystemRecords && <SimpleStockWorkspace items={stockItems} locations={stockLocations} />}

      {showSystemRecords && <div className="staff-tools-panel stock-tools-panel is-system-records"><div className="staff-tools-content">
      <section className="inventory-section embedded-inventory-section">
        <div className="inventory-section-heading"><div><p className="eyebrow">Time-bounded claims</p><h2>Reservations</h2></div><p>Elapsed claims stop reducing availability and must be finalized explicitly.</p></div>
        <div className="inventory-reservation-list">
          {workspace.reservations.map((reservation) => {
            const active = reservation.status === "active";
            const elapsed = reservation.effective_status === "elapsed";
            return <article className="inventory-reservation-card" key={reservation.id}>
              <header><div><span className={`order-status order-status-${reservation.effective_status}`}>{reservation.effective_status}</span><h3>{reservation.public_reference}</h3></div><strong>{quantity(reservation.quantity)}</strong></header>
              <p>{reservation.order_reference} · line {reservation.line_number} · {reservation.item_code}</p>
              <dl className="order-facts"><div><dt>Location</dt><dd>{reservation.warehouse_name} / {reservation.location_name}</dd></div><div><dt>Expires</dt><dd>{new Date(reservation.expires_at).toLocaleString(locale)}</dd></div><div><dt>Version</dt><dd>{reservation.version}</dd></div></dl>
              {active && <div className="inventory-reservation-actions">
                {!elapsed && <form action={extendReservationAction}><input name="reservation_id" type="hidden" value={reservation.id} /><input name="expected_version" type="hidden" value={reservation.version} /><label className="field"><span>New expiration (UTC)</span><input name="expires_at" required type="datetime-local" /></label><label className="field"><span>Reason</span><input maxLength={500} name="reason" required /></label><button className="button button-secondary" type="submit">Extend</button></form>}
                <form action={elapsed ? expireReservationAction : releaseReservationAction}><input name="reservation_id" type="hidden" value={reservation.id} /><input name="expected_version" type="hidden" value={reservation.version} /><label className="field"><span>Reason</span><input maxLength={500} name="reason" required /></label><button className="button button-secondary" type="submit">{elapsed ? "Finalize expiry" : "Release"}</button></form>
              </div>}
            </article>;
          })}
        </div>
        {workspace.reservations.length === 0 && <p className="empty-state">No reservation history yet.</p>}
      </section>

      <section className="inventory-section embedded-inventory-section">
        <div className="inventory-section-heading"><div><p className="eyebrow">Posted evidence</p><h2>Recent ledger transactions</h2></div><p>Corrections add a linked reversal; originals cannot be edited.</p></div>
        <div className="inventory-transaction-list">{workspace.transactions.map((transaction) => <article className="inventory-transaction-card" key={transaction.id}><div><span className="order-status">{transaction.transaction_type}</span><h3>{transaction.source_reference}</h3><p>{transaction.item_code} · {quantity(transaction.quantity_delta)} · {transaction.warehouse_name}</p><small>{new Date(transaction.posted_at).toLocaleString(locale)}</small></div>{transaction.transaction_type === "receipt" && !transaction.is_reversed && <form action={reverseInventoryTransactionAction}><input name="inventory_transaction_id" type="hidden" value={transaction.id} /><label className="field"><span>Correction reason</span><input maxLength={500} name="reason" required /></label><button className="button button-secondary" type="submit">Post reversal</button></form>}</article>)}</div>
      </section>
      </div></div>}
    </main>
  );
}
