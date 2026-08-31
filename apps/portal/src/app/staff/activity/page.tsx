import Link from "next/link";

import { recordAnonymousPurchaseAction, setCountedTotalAction } from "@/app/staff/activity/actions";
import { StaffAccessDenied } from "@/components/staff-access-denied";
import { getStaffStockActivityWorkspace } from "@/lib/stock-activity";
import { requireStaffSession } from "@/lib/staff-auth";

interface ActivityPageProps {
  searchParams: Promise<{ error?: string; item?: string; mode?: string; notice?: string }>;
}

const notices: Record<string, string> = {
  count_recorded: "Stock total saved. The ledger posted only the difference.",
  purchase_recorded: "Purchase saved. Stock and the money summary were updated together.",
};

const errors: Record<string, string> = {
  access_denied: "Your current access does not permit that action.",
  below_reserved: "That total is lower than stock already held for orders.",
  invalid_input: "Choose an item, enter a valid amount, and use today or an earlier date.",
  not_found: "The selected item or warehouse is no longer available.",
  save_failed: "Nothing was changed. Please try again.",
  unchanged: "That is already the current total, so there was nothing to change.",
};

function number(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

function money(value: number | null, currency: string | null) {
  return value === null ? "No rate" : `${number(value)} ${currency ?? ""}`.trim();
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const parameters = await searchParams;
  const { client } = await requireStaffSession();
  const result = await getStaffStockActivityWorkspace(client);
  if (!result.ok && result.code === "access_denied") {
    return <main className="staff-main"><StaffAccessDenied /></main>;
  }
  if (!result.ok) {
    return <main className="staff-main"><section className="notice-panel"><h1>Activity journal unavailable</h1><p>No stock or money value was changed.</p></section></main>;
  }

  const workspace = result.data;
  const purchaseItems = workspace.items.filter((item) => item.can_purchase);
  const countItems = workspace.items.filter((item) => item.can_set_total);
  const mode = parameters.mode === "count" ? "count" : "purchase";
  const today = new Date().toISOString().slice(0, 10);
  const message = (parameters.notice && notices[parameters.notice]) || (parameters.error && errors[parameters.error]);

  return <main className="staff-main">
    <header className="staff-page-header activity-page-header">
      <div><p className="eyebrow">One-minute entry</p><h1>Record activity</h1><p>Choose what happened, the item, the amount, and the date. The database handles stock, rates, and totals.</p></div>
      <Link className="button button-secondary" href="/staff/money">View money</Link>
    </header>

    {message && <div className={`staff-flash ${parameters.error ? "staff-flash-error" : ""}`} role={parameters.error ? "alert" : "status"}>{message}</div>}

    <nav aria-label="Activity type" className="activity-mode-tabs">
      <Link aria-current={mode === "purchase" ? "page" : undefined} className={mode === "purchase" ? "is-active" : ""} href="/staff/activity?mode=purchase">Bought materials</Link>
      {workspace.capabilities.can_reconcile_count && <Link aria-current={mode === "count" ? "page" : undefined} className={mode === "count" ? "is-active" : ""} href="/staff/activity?mode=count">Set a stock total</Link>}
    </nav>

    <section className="activity-entry-card">
      {mode === "purchase" ? <>
        <div className="activity-card-title"><div><span>Purchase</span><h2>What did the Company buy?</h2></div><p>No seller name is needed.</p></div>
        {workspace.capabilities.can_record_purchase && purchaseItems.length > 0 ? <form action={recordAnonymousPurchaseAction} className="activity-quick-form">
          <label><span>Item</span><select defaultValue={purchaseItems.some((item) => item.id === parameters.item) ? parameters.item : ""} name="item_id" required><option disabled value="">Choose material</option>{purchaseItems.map((item) => <option key={item.id} value={item.id}>{item.item_name} · {number(item.current_quantity)} in stock · {money(item.buying_price_minor, item.buying_currency_code)}</option>)}</select></label>
          <label><span>Amount bought</span><input min="0.001" name="quantity" placeholder="0" required step="0.001" type="number" /></label>
          <label><span>Date</span><input defaultValue={today} max={today} name="occurred_on" required type="date" /></label>
          <button className="button button-primary" type="submit">Save purchase</button>
          <details className="activity-note"><summary>Add a note</summary><label><span>Optional note</span><input maxLength={500} name="note" placeholder="Only if something unusual happened" /></label></details>
        </form> : <p className="empty-state">No player-supplied materials are ready for purchase entry.</p>}
        <p className="activity-form-footnote">A saved buying rate is applied automatically. Without one, stock still updates and Money marks the purchase as unpriced.</p>
      </> : <>
        <div className="activity-card-title"><div><span>Stock count</span><h2>What is the total now?</h2></div><p>Ordinary finished goods only.</p></div>
        {workspace.capabilities.can_reconcile_count && countItems.length > 0 ? <form action={setCountedTotalAction} className="activity-quick-form">
          <label><span>Item</span><select name="item_id" required><option disabled value="">Choose item</option>{countItems.map((item) => <option key={item.id} value={item.id}>{item.item_name} · currently {number(item.current_quantity)} {item.unit_code}</option>)}</select></label>
          <label><span>Counted total</span><input min="0" name="target_quantity" placeholder="0" required step="0.001" type="number" /></label>
          <label><span>Date</span><input defaultValue={today} max={today} name="occurred_on" required type="date" /></label>
          <button className="button button-primary" type="submit">Save total</button>
          <details className="activity-note"><summary>Add a note</summary><label><span>Optional note</span><input maxLength={500} name="note" placeholder="Example: physical count after event" /></label></details>
        </form> : <p className="empty-state">No ordinary fungible item is available for counted-total entry.</p>}
        <p className="activity-form-footnote">The total is never overwritten. The ledger automatically adds or removes only the difference.</p>
      </>}
    </section>

    <section className="activity-history-card">
      <div className="activity-history-heading"><div><p className="eyebrow">Recent entries</p><h2>What changed</h2></div><span>{workspace.recent_activity.length} shown</span></div>
      <div className="activity-history-list">{workspace.recent_activity.map((entry) => <article key={entry.id}>
        <div className={`activity-history-icon ${entry.activity_type === "anonymous_purchase" ? "is-purchase" : ""}`}>{entry.quantity_delta > 0 ? "+" : ""}{number(entry.quantity_delta)}</div>
        <div><strong>{entry.item_name}</strong><span>{entry.activity_type === "anonymous_purchase" ? "Bought" : "Counted total set"} · {entry.occurred_on}</span></div>
        <div className="activity-history-result"><strong>{number(entry.resulting_quantity)} {entry.unit_code}</strong><span>{entry.financial_status === "paid" ? money(entry.total_amount_minor, entry.currency_code) : entry.financial_status === "unpriced" ? "Unpriced" : entry.public_reference}</span></div>
      </article>)}</div>
      {workspace.recent_activity.length === 0 && <p className="empty-state">Your first saved purchase or stock count will appear here.</p>}
    </section>
  </main>;
}
