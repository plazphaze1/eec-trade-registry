import Link from "next/link";

import { recordLoanPaymentAction, setLoanStatusAction } from "@/app/staff/money/actions";
import { StaffAccessDenied } from "@/components/staff-access-denied";
import { getStaffLoan } from "@/lib/banking";
import { requireStaffSession } from "@/lib/staff-auth";

interface LoanPageProps { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }

function amount(value: number, currency: string) { return `${new Intl.NumberFormat().format(value)} ${currency}`; }
function percent(value: number) { return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value / 100)}%`; }
function today() { return new Date().toISOString().slice(0, 10); }

export default async function LoanPage({ params, searchParams }: LoanPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { client } = await requireStaffSession();
  const result = await getStaffLoan(client, id);
  if (!result.ok && result.code === "access_denied") return <main className="staff-main"><StaffAccessDenied /></main>;
  if (!result.ok) return <main className="staff-main"><section className="notice-panel"><h1>Loan unavailable</h1><p>No schedule was guessed or cached.</p><Link href="/staff/money?view=loans">Return to loans</Link></section></main>;
  const { capabilities, installments, loan, payments } = result.data;
  const remaining = installments.reduce((sum, installment) => sum + installment.balance_due_minor, 0);
  const overdue = installments.filter((installment) => installment.balance_due_minor > 0 && new Date(installment.due_on) < new Date());

  return <main className="staff-main bank-loan-detail">
    <header className="staff-page-header"><div><p className="eyebrow">{loan.public_reference}</p><h1>{loan.borrower_name ?? loan.borrower_account_name}</h1><p>{loan.product_name} · {percent(loan.annual_rate_basis_points)} annual interest · {loan.repayment_frequency}</p></div><Link className="button button-secondary" href="/staff/money?view=loans">All loans</Link></header>
    {query.notice === "status_updated" && <p className="notice-panel notice-success">Loan status updated.</p>}
    <section className="bank-account-hero"><div><span>Original principal</span><strong>{amount(loan.principal_minor, loan.currency_code)}</strong></div><div><span>Remaining scheduled</span><strong>{amount(remaining, loan.currency_code)}</strong></div><div><span>Status</span><strong className={`money-status is-${loan.status}`}>{loan.status}</strong></div></section>

    <section className="bank-quick-actions">
      {capabilities.can_post && ["active", "defaulted"].includes(loan.status) && remaining > 0 && <details><summary><strong>Record repayment</strong><span>Allocates fees, interest, then principal to the oldest balance</span></summary><form action={recordLoanPaymentAction} className="bank-action-form"><input name="loan_id" type="hidden" value={loan.id}/><label><span>Amount</span><input max={remaining} min="1" name="amount_minor" required step="1" type="number"/></label><label><span>Date</span><input defaultValue={today()} name="occurred_on" required type="date"/></label><label><span>Payment reference optional</span><input name="payment_reference"/></label><input name="note" type="hidden" value={`Loan payment ${loan.public_reference}`}/><button className="button button-primary">Post repayment</button></form></details>}
      {capabilities.can_manage && loan.status !== "paid" && <details><summary><strong>Change loan status</strong><span>Mark default, restore active servicing, or write off</span></summary><form action={setLoanStatusAction} className="bank-action-form"><input name="expected_version" type="hidden" value={loan.version}/><input name="loan_id" type="hidden" value={loan.id}/><label><span>New status</span><select name="status"><option value="active">Active</option><option value="defaulted">Defaulted</option><option value="written_off">Written off</option></select></label><label><span>Reason</span><input name="reason" required/></label><button className="button button-primary">Update loan</button></form></details>}
    </section>

    {overdue.length > 0 && <section className="bank-attention-strip"><div><p className="eyebrow">Past due</p><h2>{overdue.length} installment{overdue.length === 1 ? " is" : "s are"} overdue</h2></div><strong>{amount(overdue.reduce((sum, row) => sum + row.balance_due_minor, 0), loan.currency_code)}</strong></section>}

    <section className="bank-panel"><div className="bank-panel-heading"><div><p className="eyebrow">Repayment schedule</p><h2>{installments.length} installments</h2><p>Principal, interest, fees, payments, and balances are recorded separately.</p></div><Link href={`/staff/money/accounts/${loan.borrower_account_id}`}>Borrower account</Link></div><div className="bank-table-wrap"><table className="bank-table"><thead><tr><th>#</th><th>Due</th><th>Principal</th><th>Interest</th><th>Fees</th><th>Remaining</th><th>Status</th></tr></thead><tbody>{installments.map((installment) => <tr key={installment.id}><td>{installment.installment_number}</td><td>{installment.due_on}</td><td>{amount(installment.principal_due_minor, loan.currency_code)}<small>{amount(installment.principal_paid_minor, loan.currency_code)} paid</small></td><td>{amount(installment.interest_due_minor, loan.currency_code)}<small>{amount(installment.interest_paid_minor, loan.currency_code)} paid</small></td><td>{amount(installment.fee_due_minor, loan.currency_code)}<small>{amount(installment.fee_paid_minor, loan.currency_code)} paid</small></td><td>{amount(installment.balance_due_minor, loan.currency_code)}</td><td><span className={`money-status is-${installment.status}`}>{installment.status.replaceAll("_", " ")}</span></td></tr>)}</tbody></table></div></section>
    <section className="bank-panel"><div className="bank-panel-heading"><div><p className="eyebrow">Payment history</p><h2>{payments.length} payments</h2></div></div><div className="bank-list">{payments.map((payment) => <article key={payment.id}><div><strong>{payment.transaction_reference}</strong><span>{payment.occurred_on} · {payment.payment_reference ?? "No external reference"}{payment.is_reversed ? " · reversed" : ""}</span></div><strong>{amount(payment.amount_minor, loan.currency_code)}</strong></article>)}</div>{!payments.length && <p className="empty-state">No repayments have been posted.</p>}</section>
  </main>;
}
