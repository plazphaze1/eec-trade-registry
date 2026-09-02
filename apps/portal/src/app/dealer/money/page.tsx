import Link from "next/link";

import { dealerInvoicePaymentAction, dealerTransferAction } from "@/app/dealer/money/actions";
import { DealerAccessDenied } from "@/components/dealer-access-denied";
import { requireDealerSession } from "@/lib/dealer-auth";
import { getDealerBankingWorkspace } from "@/lib/dealer-banking";

interface DealerMoneyPageProps { searchParams: Promise<{ error?: string; notice?: string }> }

const notices: Record<string, string> = {
  payment_recorded: "Invoice paid. Your account, the invoice, and Company Treasury updated together.",
  transfer_recorded: "Transfer complete. Both account statements updated together.",
};

const errors: Record<string, string> = {
  access_denied: "This business account is not allowed to move those funds.",
  insufficient_funds: "There are not enough available Septims in that account.",
  invalid_input: "Check the amount and account number, then try again.",
  payment_invalid: "That invoice cannot accept the requested payment.",
  save_failed: "Nothing moved. Please check the details and try again.",
};

function amount(value: number, currency: string) { return `${new Intl.NumberFormat().format(value)} ${currency}`; }
function today() { return new Date().toISOString().slice(0, 10); }

export default async function DealerMoneyPage({ searchParams }: DealerMoneyPageProps) {
  const query = await searchParams;
  const { client } = await requireDealerSession();
  const result = await getDealerBankingWorkspace(client);
  if (!result.ok && result.code === "access_denied") return <main className="dealer-main"><DealerAccessDenied /></main>;
  if (!result.ok) return <main className="dealer-main"><section className="notice-panel"><h1>Business banking unavailable</h1><p>No balance was guessed or cached.</p></section></main>;
  const workspace = result.data;
  const activeAccounts = workspace.accounts.filter((account) => account.status === "active");
  const openInvoices = workspace.invoices.filter((invoice) => ["open", "partially_paid"].includes(invoice.status));

  return <main className="dealer-main dealer-bank">
    <header className="dealer-page-header"><div><p className="eyebrow">Business banking</p><h1>Money</h1><p>Balances, bills, transfers, and loans for the businesses you represent.</p></div>{activeAccounts.length > 0 && <details className="bank-action-menu"><summary className="button button-primary">Send Septims</summary><form action={dealerTransferAction} className="bank-action-form"><label><span>From</span><select name="from_account_id" required>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.display_name} · {amount(account.available_balance_minor, account.currency_code)}</option>)}</select></label><label><span>Recipient account number</span><input name="to_account_reference" placeholder="EEC-ACC-1001" required/></label><label><span>Amount</span><input min="1" name="amount_minor" required step="1" type="number"/></label><input name="occurred_on" type="hidden" value={today()}/><label><span>What is it for?</span><input name="memo" required/></label><button className="button button-primary">Send Septims</button></form></details>}</header>
    {query.notice && notices[query.notice] && <p className="notice-panel notice-success">{notices[query.notice]}</p>}
    {query.error && errors[query.error] && <p className="notice-panel notice-error">{errors[query.error]}</p>}

    {!workspace.accounts.length && <section className="empty-state"><p className="eyebrow">No bank account yet</p><h2>Your license is connected, but no financial account has been opened.</h2><p>An EEC Agent can open the business account from Money → Accounts. Orders still work in the meantime.</p></section>}

    <section className="dealer-bank-accounts">{workspace.accounts.map((account) => <article key={account.id}><div><span className={`money-status is-${account.status}`}>{account.status}</span><h2>{account.display_name}</h2><p>{account.public_reference} · {account.party_name}</p></div><div><span>Available</span><strong>{amount(account.available_balance_minor, account.currency_code)}</strong><small>{amount(account.balance_minor, account.currency_code)} total{account.active_hold_minor > 0 ? ` · ${amount(account.active_hold_minor, account.currency_code)} held` : ""}</small></div></article>)}</section>

    <section className="bank-panel"><div className="bank-panel-heading"><div><p className="eyebrow">Bills</p><h2>Invoices</h2><p>Pay an EEC order directly from the matching business account.</p></div><span>{openInvoices.length} to pay</span></div><div className="bank-invoice-list">{workspace.invoices.map((invoice) => { const payers = activeAccounts.filter((account) => account.party_id === invoice.party_id && account.currency_code === invoice.currency_code); return <article key={invoice.id}><div className="bank-invoice-main"><span className={`money-status is-${invoice.status}`}>{invoice.status.replaceAll("_", " ")}</span><div><strong>{invoice.public_reference}</strong><span><Link href={`/dealer/orders/${invoice.order_id}`}>{invoice.order_reference}</Link> · {invoice.party_name}</span></div><div><strong>{amount(invoice.balance_due_minor, invoice.currency_code)} due</strong><span>{amount(invoice.paid_amount_minor, invoice.currency_code)} paid</span></div></div>{["open", "partially_paid"].includes(invoice.status) && payers.length > 0 && <details><summary>Pay invoice</summary><form action={dealerInvoicePaymentAction} className="bank-action-form"><input name="invoice_id" type="hidden" value={invoice.id}/><input name="occurred_on" type="hidden" value={today()}/><label><span>From account</span><select name="from_account_id">{payers.map((account) => <option key={account.id} value={account.id}>{account.display_name} · {amount(account.available_balance_minor, account.currency_code)}</option>)}</select></label><label><span>Amount</span><input defaultValue={invoice.balance_due_minor} max={invoice.balance_due_minor} min="1" name="amount_minor" required step="1" type="number"/></label><label><span>Payment reference</span><input defaultValue={`Payment ${invoice.public_reference}`} name="payment_reference" required/></label><button className="button button-primary">Pay invoice</button></form></details>}</article>; })}</div>{!workspace.invoices.length && <p className="empty-state">There are no invoices yet.</p>}</section>

    <section className="bank-two-column"><div className="bank-panel"><div className="bank-panel-heading"><div><p className="eyebrow">Credit</p><h2>Loans</h2></div><span>{workspace.loans.length}</span></div>{workspace.loans.length ? <div className="bank-list">{workspace.loans.map((loan) => <article key={loan.id}><div><strong>{loan.public_reference}</strong><span>{loan.borrower_account_name} · {loan.status}</span></div><div><strong>{amount(loan.remaining_due_minor, loan.currency_code)}</strong><span>{loan.next_due_on ? `Next due ${loan.next_due_on}` : `Matures ${loan.maturity_on}`}</span></div></article>)}</div> : <p className="empty-state">No loans are connected to these businesses.</p>}</div><div className="bank-panel"><div className="bank-panel-heading"><div><p className="eyebrow">Statement</p><h2>Recent activity</h2></div><span>{workspace.entries.length}</span></div><div className="bank-list">{workspace.entries.slice(0, 25).map((entry) => <article key={`${entry.transaction_id}-${entry.account_id}`}><div><strong>{entry.memo}</strong><span>{entry.public_reference} · {entry.account_name} · {entry.occurred_on}</span></div><strong className={entry.amount_minor >= 0 ? "money-positive" : "money-negative"}>{entry.amount_minor >= 0 ? "+" : ""}{amount(entry.amount_minor, entry.currency_code)}</strong></article>)}</div>{!workspace.entries.length && <p className="empty-state">No money has moved yet.</p>}</div></section>
  </main>;
}
