import Link from "next/link";

import { StaffAccessDenied } from "@/components/staff-access-denied";
import { REGISTRY_CONFIG } from "@/lib/registry-config";
import { getStaffMoneyWorkspace } from "@/lib/stock-activity";
import { requireStaffSession } from "@/lib/staff-auth";

function number(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

function money(value: number, currency: string) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)} ${currency}`;
}

export default async function MoneyPage() {
  const { client } = await requireStaffSession();
  const result = await getStaffMoneyWorkspace(client);
  if (!result.ok && result.code === "access_denied") {
    return <main className="staff-main"><StaffAccessDenied /></main>;
  }
  if (!result.ok) {
    return <main className="staff-main"><section className="notice-panel"><h1>Money summary unavailable</h1><p>No fallback amount was calculated.</p></section></main>;
  }

  const workspace = result.data;
  const summary = workspace.summaries.find((row) => row.currency_code === REGISTRY_CONFIG.currency.code)
    ?? workspace.summaries[0]
    ?? { currency_code: REGISTRY_CONFIG.currency.code, outstanding_total_minor: 0, paid_30d_minor: 0, paid_total_minor: 0 };

  return <main className="staff-main">
    <header className="staff-page-header">
      <div><p className="eyebrow">Operational cashbook</p><h1>Money</h1><p>Automatic purchase spending and unpaid supplier purchases. Unpriced stock is shown separately instead of being guessed.</p></div>
      <Link className="button button-primary" href="/staff/activity">Record activity</Link>
    </header>

    <section className="money-summary-grid">
      <article><span>Spent in 30 days</span><strong>{money(summary.paid_30d_minor, summary.currency_code)}</strong><small>Known paid purchases</small></article>
      <article><span>Spent all time</span><strong>{money(summary.paid_total_minor, summary.currency_code)}</strong><small>Known paid purchases</small></article>
      <article className={summary.outstanding_total_minor > 0 ? "needs-attention" : ""}><span>Still owed</span><strong>{money(summary.outstanding_total_minor, summary.currency_code)}</strong><small>Named supplier deliveries</small></article>
      <article className={workspace.unpriced_purchase_count > 0 ? "needs-attention" : ""}><span>Needs a price</span><strong>{workspace.unpriced_purchase_count}</strong><small>Stock recorded without a rate</small></article>
    </section>

    <section className="money-ledger-card">
      <div className="activity-history-heading"><div><p className="eyebrow">Purchase history</p><h2>Money out</h2></div><span>{workspace.recent_purchases.length} shown</span></div>
      <div className="money-ledger-table">
        <div className="money-ledger-header"><span>Date</span><span>Item</span><span>Quantity</span><span>Who</span><span>Status</span><span>Total</span></div>
        {workspace.recent_purchases.map((purchase) => <article key={`${purchase.source_type}:${purchase.id}`}>
          <span data-label="Date">{purchase.occurred_on}</span>
          <strong data-label="Item">{purchase.item_name}</strong>
          <span data-label="Quantity">{number(purchase.quantity)} {purchase.unit_code}</span>
          <span data-label="Who">{purchase.seller_label}</span>
          <span data-label="Status" className={`money-status is-${purchase.status}`}>{purchase.status === "paid" ? "Paid" : purchase.status === "pending" ? "Still owed" : "Unpriced"}</span>
          <strong data-label="Total">{purchase.total_amount_minor === null ? "—" : money(purchase.total_amount_minor, purchase.currency_code ?? summary.currency_code)}</strong>
        </article>)}
      </div>
      {workspace.recent_purchases.length === 0 && <p className="empty-state">No material purchases have been recorded yet.</p>}
    </section>

    <p className="money-scope-note">This is the Company purchase cashbook, not a bank balance. Order revenue will appear only when a sales-payment workflow is recorded authoritatively.</p>
  </main>;
}
