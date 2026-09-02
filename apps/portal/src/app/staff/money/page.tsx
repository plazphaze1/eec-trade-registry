import Link from "next/link";

import {
  assessLateFeesAction,
  cashMovementAction,
  closeFinancialPeriodAction,
  createAccountAction,
  createLoanProductAction,
  issueInvoiceAction,
  originateLoanAction,
  reconcileAccountAction,
  recordInvoicePaymentAction,
  recordLoanPaymentAction,
  reopenFinancialPeriodAction,
  reverseInvoicePaymentAction,
  reverseLoanPaymentAction,
  transferAction,
  treasuryCashInfusionAction,
} from "@/app/staff/money/actions";
import { StaffAccessDenied } from "@/components/staff-access-denied";
import {
  getStaffBankCustomerAccountRegister,
  getStaffBankingControls,
  getStaffBankingWorkspace,
  type BankAccountRegister,
  type BankingControls,
  type BankingWorkspace,
} from "@/lib/banking";
import { REGISTRY_CONFIG } from "@/lib/registry-config";
import { requireStaffSession } from "@/lib/staff-auth";

type View = "overview" | "accounts" | "invoices" | "transactions" | "loans" | "controls";

interface MoneyPageProps {
  searchParams: Promise<{ error?: string; notice?: string; page?: string; q?: string; scope?: string; status?: string; view?: string }>;
}

const notices: Record<string, string> = {
  account_created: "Account opened. Its balance and statement are now live.",
  invoice_issued: "Invoice issued from the order. The amount is now receivable.",
  invoice_payment_recorded: "Payment recorded. Treasury and the invoice updated together.",
  invoice_payment_reversed: "Latest invoice payment undone. The payer, Treasury, and invoice were corrected together.",
  account_reconciled: "Statement comparison recorded. Any difference is visible; no balance was overwritten.",
  late_fees_assessed: "Due late fees assessed once per overdue installment.",
  loan_originated: "Loan approved and disbursed. The borrower balance and repayment schedule are live.",
  loan_payment_recorded: "Loan payment recorded and allocated to the oldest amount due.",
  loan_payment_reversed: "Latest loan repayment undone. Money and installment allocations were corrected together.",
  loan_product_created: "Loan terms saved and ready to use.",
  money_recorded: "Money movement posted to the ledger.",
  cash_infused: "Cash added to Company Treasury. The books and Treasury balance are updated.",
  period_closed: "Financial period closed. Backdated money in that date range is now blocked.",
  period_reopened: "Financial period reopened with a permanent reason record.",
  transfer_recorded: "Transfer completed. Both account statements were updated.",
};

const errors: Record<string, string> = {
  access_denied: "Your current staff access cannot perform that money action.",
  insufficient_funds: "That account does not have enough available Septims.",
  invalid_input: "Check the money fields and try again.",
  not_invoiceable: "That order is not ready to invoice yet.",
  price_required: "Set every included order price before issuing the invoice.",
  save_failed: "The transaction was not posted. No balance changed.",
  version_conflict: "That record changed while it was open. Refresh and try again.",
};

const bankViewLabels: Array<[View, string]> = [
  ["overview", "Overview"],
  ["accounts", "Accounts"],
  ["transactions", "Move money"],
  ["loans", "Loans"],
];

const booksViewLabels: Array<[View, string]> = [
  ["overview", "Overview"],
  ["invoices", "Sales"],
  ["transactions", "Journal"],
  ["controls", "Controls"],
];

function amount(value: number, currency: string = REGISTRY_CONFIG.currency.code) {
  return `${new Intl.NumberFormat().format(value)} ${currency}`;
}

function percent(basisPoints: number) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(basisPoints / 100)}%`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function later(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function previousDay() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function previousDayMonthStart() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  date.setUTCDate(1);
  return date.toISOString().slice(0, 10);
}

function bankAccountOptions(workspace: BankingWorkspace, includeTreasury = true) {
  return workspace.accounts.filter((account) =>
    account.status === "active" && (includeTreasury || account.account_type !== "company_treasury")
  );
}

function companyLedgerTransactions(workspace: BankingWorkspace) {
  return workspace.transactions.filter((transaction) =>
    transaction.from_account.includes("Treasury") || transaction.to_account.includes("Treasury")
  );
}

function CompanyOverview({ workspace }: { workspace: BankingWorkspace }) {
  const summary = workspace.summaries.find((row) => row.currency_code === REGISTRY_CONFIG.currency.code) ?? workspace.summaries[0];
  if (!summary) return <p className="empty-state">No active currency is configured.</p>;
  const openInvoices = workspace.invoices.filter((invoice) => ["open", "partially_paid"].includes(invoice.status));
  const companyTransactions = companyLedgerTransactions(workspace);
  return <>
    <section className="bank-summary-grid" aria-label="Company books summary">
      <article className={summary.treasury_balance_minor < 0 ? "needs-attention" : ""}><span>Company Treasury</span><strong>{amount(summary.treasury_balance_minor, summary.currency_code)}</strong><small>Actual ledger balance</small></article>
      <article><span>Customers owe</span><strong>{amount(summary.receivable_minor, summary.currency_code)}</strong><small>{openInvoices.length} open invoices</small></article>
      <article><span>We owe suppliers</span><strong>{amount(summary.outstanding_total_minor, summary.currency_code)}</strong><small>Recorded unpaid deliveries</small></article>
      <article><span>Purchases · 30 days</span><strong>{amount(summary.paid_30d_minor, summary.currency_code)}</strong><small>Recorded Company spending</small></article>
      <article><span>Money in · 30 days</span><strong>{amount(summary.money_in_30d_minor, summary.currency_code)}</strong><small>Posted to Treasury</small></article>
      <article><span>Money out · 30 days</span><strong>{amount(summary.money_out_30d_minor, summary.currency_code)}</strong><small>Posted from Treasury</small></article>
    </section>

    {workspace.capabilities.can_post && <section className="bank-panel bank-cash-infusion">
      <div className="bank-panel-heading"><div><p className="eyebrow">Company cash</p><h2>Add cash to Treasury</h2><p>Use this for owner funding, starting cash, or another cash infusion. It is not recorded as a sale.</p></div></div>
      <form action={treasuryCashInfusionAction} className="bank-action-form bank-infusion-form">
        <input name="currency_code" type="hidden" value={summary.currency_code}/>
        <label><span>Amount</span><div className="money-input"><input min="1" name="amount_minor" placeholder="0" required step="1" type="number"/><strong>{summary.currency_code}</strong></div></label>
        <label><span>Date</span><input defaultValue={today()} name="occurred_on" required type="date"/></label>
        <label><span>Source or reference <small>optional</small></span><input name="source_reference" placeholder="Owner purse, opening funds…"/></label>
        <label><span>Note <small>optional</small></span><input name="note" placeholder="Why cash was added"/></label>
        <button className="button button-primary">Add cash</button>
      </form>
    </section>}

    {(summary.overdue_minor > 0 || workspace.unpriced_purchase_count > 0) && <section className="bank-attention-strip">
      <div><p className="eyebrow">Needs attention</p><h2>Money work waiting for you</h2></div>
      <div className="bank-attention-items">
        {summary.overdue_minor > 0 && <Link href="/staff/books?view=invoices"><strong>{amount(summary.overdue_minor, summary.currency_code)}</strong><span>overdue invoices</span></Link>}
        {workspace.unpriced_purchase_count > 0 && <Link href="/staff/activity"><strong>{workspace.unpriced_purchase_count}</strong><span>unpriced purchases</span></Link>}
      </div>
    </section>}

    <section className="bank-two-column">
      <div className="bank-panel"><div className="bank-panel-heading"><div><p className="eyebrow">Receivables</p><h2>Open invoices</h2></div><Link href="/staff/books?view=invoices">View all</Link></div>
        <div className="bank-list">{openInvoices.slice(0, 5).map((invoice) => <article key={invoice.id}><div><strong>{invoice.party_name}</strong><span>{invoice.public_reference} · {invoice.order_reference}</span></div><div><strong>{amount(invoice.balance_due_minor, invoice.currency_code)}</strong><span>{invoice.due_on ? `Due ${invoice.due_on}` : "No due date"}</span></div></article>)}</div>
        {!openInvoices.length && <p className="empty-state">Nothing is currently owed to the Company.</p>}
      </div>
      <div className="bank-panel"><div className="bank-panel-heading"><div><p className="eyebrow">Latest ledger activity</p><h2>Recent money movement</h2></div><Link href="/staff/books?view=transactions">View all</Link></div>
        <div className="bank-list">{companyTransactions.slice(0, 5).map((transaction) => <article key={transaction.id}><div><strong>{transaction.memo}</strong><span>{transaction.from_account} → {transaction.to_account}</span></div><div><strong>{amount(transaction.amount_minor, transaction.currency_code)}</strong><span>{transaction.occurred_on}</span></div></article>)}</div>
        {!companyTransactions.length && <p className="empty-state">No Company money has moved yet. Add starting cash when it exists.</p>}
      </div>
    </section>
  </>;
}

function BankOverview({ workspace }: { workspace: BankingWorkspace }) {
  const summary = workspace.summaries.find((row) => row.currency_code === REGISTRY_CONFIG.currency.code) ?? workspace.summaries[0];
  if (!summary) return <p className="empty-state">No active currency is configured.</p>;
  const customerAccounts = workspace.accounts.filter((account) => ["business", "personal", "escrow"].includes(account.account_type));
  const activeLoans = workspace.loans.filter((loan) => ["active", "defaulted"].includes(loan.status));
  const bankTransactions = workspace.transactions.filter((transaction) => ["deposit", "withdrawal", "transfer", "loan_disbursement", "loan_payment"].includes(transaction.transaction_type));
  return <>
    <section className="bank-summary-grid" aria-label="Bank summary">
      <article><span>Customer deposits</span><strong>{amount(summary.customer_deposits_minor, summary.currency_code)}</strong><small>Across {customerAccounts.length} accounts shown</small></article>
      <article><span>Active accounts</span><strong>{customerAccounts.filter((account) => account.status === "active").length}</strong><small>Business, personal, and escrow</small></article>
      <article><span>Loan principal out</span><strong>{amount(summary.loan_principal_outstanding_minor, summary.currency_code)}</strong><small>{activeLoans.length} active loans</small></article>
      <article className={summary.loan_overdue_minor > 0 ? "needs-attention" : ""}><span>Overdue loans</span><strong>{amount(summary.loan_overdue_minor, summary.currency_code)}</strong><small>Needs collection attention</small></article>
    </section>
    <section className="bank-two-column">
      <div className="bank-panel"><div className="bank-panel-heading"><div><p className="eyebrow">Banking</p><h2>Customer accounts</h2></div><Link href="/staff/money?view=accounts">Open register</Link></div><p>Find an account, inspect its statement, place a hold, freeze it, or change its status.</p></div>
      <div className="bank-panel"><div className="bank-panel-heading"><div><p className="eyebrow">Latest bank activity</p><h2>Recent movement</h2></div><Link href="/staff/money?view=transactions">View all</Link></div><div className="bank-list">{bankTransactions.slice(0, 5).map((transaction) => <article key={transaction.id}><div><strong>{transaction.memo}</strong><span>{transaction.from_account} → {transaction.to_account}</span></div><div><strong>{amount(transaction.amount_minor, transaction.currency_code)}</strong><span>{transaction.occurred_on}</span></div></article>)}</div>{!bankTransactions.length && <p className="empty-state">No customer banking activity yet.</p>}</div>
    </section>
  </>;
}

function Accounts({ register, search, status, workspace }: {
  register: BankAccountRegister;
  search: string;
  status?: "active" | "frozen" | "closed";
  workspace: BankingWorkspace;
}) {
  const currentPage = Math.floor(register.offset / register.limit) + 1;
  const pageCount = Math.max(1, Math.ceil(register.total / register.limit));
  const pageHref = (page: number) => `/staff/money?${new URLSearchParams({
    view: "accounts",
    ...(search ? { q: search } : {}),
    ...(status ? { status } : {}),
    page: String(page),
  }).toString()}`;
  return <section className="bank-panel">
    <div className="bank-panel-heading"><div><p className="eyebrow">Account register</p><h2>{register.total} accounts</h2><p>Balances are calculated from posted entries. Holds reduce only what is available.</p></div>
      {workspace.capabilities.can_manage_accounts && <details className="bank-action-menu"><summary className="button button-primary">Open an account</summary><form action={createAccountAction} className="bank-action-form">
        <label><span>Account name</span><input name="display_name" placeholder="Example: Solitude Tailor" required /></label>
        <div className="bank-form-row"><label><span>Type</span><select name="account_type"><option value="business">Business</option><option value="personal">Personal</option><option value="escrow">Escrow</option></select></label><label><span>Currency</span><input defaultValue={REGISTRY_CONFIG.currency.code} name="currency_code" required /></label></div>
        <label><span>Owner or business optional</span><select name="party_id"><option value="">No linked registry party</option>{workspace.parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label>
        <label><span>Opening balance</span><input defaultValue="0" min="0" name="opening_balance_minor" step="1" type="number" /></label>
        <label><span>Note optional</span><input name="note" /></label><button className="button button-primary">Open account</button>
      </form></details>}
    </div>
    <form className="bank-register-search" method="get"><input name="view" type="hidden" value="accounts"/><label><span className="sr-only">Find an account</span><input defaultValue={search} name="q" placeholder="Find a name or account number…"/></label><select defaultValue={status ?? ""} name="status"><option value="">All statuses</option><option value="active">Active</option><option value="frozen">Frozen</option><option value="closed">Closed</option></select><button className="button button-secondary">Search</button></form>
    <div className="bank-table-wrap"><table className="bank-table"><thead><tr><th>Account</th><th>Owner</th><th>Balance</th><th>Available</th><th>Status</th></tr></thead><tbody>{register.rows.map((account) => <tr key={account.id}><td><Link href={`/staff/money/accounts/${account.id}`}><strong>{account.display_name}</strong></Link><small>{account.public_reference} · {account.account_type.replaceAll("_", " ")}</small></td><td>{account.party_name ?? "—"}</td><td>{amount(account.balance_minor, account.currency_code)}</td><td>{amount(account.available_balance_minor, account.currency_code)}{account.active_hold_minor > 0 && <small>{amount(account.active_hold_minor, account.currency_code)} held</small>}</td><td><span className={`money-status is-${account.status}`}>{account.status}</span></td></tr>)}</tbody></table></div>
    {!register.rows.length && <p className="empty-state">No accounts match that search.</p>}
    {pageCount > 1 && <nav className="bank-pagination" aria-label="Account pages"><span>Page {currentPage} of {pageCount}</span><div>{currentPage > 1 && <Link className="button button-secondary" href={pageHref(currentPage - 1)}>Previous</Link>}{currentPage < pageCount && <Link className="button button-secondary" href={pageHref(currentPage + 1)}>Next</Link>}</div></nav>}
  </section>;
}

function Transactions({ scope, workspace }: { scope: "bank" | "books"; workspace: BankingWorkspace }) {
  const accounts = bankAccountOptions(workspace, false);
  const transactions = scope === "books" ? companyLedgerTransactions(workspace) : workspace.transactions.filter((transaction) =>
    ["deposit", "withdrawal", "transfer", "loan_disbursement", "loan_payment"].includes(transaction.transaction_type)
  );
  return <>
    {scope === "bank" && workspace.capabilities.can_post && <section className="bank-quick-actions">
      <details><summary><strong>Deposit or withdraw</strong><span>Cash entering or leaving one account</span></summary><form action={cashMovementAction} className="bank-action-form"><div className="bank-form-row"><label><span>Action</span><select name="direction"><option value="deposit">Deposit</option><option value="withdrawal">Withdraw</option></select></label><label><span>Account</span><select name="account_id" required>{accounts.map((account) => <option key={account.id} value={account.id}>{account.display_name} · {amount(account.available_balance_minor, account.currency_code)}</option>)}</select></label></div><div className="bank-form-row"><label><span>Amount</span><input min="1" name="amount_minor" required step="1" type="number" /></label><label><span>Date</span><input defaultValue={today()} name="occurred_on" required type="date" /></label></div><label><span>What was this for?</span><input name="memo" required /></label><label><span>Receipt or reference optional</span><input name="reference" /></label><button className="button button-primary">Post money movement</button></form></details>
      <details><summary><strong>Transfer</strong><span>Move Septims between two accounts</span></summary><form action={transferAction} className="bank-action-form"><div className="bank-form-row"><label><span>From</span><select name="from_account_id" required>{accounts.map((account) => <option key={account.id} value={account.id}>{account.display_name} · {amount(account.available_balance_minor, account.currency_code)}</option>)}</select></label><label><span>To</span><select name="to_account_id" required>{accounts.map((account) => <option key={account.id} value={account.id}>{account.display_name}</option>)}</select></label></div><div className="bank-form-row"><label><span>Amount</span><input min="1" name="amount_minor" required step="1" type="number" /></label><label><span>Date</span><input defaultValue={today()} name="occurred_on" required type="date" /></label></div><label><span>What was this for?</span><input name="memo" required /></label><label><span>Reference optional</span><input name="reference" /></label><button className="button button-primary">Transfer Septims</button></form></details>
    </section>}
    <section className="bank-panel"><div className="bank-panel-heading"><div><p className="eyebrow">Immutable journal</p><h2>{scope === "books" ? "Company ledger" : "Bank activity"}</h2><p>Corrections create a reversal. Posted rows are never rewritten.</p></div><span>{transactions.length} recent entries</span></div><div className="bank-table-wrap"><table className="bank-table"><thead><tr><th>Date</th><th>Transaction</th><th>From → To</th><th>Amount</th><th>Source</th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.id}><td>{transaction.occurred_on}</td><td><strong>{transaction.memo}</strong><small>{transaction.public_reference} · {transaction.transaction_type.replaceAll("_", " ")}{transaction.is_reversed ? " · reversed" : ""}</small></td><td>{transaction.from_account}<small>→ {transaction.to_account}</small></td><td>{amount(transaction.amount_minor, transaction.currency_code)}</td><td>{transaction.source_reference ?? transaction.external_reference ?? "Manual"}</td></tr>)}</tbody></table></div></section>
  </>;
}

function Invoices({ workspace }: { workspace: BankingWorkspace }) {
  const payerAccounts = bankAccountOptions(workspace, false).filter((account) => ["business", "personal", "escrow"].includes(account.account_type));
  return <>
    <section className="bank-panel"><div className="bank-panel-heading"><div><p className="eyebrow">Ready to bill</p><h2>Orders without an invoice</h2><p>Only approved, fully priced orders appear here.</p></div><span>{workspace.unbilled_orders.length}</span></div><div className="bank-list">{workspace.unbilled_orders.map((order) => <article key={order.id}><div><strong>{order.party_name}</strong><span>{order.public_reference} · {order.status.replaceAll("_", " ")}</span></div><div><strong>{amount(order.total_amount_minor, order.currency_code)}</strong>{workspace.capabilities.can_invoice && <form action={issueInvoiceAction} className="bank-inline-form"><input name="order_id" type="hidden" value={order.id}/><input name="issued_on" type="hidden" value={today()}/><input name="due_on" type="hidden" value={later(14)}/><input name="note" type="hidden" value="Order invoice"/><button className="button button-primary">Issue invoice</button></form>}</div></article>)}</div>{!workspace.unbilled_orders.length && <p className="empty-state">Every eligible order has been invoiced.</p>}</section>
    <section className="bank-panel">
      <div className="bank-panel-heading"><div><p className="eyebrow">Accounts receivable</p><h2>Invoices</h2></div><span>{workspace.invoices.length}</span></div>
      <div className="bank-invoice-list">{workspace.invoices.map((invoice) => <article key={invoice.id}>
        <div className="bank-invoice-main">
          <span className={`money-status is-${invoice.status}`}>{invoice.status.replaceAll("_", " ")}</span>
          <div><strong>{invoice.party_name}</strong><span>{invoice.public_reference} · <Link href={`/staff/orders/${invoice.order_id}`}>{invoice.order_reference}</Link></span></div>
          <div><strong>{amount(invoice.balance_due_minor, invoice.currency_code)} due</strong><span>{amount(invoice.paid_amount_minor, invoice.currency_code)} paid of {amount(invoice.total_amount_minor, invoice.currency_code)}</span></div>
        </div>
        {["open", "partially_paid"].includes(invoice.status) && workspace.capabilities.can_invoice && <details>
          <summary>Record payment</summary>
          <form action={recordInvoicePaymentAction} className="bank-action-form">
            <input name="invoice_id" type="hidden" value={invoice.id}/>
            <div className="bank-form-row"><label><span>Amount</span><input defaultValue={invoice.balance_due_minor} max={invoice.balance_due_minor} min="1" name="amount_minor" required step="1" type="number" /></label><label><span>Date</span><input defaultValue={today()} name="occurred_on" required type="date" /></label></div>
            <label><span>Paid from</span><select name="from_account_id"><option value="">Cash or payment outside the bank</option>{payerAccounts.filter((account) => account.currency_code === invoice.currency_code).map((account) => <option key={account.id} value={account.id}>{account.display_name} · {amount(account.available_balance_minor, account.currency_code)}</option>)}</select></label>
            <label><span>Receipt or payment reference</span><input name="payment_reference" required /></label>
            <label><span>Note optional</span><input name="note" /></label>
            <button className="button button-primary">Record payment</button>
          </form>
        </details>}
        {invoice.paid_amount_minor > 0 && workspace.capabilities.can_reverse && <details className="bank-correction-action">
          <summary>Undo latest payment</summary>
          <form action={reverseInvoicePaymentAction} className="bank-action-form">
            <input name="record_id" type="hidden" value={invoice.id}/>
            <input name="expected_version" type="hidden" value={invoice.version}/>
            <label><span>Why is this being corrected?</span><input name="reason" placeholder="Example: payment entered twice" required /></label>
            <button className="button button-secondary">Undo latest payment</button>
          </form>
        </details>}
      </article>)}</div>
      {!workspace.invoices.length && <p className="empty-state">No invoices have been issued.</p>}
    </section>
  </>;
}

function Loans({ workspace }: { workspace: BankingWorkspace }) {
  const borrowerAccounts = workspace.accounts.filter((account) => account.status === "active" && ["business", "personal"].includes(account.account_type));
  const products = workspace.loan_products.filter((product) => product.active);
  return <section className="bank-panel"><div className="bank-panel-heading"><div><p className="eyebrow">Lending desk</p><h2>Loans</h2><p>Disbursement and repayment move real account balances. The schedule tracks principal, interest, and arrears.</p></div><div className="staff-button-row">
    {workspace.capabilities.can_manage_accounts && <details className="bank-action-menu"><summary className="button button-secondary">Loan terms</summary><form action={createLoanProductAction} className="bank-action-form"><label><span>Name</span><input name="display_name" placeholder="Standard Company Loan" required /></label><label><span>Short code</span><input name="code" placeholder="standard-loan" required /></label><div className="bank-form-row"><label><span>Annual interest · basis points</span><input defaultValue="1000" min="0" name="annual_rate_basis_points" required step="1" type="number" /></label><label><span>Payments</span><select name="repayment_frequency"><option value="monthly">Monthly</option><option value="weekly">Weekly</option></select></label></div><input name="minimum_term_count" type="hidden" value="1"/><input name="maximum_term_count" type="hidden" value="52"/><input name="minimum_principal_minor" type="hidden" value="1"/><input name="maximum_principal_minor" type="hidden" value=""/><input name="grace_days" type="hidden" value="3"/><input name="late_fee_minor" type="hidden" value="0"/><input name="description" type="hidden" value="Configurable Company lending terms."/><button className="button button-primary">Save loan terms</button></form></details>}
    {workspace.capabilities.can_manage_accounts && products.length > 0 && borrowerAccounts.length > 0 && <details className="bank-action-menu"><summary className="button button-primary">New loan</summary><form action={originateLoanAction} className="bank-action-form"><label><span>Borrower account</span><select name="borrower_account_id" required>{borrowerAccounts.map((account) => <option key={account.id} value={account.id}>{account.display_name} · {amount(account.balance_minor, account.currency_code)}</option>)}</select></label><label><span>Loan terms</span><select name="loan_product_id" required>{products.map((product) => <option key={product.id} value={product.id}>{product.display_name} · {percent(product.annual_rate_basis_points)} · {product.repayment_frequency}</option>)}</select></label><div className="bank-form-row"><label><span>Principal</span><input min="1" name="principal_minor" required step="1" type="number" /></label><label><span>Number of payments</span><input defaultValue="12" min="1" name="term_count" required step="1" type="number" /></label></div><div className="bank-form-row"><label><span>Start date</span><input defaultValue={today()} name="originated_on" required type="date" /></label><label><span>First payment</span><input defaultValue={later(30)} name="first_due_on" required type="date" /></label></div><label><span>Purpose optional</span><input name="purpose" /></label><button className="button button-primary">Approve and disburse</button></form></details>}
  </div></div>
    <div className="bank-loan-list">{workspace.loans.map((loan) => <article key={loan.id}>
      <div className="bank-loan-summary">
        <span className={`money-status is-${loan.status}`}>{loan.status}</span>
        <div><Link href={`/staff/money/loans/${loan.id}`}><strong>{loan.borrower_name ?? loan.borrower_account_name}</strong></Link><span>{loan.public_reference} · {loan.product_name} · {percent(loan.annual_rate_basis_points)}</span></div>
        <div><strong>{amount(loan.remaining_due_minor, loan.currency_code)} remaining</strong><span>{loan.overdue_minor > 0 ? `${amount(loan.overdue_minor, loan.currency_code)} overdue` : loan.next_due_on ? `Next due ${loan.next_due_on}` : "Schedule complete"}</span></div>
      </div>
      {["active", "defaulted"].includes(loan.status) && workspace.capabilities.can_post && <details>
        <summary>Record repayment</summary>
        <form action={recordLoanPaymentAction} className="bank-action-form">
          <input name="loan_id" type="hidden" value={loan.id}/>
          <div className="bank-form-row"><label><span>Amount</span><input max={loan.remaining_due_minor} min="1" name="amount_minor" required step="1" type="number" /></label><label><span>Date</span><input defaultValue={today()} name="occurred_on" required type="date" /></label></div>
          <label><span>Payment reference optional</span><input name="payment_reference" /></label>
          <input name="note" type="hidden" value="Loan repayment"/>
          <button className="button button-primary">Post repayment</button>
        </form>
      </details>}
      {loan.principal_paid_minor + loan.interest_paid_minor > 0 && workspace.capabilities.can_reverse && <details className="bank-correction-action">
        <summary>Undo latest repayment</summary>
        <form action={reverseLoanPaymentAction} className="bank-action-form">
          <input name="record_id" type="hidden" value={loan.id}/>
          <input name="expected_version" type="hidden" value={loan.version}/>
          <label><span>Why is this being corrected?</span><input name="reason" placeholder="Example: wrong amount recorded" required /></label>
          <button className="button button-secondary">Undo latest repayment</button>
        </form>
      </details>}
    </article>)}</div>
    {!workspace.loans.length && <p className="empty-state">No loans have been issued. Create loan terms, then approve the first loan.</p>}
  </section>;
}

function Controls({ controls, workspace }: { controls: BankingControls; workspace: BankingWorkspace }) {
  const accounts = bankAccountOptions(workspace);
  return <>
    {controls.can_manage && <section className="bank-quick-actions bank-control-actions">
      <details>
        <summary><strong>Compare an account</strong><span>Record whether a counted balance matches the ledger</span></summary>
        <form action={reconcileAccountAction} className="bank-action-form">
          <label><span>Account</span><select name="account_id" required>{accounts.map((account) => <option key={account.id} value={account.id}>{account.display_name} · {account.public_reference}</option>)}</select></label>
          <div className="bank-form-row"><label><span>Counted balance</span><input name="statement_balance_minor" required step="1" type="number" /></label><label><span>Counted through</span><input defaultValue={today()} max={today()} name="statement_through" required type="date" /></label></div>
          <label><span>Note optional</span><input name="note" placeholder="Where the count came from" /></label>
          <button className="button button-primary">Record comparison</button>
        </form>
      </details>
      <details>
        <summary><strong>Close a period</strong><span>Lock finished dates against new backdated entries</span></summary>
        <form action={closeFinancialPeriodAction} className="bank-action-form">
          <div className="bank-form-row"><label><span>From</span><input defaultValue={previousDayMonthStart()} name="starts_on" required type="date" /></label><label><span>Through</span><input defaultValue={previousDay()} max={previousDay()} name="ends_on" required type="date" /></label></div>
          <label><span>Note optional</span><input name="note" placeholder="Example: August books checked" /></label>
          <button className="button button-primary">Close these dates</button>
        </form>
      </details>
      <details>
        <summary><strong>Assess late fees</strong><span>{controls.eligible_late_fee_count} overdue payment{controls.eligible_late_fee_count === 1 ? "" : "s"} eligible now</span></summary>
        <form action={assessLateFeesAction} className="bank-action-form">
          <input name="as_of" type="hidden" value={today()}/>
          <input name="reason" type="hidden" value="Routine overdue-loan review."/>
          <p>{controls.eligible_late_fee_count > 0 ? "Each eligible overdue installment receives its configured fee once." : "Nothing is currently eligible. Running this check will make no duplicate charges."}</p>
          <button className="button button-primary">Run today&apos;s late fees</button>
        </form>
      </details>
    </section>}

    <section className="bank-panel">
      <div className="bank-panel-heading"><div><p className="eyebrow">Balance checks</p><h2>Reconciliations</h2><p>A difference is shown for investigation; it never changes the ledger.</p></div><span>{controls.reconciliations.length}</span></div>
      <div className="bank-table-wrap"><table className="bank-table"><thead><tr><th>Date</th><th>Account</th><th>Counted</th><th>Ledger</th><th>Difference</th><th>Status</th></tr></thead><tbody>{controls.reconciliations.map((row) => <tr key={row.id}><td>{row.statement_through}<small>{row.public_reference}</small></td><td><Link href={`/staff/money/accounts/${row.account_id}`}>{row.account_name}</Link><small>{row.account_reference}</small></td><td>{amount(row.statement_balance_minor, row.currency_code)}</td><td>{amount(row.ledger_balance_minor, row.currency_code)}</td><td>{amount(row.difference_minor, row.currency_code)}</td><td><span className={`money-status is-${row.status}`}>{row.status}</span></td></tr>)}</tbody></table></div>
      {!controls.reconciliations.length && <p className="empty-state">No balance comparisons have been recorded yet.</p>}
    </section>

    <section className="bank-panel">
      <div className="bank-panel-heading"><div><p className="eyebrow">Bookkeeping lock</p><h2>Closed periods</h2><p>Closed dates reject new backdated money. Reopening keeps the original close and the reason.</p></div><span>{controls.periods.length}</span></div>
      <div className="bank-table-wrap"><table className="bank-table"><thead><tr><th>Period</th><th>Dates</th><th>Accounts captured</th><th>Status</th><th>Action</th></tr></thead><tbody>{controls.periods.map((period) => <tr key={period.id}><td><strong>{period.public_reference}</strong><small>{period.note || "No note"}</small></td><td>{period.starts_on}<small>through {period.ends_on}</small></td><td>{period.account_count}</td><td><span className={`money-status is-${period.status}`}>{period.status}</span></td><td>{period.status === "closed" && controls.can_manage ? <details className="bank-table-action"><summary>Reopen</summary><form action={reopenFinancialPeriodAction} className="bank-action-form"><input name="period_id" type="hidden" value={period.id}/><input name="expected_version" type="hidden" value={period.version}/><label><span>Why must it reopen?</span><input name="reason" required /></label><button className="button button-secondary">Reopen period</button></form></details> : "—"}</td></tr>)}</tbody></table></div>
      {!controls.periods.length && <p className="empty-state">No periods have been closed yet.</p>}
    </section>

    <section className="bank-panel">
      <div className="bank-panel-heading"><div><p className="eyebrow">Loan charges</p><h2>Late-fee runs</h2></div><span>{controls.fee_runs.length}</span></div>
      <div className="bank-table-wrap"><table className="bank-table"><thead><tr><th>Run date</th><th>Installments charged</th><th>Total</th><th>Recorded</th></tr></thead><tbody>{controls.fee_runs.map((run) => <tr key={run.id}><td>{run.assessed_as_of}</td><td>{run.assessed_count}</td><td>{amount(run.total_amount_minor)}</td><td>{new Date(run.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>
      {!controls.fee_runs.length && <p className="empty-state">No late-fee runs have been recorded.</p>}
    </section>
  </>;
}

export default async function MoneyPage({ searchParams }: MoneyPageProps) {
  const parameters = await searchParams;
  const scope = parameters.scope === "books" ? "books" : "bank";
  const viewLabels = scope === "books" ? booksViewLabels : bankViewLabels;
  const view = viewLabels.some(([value]) => value === parameters.view) ? parameters.view as View : "overview";
  const basePath = scope === "books" ? "/staff/books" : "/staff/money";
  const { client } = await requireStaffSession();
  const accountStatus = ["active", "frozen", "closed"].includes(parameters.status ?? "")
    ? parameters.status as "active" | "frozen" | "closed"
    : undefined;
  const accountPage = Math.max(1, Number.parseInt(parameters.page ?? "1", 10) || 1);
  const [result, accountResult, controlsResult] = await Promise.all([
    getStaffBankingWorkspace(client),
    view === "accounts"
      ? getStaffBankCustomerAccountRegister(client, { search: parameters.q, status: accountStatus, limit: 50, offset: (accountPage - 1) * 50 })
      : Promise.resolve(null),
    view === "controls" ? getStaffBankingControls(client) : Promise.resolve(null),
  ]);
  if (!result.ok && result.code === "access_denied") return <main className="staff-main"><StaffAccessDenied /></main>;
  if (!result.ok) return <main className="staff-main"><section className="notice-panel"><h1>Banking records unavailable</h1><p>No balance was guessed or cached.</p></section></main>;
  const workspace = result.data;

  return <main className="staff-main bank-workspace">
    <header className="staff-page-header"><div><p className="eyebrow">{scope === "books" ? "East Empire Company accounting" : "East Empire Company Bank"}</p><h1>{scope === "books" ? "Company books" : "Bank"}</h1><p>{scope === "books" ? "Treasury, sales, spending, cash infusions, and the Company ledger." : "Customer accounts, transfers, statements, holds, and loans."}</p></div>{scope === "books" ? <Link className="button button-secondary" href="/staff/activity">Record stock activity</Link> : <Link className="button button-secondary" href="/staff/books">Open Company books</Link>}</header>
    {(parameters.notice && notices[parameters.notice]) && <p className="notice-panel notice-success">{notices[parameters.notice]}</p>}
    {(parameters.error && errors[parameters.error]) && <p className="notice-panel notice-error">{errors[parameters.error]}</p>}
    <nav className="bank-tabs" aria-label={scope === "books" ? "Company books sections" : "Bank sections"}>{viewLabels.map(([value, label]) => <Link aria-current={view === value ? "page" : undefined} href={`${basePath}?view=${value}`} key={value}>{label}</Link>)}</nav>
    {view === "overview" && (scope === "books" ? <CompanyOverview workspace={workspace}/> : <BankOverview workspace={workspace}/>)}
    {view === "accounts" && accountResult?.ok && <Accounts register={accountResult.data} search={parameters.q?.trim() ?? ""} status={accountStatus} workspace={workspace}/>}
    {view === "accounts" && accountResult && !accountResult.ok && <section className="notice-panel"><h2>Account register unavailable</h2><p>The summary remains available, but no account list was substituted.</p></section>}
    {view === "invoices" && <Invoices workspace={workspace}/>}
    {view === "transactions" && <Transactions scope={scope} workspace={workspace}/>}
    {view === "loans" && <Loans workspace={workspace}/>}
    {view === "controls" && controlsResult?.ok && <Controls controls={controlsResult.data} workspace={workspace}/>}
    {view === "controls" && controlsResult && !controlsResult.ok && <section className="notice-panel"><h2>Bank controls unavailable</h2><p>No close, correction, fee, or reconciliation was attempted.</p></section>}
    <details className="bank-system-note"><summary>How these numbers stay trustworthy</summary><p>Company books and the Bank are two simple views of the same Supabase ledger. Every movement has equal money-out and money-in entries, and balances are calculated instead of typed over. Cash infusions enter Treasury without becoming sales; orders create receivables; purchases create expenses; customer accounts and loans remain in the Bank.</p></details>
  </main>;
}
