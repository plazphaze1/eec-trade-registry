"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  readAccountForm,
  readAccountHoldForm,
  readAccountStatusForm,
  readCashForm,
  readClosePeriodForm,
  readInvoiceForm,
  readInvoicePaymentForm,
  readLateFeeRunForm,
  readLoanPaymentForm,
  readLoanProductForm,
  readLoanStatusForm,
  readOriginateLoanForm,
  readReleaseHoldForm,
  readReconciliationForm,
  readReopenPeriodForm,
  readPaymentCorrectionForm,
  readTransferForm,
} from "@/lib/banking-form";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type View = "overview" | "accounts" | "invoices" | "transactions" | "loans" | "controls";

function destination(view: View, key: "error" | "notice", value: string) {
  return `/staff/money?${new URLSearchParams({ view, [key]: value }).toString()}`;
}

async function client() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") redirect("/staff/login");
  return supabase;
}

function failure(error: { code?: string; message: string }, view: View) {
  console.error(`[staff-bank:mutation] ${error.code ?? "unknown"}`);
  if (error.message.includes("insufficient_funds")) return destination(view, "error", "insufficient_funds");
  if (error.message.includes("version_conflict")) return destination(view, "error", "version_conflict");
  if (error.message.includes("price_required")) return destination(view, "error", "price_required");
  if (error.message.includes("not_invoiceable")) return destination(view, "error", "not_invoiceable");
  if (error.code === "42501" || error.message.includes("permission_denied")) return destination(view, "error", "access_denied");
  if (["22023", "23514"].includes(error.code ?? "")) return destination(view, "error", "invalid_input");
  return destination(view, "error", "save_failed");
}

function refresh(orderId?: string) {
  for (const path of ["/staff/money", "/staff/dashboard", "/staff/orders", "/staff/activity", "/staff/consignments/finance"]) {
    revalidatePath(path);
  }
  if (orderId) revalidatePath(`/staff/orders/${orderId}`);
}

export async function createAccountAction(form: FormData) {
  const parsed = readAccountForm(form);
  if (!parsed.success) redirect(destination("accounts", "error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("staff_create_financial_account", {
    p_account_type: input.account_type,
    p_currency_code: input.currency_code,
    p_display_name: input.display_name,
    p_note: input.note ?? "",
    p_opening_balance_minor: input.opening_balance_minor,
    p_party_id: input.party_id,
    p_reason: "Financial account opened through the Money workspace.",
    p_request_id: crypto.randomUUID(),
  });
  if (error) redirect(failure(error, "accounts"));
  refresh();
  redirect(destination("accounts", "notice", "account_created"));
}

export async function cashMovementAction(form: FormData) {
  const parsed = readCashForm(form);
  if (!parsed.success) redirect(destination("transactions", "error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("staff_post_cash_movement", {
    p_account_id: input.account_id,
    p_amount_minor: input.amount_minor,
    p_direction: input.direction,
    p_memo: input.memo,
    p_occurred_on: input.occurred_on,
    p_reason: `${input.direction === "deposit" ? "Deposit" : "Withdrawal"} recorded through the Money workspace.`,
    p_reference: input.reference,
    p_request_id: crypto.randomUUID(),
  });
  if (error) redirect(failure(error, "transactions"));
  refresh();
  redirect(destination("transactions", "notice", "money_recorded"));
}

export async function transferAction(form: FormData) {
  const parsed = readTransferForm(form);
  if (!parsed.success) redirect(destination("transactions", "error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("staff_transfer_funds", {
    p_amount_minor: input.amount_minor,
    p_from_account_id: input.from_account_id,
    p_memo: input.memo,
    p_occurred_on: input.occurred_on,
    p_reason: "Account transfer recorded through the Money workspace.",
    p_reference: input.reference,
    p_request_id: crypto.randomUUID(),
    p_to_account_id: input.to_account_id,
  });
  if (error) redirect(failure(error, "transactions"));
  refresh();
  redirect(destination("transactions", "notice", "transfer_recorded"));
}

export async function issueInvoiceAction(form: FormData) {
  const parsed = readInvoiceForm(form);
  if (!parsed.success) redirect(destination("invoices", "error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("staff_issue_order_invoice", {
    p_due_on: input.due_on,
    p_issued_on: input.issued_on,
    p_note: input.note ?? "",
    p_order_id: input.order_id,
    p_reason: "Order invoice issued through the Money workspace.",
    p_request_id: crypto.randomUUID(),
  });
  if (error) redirect(failure(error, "invoices"));
  refresh(input.order_id);
  redirect(destination("invoices", "notice", "invoice_issued"));
}

export async function recordInvoicePaymentAction(form: FormData) {
  const parsed = readInvoicePaymentForm(form);
  if (!parsed.success) redirect(destination("invoices", "error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("staff_record_invoice_payment", {
    p_amount_minor: input.amount_minor,
    p_from_account_id: input.from_account_id,
    p_invoice_id: input.invoice_id,
    p_note: input.note ?? "",
    p_occurred_on: input.occurred_on,
    p_payment_reference: input.payment_reference,
    p_reason: "Invoice payment recorded through the Money workspace.",
    p_request_id: crypto.randomUUID(),
  });
  if (error) redirect(failure(error, "invoices"));
  refresh();
  redirect(destination("invoices", "notice", "invoice_payment_recorded"));
}

export async function createLoanProductAction(form: FormData) {
  const parsed = readLoanProductForm(form);
  if (!parsed.success) redirect(destination("loans", "error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("staff_create_loan_product", {
    p_annual_rate_basis_points: input.annual_rate_basis_points,
    p_code: input.code,
    p_description: input.description ?? "",
    p_display_name: input.display_name,
    p_grace_days: input.grace_days,
    p_late_fee_minor: input.late_fee_minor,
    p_maximum_principal_minor: input.maximum_principal_minor,
    p_maximum_term_count: input.maximum_term_count,
    p_minimum_principal_minor: input.minimum_principal_minor,
    p_minimum_term_count: input.minimum_term_count,
    p_reason: "Loan product configured through the Money workspace.",
    p_repayment_frequency: input.repayment_frequency,
    p_request_id: crypto.randomUUID(),
  });
  if (error) redirect(failure(error, "loans"));
  refresh();
  redirect(destination("loans", "notice", "loan_product_created"));
}

export async function originateLoanAction(form: FormData) {
  const parsed = readOriginateLoanForm(form);
  if (!parsed.success) redirect(destination("loans", "error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("staff_originate_loan", {
    p_borrower_account_id: input.borrower_account_id,
    p_first_due_on: input.first_due_on,
    p_loan_product_id: input.loan_product_id,
    p_originated_on: input.originated_on,
    p_principal_minor: input.principal_minor,
    p_purpose: input.purpose ?? "",
    p_reason: "Loan approved and disbursed through the Money workspace.",
    p_request_id: crypto.randomUUID(),
    p_term_count: input.term_count,
  });
  if (error) redirect(failure(error, "loans"));
  refresh();
  redirect(destination("loans", "notice", "loan_originated"));
}

export async function recordLoanPaymentAction(form: FormData) {
  const parsed = readLoanPaymentForm(form);
  if (!parsed.success) redirect(destination("loans", "error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("staff_record_loan_payment", {
    p_amount_minor: input.amount_minor,
    p_loan_id: input.loan_id,
    p_note: input.note ?? "",
    p_occurred_on: input.occurred_on,
    p_payment_reference: input.payment_reference,
    p_reason: "Loan payment recorded through the Money workspace.",
    p_request_id: crypto.randomUUID(),
  });
  if (error) redirect(failure(error, "loans"));
  refresh();
  redirect(destination("loans", "notice", "loan_payment_recorded"));
}

function accountPath(accountId: string, key: "error" | "notice", value: string) {
  return `/staff/money/accounts/${accountId}?${new URLSearchParams({ [key]: value }).toString()}`;
}

export async function setAccountStatusAction(form: FormData) {
  const parsed = readAccountStatusForm(form);
  if (!parsed.success) redirect(destination("accounts", "error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("staff_set_financial_account_status", {
    p_account_id: input.account_id,
    p_expected_version: input.expected_version,
    p_reason: input.reason,
    p_request_id: crypto.randomUUID(),
    p_status: input.status,
  });
  if (error) redirect(failure(error, "accounts"));
  refresh();
  revalidatePath(`/staff/money/accounts/${input.account_id}`);
  redirect(accountPath(input.account_id, "notice", "status_updated"));
}

export async function placeAccountHoldAction(form: FormData) {
  const parsed = readAccountHoldForm(form);
  if (!parsed.success) redirect(destination("accounts", "error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("staff_place_account_hold", {
    p_account_id: input.account_id,
    p_amount_minor: input.amount_minor,
    p_expires_at: input.expires_at,
    p_reason: input.reason,
    p_related_record_id: null,
    p_related_record_type: null,
    p_request_id: crypto.randomUUID(),
  });
  if (error) redirect(failure(error, "accounts"));
  refresh();
  revalidatePath(`/staff/money/accounts/${input.account_id}`);
  redirect(accountPath(input.account_id, "notice", "hold_placed"));
}

export async function releaseAccountHoldAction(form: FormData) {
  const parsed = readReleaseHoldForm(form);
  if (!parsed.success) redirect(destination("accounts", "error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("staff_release_account_hold", {
    p_expected_version: input.expected_version,
    p_hold_id: input.hold_id,
    p_reason: input.reason,
    p_request_id: crypto.randomUUID(),
  });
  if (error) redirect(failure(error, "accounts"));
  refresh();
  revalidatePath(`/staff/money/accounts/${input.account_id}`);
  redirect(accountPath(input.account_id, "notice", "hold_released"));
}

export async function setLoanStatusAction(form: FormData) {
  const parsed = readLoanStatusForm(form);
  if (!parsed.success) redirect(destination("loans", "error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("staff_mark_loan_default", {
    p_expected_version: input.expected_version,
    p_loan_id: input.loan_id,
    p_reason: input.reason,
    p_request_id: crypto.randomUUID(),
    p_status: input.status,
  });
  if (error) redirect(failure(error, "loans"));
  refresh();
  revalidatePath(`/staff/money/loans/${input.loan_id}`);
  redirect(`/staff/money/loans/${input.loan_id}?notice=status_updated`);
}

export async function reverseInvoicePaymentAction(form: FormData) {
  const parsed = readPaymentCorrectionForm(form);
  if (!parsed.success) redirect(destination("invoices", "error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("staff_reverse_latest_invoice_payment", {
    p_expected_version: input.expected_version,
    p_invoice_id: input.record_id,
    p_reason: input.reason,
    p_request_id: crypto.randomUUID(),
  });
  if (error) redirect(failure(error, "invoices"));
  refresh();
  redirect(destination("invoices", "notice", "invoice_payment_reversed"));
}

export async function reverseLoanPaymentAction(form: FormData) {
  const parsed = readPaymentCorrectionForm(form);
  if (!parsed.success) redirect(destination("loans", "error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("staff_reverse_latest_loan_payment", {
    p_expected_version: input.expected_version,
    p_loan_id: input.record_id,
    p_reason: input.reason,
    p_request_id: crypto.randomUUID(),
  });
  if (error) redirect(failure(error, "loans"));
  refresh();
  revalidatePath(`/staff/money/loans/${input.record_id}`);
  redirect(destination("loans", "notice", "loan_payment_reversed"));
}

export async function assessLateFeesAction(form: FormData) {
  const parsed = readLateFeeRunForm(form);
  if (!parsed.success) redirect(destination("controls", "error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("staff_assess_overdue_loan_fees", {
    p_as_of: input.as_of,
    p_reason: input.reason,
    p_request_id: crypto.randomUUID(),
  });
  if (error) redirect(failure(error, "controls"));
  refresh();
  redirect(destination("controls", "notice", "late_fees_assessed"));
}

export async function reconcileAccountAction(form: FormData) {
  const parsed = readReconciliationForm(form);
  if (!parsed.success) redirect(destination("controls", "error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("staff_record_financial_reconciliation", {
    p_account_id: input.account_id,
    p_note: input.note ?? "",
    p_reason: "Account statement reconciled through the Money controls.",
    p_request_id: crypto.randomUUID(),
    p_statement_balance_minor: input.statement_balance_minor,
    p_statement_through: input.statement_through,
  });
  if (error) redirect(failure(error, "controls"));
  refresh();
  redirect(destination("controls", "notice", "account_reconciled"));
}

export async function closeFinancialPeriodAction(form: FormData) {
  const parsed = readClosePeriodForm(form);
  if (!parsed.success) redirect(destination("controls", "error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("staff_close_financial_period", {
    p_ends_on: input.ends_on,
    p_note: input.note ?? "",
    p_reason: "Financial period closed through the Money controls.",
    p_request_id: crypto.randomUUID(),
    p_starts_on: input.starts_on,
  });
  if (error) redirect(failure(error, "controls"));
  refresh();
  redirect(destination("controls", "notice", "period_closed"));
}

export async function reopenFinancialPeriodAction(form: FormData) {
  const parsed = readReopenPeriodForm(form);
  if (!parsed.success) redirect(destination("controls", "error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("staff_reopen_financial_period", {
    p_expected_version: input.expected_version,
    p_period_id: input.period_id,
    p_reason: input.reason,
    p_request_id: crypto.randomUUID(),
  });
  if (error) redirect(failure(error, "controls"));
  refresh();
  redirect(destination("controls", "notice", "period_reopened"));
}
