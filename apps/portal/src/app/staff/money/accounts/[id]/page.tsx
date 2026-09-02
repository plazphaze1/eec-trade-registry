import Link from "next/link";

import {
  placeAccountHoldAction,
  releaseAccountHoldAction,
  setAccountStatusAction,
} from "@/app/staff/money/actions";
import { StaffAccessDenied } from "@/components/staff-access-denied";
import { getStaffFinancialAccountStatement } from "@/lib/banking";
import { requireStaffSession } from "@/lib/staff-auth";

interface AccountPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}

const notices: Record<string, string> = {
  hold_placed: "Hold placed. The available balance changed immediately.",
  hold_released: "Hold released. The funds are available again.",
  status_updated: "Account status updated.",
};

function amount(value: number, currency: string) {
  return `${new Intl.NumberFormat().format(value)} ${currency}`;
}

export default async function FinancialAccountPage({ params, searchParams }: AccountPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { client } = await requireStaffSession();
  const result = await getStaffFinancialAccountStatement(client, id);
  if (!result.ok && result.code === "access_denied") return <main className="staff-main"><StaffAccessDenied /></main>;
  if (!result.ok) return <main className="staff-main"><section className="notice-panel"><h1>Account unavailable</h1><p>The account was not found or its statement could not be verified.</p><Link href="/staff/money?view=accounts">Return to accounts</Link></section></main>;

  const { account, capabilities, entries, holds, loans } = result.data;
  const activeHolds = holds.filter((hold) => hold.status === "active" && (!hold.expires_at || new Date(hold.expires_at) > new Date()));

  return <main className="staff-main bank-account-detail">
    <header className="staff-page-header"><div><p className="eyebrow">{account.public_reference}</p><h1>{account.display_name}</h1><p>{account.party_name ?? "Company-controlled account"} · {account.account_type.replaceAll("_", " ")}</p></div><Link className="button button-secondary" href="/staff/money?view=accounts">All accounts</Link></header>
    {query.notice && notices[query.notice] && <p className="notice-panel notice-success">{notices[query.notice]}</p>}
    {query.error && <p className="notice-panel notice-error">The change was not posted. No balance changed.</p>}

    <section className="bank-account-hero"><div><span>Ledger balance</span><strong>{amount(account.balance_minor, account.currency_code)}</strong></div><div><span>Available now</span><strong>{amount(account.available_balance_minor, account.currency_code)}</strong></div><div><span>Status</span><strong className={`money-status is-${account.status}`}>{account.status}</strong></div></section>

    {(capabilities.can_post || capabilities.can_manage_accounts) && account.account_type !== "company_treasury" && <section className="bank-quick-actions">
      {capabilities.can_post && account.status === "active" && <details><summary><strong>Place a hold</strong><span>Temporarily reserve part of the available balance</span></summary><form action={placeAccountHoldAction} className="bank-action-form"><input name="account_id" type="hidden" value={account.id}/><label><span>Amount</span><input max={account.available_balance_minor} min="1" name="amount_minor" required step="1" type="number"/></label><label><span>Reason</span><input name="reason" required/></label><label><span>Expires optional</span><input name="expires_at" type="datetime-local"/></label><button className="button button-primary">Place hold</button></form></details>}
      {capabilities.can_manage_accounts && account.status !== "closed" && <details><summary><strong>{account.status === "frozen" ? "Unfreeze account" : "Freeze or close"}</strong><span>Stop movement without changing the recorded balance</span></summary><form action={setAccountStatusAction} className="bank-action-form"><input name="account_id" type="hidden" value={account.id}/><input name="expected_version" type="hidden" value={account.version}/><label><span>New status</span><select defaultValue={account.status === "frozen" ? "active" : "frozen"} name="status"><option value="active">Active</option><option value="frozen">Frozen</option><option value="closed">Closed</option></select></label><label><span>Reason</span><input name="reason" required/></label><button className="button button-primary">Update account</button></form></details>}
    </section>}

    <section className="bank-two-column">
      <div className="bank-panel"><div className="bank-panel-heading"><div><p className="eyebrow">Reserved money</p><h2>Holds</h2></div><span>{activeHolds.length} active</span></div>{holds.length ? <div className="bank-list">{holds.map((hold) => <article key={hold.id}><div><strong>{hold.reason}</strong><span>{hold.public_reference} · {hold.status}{hold.expires_at ? ` · until ${new Date(hold.expires_at).toLocaleString()}` : ""}</span></div><div><strong>{amount(hold.amount_minor, account.currency_code)}</strong>{hold.status === "active" && capabilities.can_post && <form action={releaseAccountHoldAction} className="bank-inline-form"><input name="account_id" type="hidden" value={account.id}/><input name="expected_version" type="hidden" value={hold.version}/><input name="hold_id" type="hidden" value={hold.id}/><input name="reason" type="hidden" value="Released from the account statement."/><button className="button button-secondary">Release</button></form>}</div></article>)}</div> : <p className="empty-state">No holds have been placed.</p>}</div>
      <div className="bank-panel"><div className="bank-panel-heading"><div><p className="eyebrow">Credit</p><h2>Loans</h2></div><span>{loans.length}</span></div>{loans.length ? <div className="bank-list">{loans.map((loan) => <article key={loan.id}><div><Link href={`/staff/money/loans/${loan.id}`}><strong>{loan.public_reference}</strong></Link><span>{loan.status} · matures {loan.maturity_on}</span></div><strong>{amount(loan.principal_minor, account.currency_code)}</strong></article>)}</div> : <p className="empty-state">No loans are tied to this account.</p>}</div>
    </section>

    <section className="bank-panel"><div className="bank-panel-heading"><div><p className="eyebrow">Account statement</p><h2>Posted entries</h2><p>The newest 100 entries are shown. Every amount is part of a balanced transaction.</p></div></div><div className="bank-table-wrap"><table className="bank-table"><thead><tr><th>Date</th><th>Reference</th><th>Description</th><th>Change</th><th>Balance</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.transaction_id}><td>{entry.occurred_on}</td><td><strong>{entry.public_reference}</strong><small>{entry.transaction_type.replaceAll("_", " ")}{entry.is_reversed ? " · reversed" : ""}</small></td><td>{entry.memo}<small>{entry.source_reference ?? entry.external_reference ?? "Manual entry"}</small></td><td className={entry.amount_minor >= 0 ? "money-positive" : "money-negative"}>{entry.amount_minor >= 0 ? "+" : ""}{amount(entry.amount_minor, account.currency_code)}</td><td>{amount(entry.running_balance_minor, account.currency_code)}</td></tr>)}</tbody></table></div>{!entries.length && <p className="empty-state">No money has moved through this account.</p>}</section>
  </main>;
}
