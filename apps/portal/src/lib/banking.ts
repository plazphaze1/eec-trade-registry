import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const money = z.coerce.number().int();
const nullableDate = z.string().nullable();

const capabilitySchema = z.object({
  can_invoice: z.boolean(),
  can_manage_accounts: z.boolean(),
  can_post: z.boolean(),
  can_reverse: z.boolean(),
});

const summarySchema = z.object({
  currency_code: z.string(),
  customer_deposits_minor: money,
  loan_overdue_minor: money,
  loan_principal_outstanding_minor: money,
  money_in_30d_minor: money,
  money_out_30d_minor: money,
  overdue_minor: money,
  outstanding_total_minor: money,
  paid_30d_minor: money,
  paid_total_minor: money,
  receivable_minor: money,
  treasury_balance_minor: money,
});

const accountSchema = z.object({
  active_hold_minor: money,
  available_balance_minor: money,
  balance_minor: money,
  currency_code: z.string(),
  display_name: z.string(),
  id: z.guid(),
  account_type: z.enum(["company_treasury", "business", "personal", "escrow"]),
  party_id: z.guid().nullable(),
  party_name: z.string().nullable(),
  public_reference: z.string(),
  status: z.enum(["active", "frozen", "closed"]),
  version: z.coerce.number().int().positive(),
});

const holdSchema = z.object({
  account_id: z.guid(),
  account_name: z.string(),
  amount_minor: money,
  currency_code: z.string(),
  expires_at: z.string().nullable(),
  id: z.guid(),
  public_reference: z.string(),
  reason: z.string(),
  status: z.enum(["active", "released", "captured", "expired"]),
  version: z.coerce.number().int().positive(),
});

const unbilledOrderSchema = z.object({
  currency_code: z.string(),
  id: z.guid(),
  party_name: z.string(),
  public_reference: z.string(),
  status: z.string(),
  submitted_at: z.string(),
  total_amount_minor: money,
});

const invoiceSchema = z.object({
  balance_due_minor: money,
  currency_code: z.string(),
  due_on: nullableDate,
  id: z.guid(),
  issued_on: z.string(),
  order_id: z.guid(),
  order_reference: z.string(),
  paid_amount_minor: money,
  party_name: z.string(),
  public_reference: z.string(),
  status: z.enum(["open", "partially_paid", "paid", "void"]),
  total_amount_minor: money,
  version: z.coerce.number().int().positive(),
});

const transactionSchema = z.object({
  amount_minor: money,
  currency_code: z.string(),
  external_reference: z.string().nullable(),
  from_account: z.string(),
  id: z.guid(),
  is_reversed: z.boolean(),
  memo: z.string(),
  occurred_on: z.string(),
  posted_at: z.string(),
  public_reference: z.string(),
  source_record_id: z.guid().nullable(),
  source_record_type: z.string().nullable(),
  source_reference: z.string().nullable(),
  to_account: z.string(),
  transaction_type: z.string(),
});

const loanProductSchema = z.object({
  active: z.boolean(),
  annual_rate_basis_points: z.coerce.number().int().nonnegative(),
  code: z.string(),
  display_name: z.string(),
  grace_days: z.coerce.number().int().nonnegative(),
  id: z.guid(),
  late_fee_minor: money,
  maximum_principal_minor: money.nullable(),
  maximum_term_count: z.coerce.number().int().positive(),
  minimum_principal_minor: money,
  minimum_term_count: z.coerce.number().int().positive(),
  repayment_frequency: z.enum(["weekly", "monthly"]),
  version: z.coerce.number().int().positive(),
});

const loanSchema = z.object({
  annual_rate_basis_points: z.coerce.number().int().nonnegative(),
  borrower_account_id: z.guid(),
  borrower_account_name: z.string(),
  borrower_name: z.string().nullable(),
  currency_code: z.string(),
  id: z.guid(),
  interest_paid_minor: money,
  maturity_on: z.string(),
  next_due_on: nullableDate,
  originated_on: z.string(),
  overdue_minor: money,
  principal_minor: money,
  principal_paid_minor: money,
  product_name: z.string(),
  public_reference: z.string(),
  remaining_due_minor: money,
  repayment_frequency: z.enum(["weekly", "monthly"]),
  status: z.enum(["active", "paid", "defaulted", "written_off", "cancelled"]),
  term_count: z.coerce.number().int().positive(),
  version: z.coerce.number().int().positive(),
});

const partySchema = z.object({ id: z.guid(), name: z.string() });

const bankingWorkspaceSchema = z.object({
  accounts: z.array(accountSchema),
  capabilities: capabilitySchema,
  generated_at: z.string(),
  holds: z.array(holdSchema),
  invoices: z.array(invoiceSchema),
  loan_products: z.array(loanProductSchema),
  loans: z.array(loanSchema),
  parties: z.array(partySchema),
  pending_supplier_total_minor: money,
  summaries: z.array(summarySchema),
  transactions: z.array(transactionSchema),
  unbilled_orders: z.array(unbilledOrderSchema),
  unpriced_purchase_count: z.coerce.number().int().nonnegative(),
});

const orderFinanceSchema = z.object({
  balance_due_minor: money,
  currency_code: z.string(),
  due_on: nullableDate,
  id: z.guid(),
  issued_on: z.string(),
  paid_amount_minor: money,
  public_reference: z.string(),
  status: z.enum(["open", "partially_paid", "paid", "void"]),
  total_amount_minor: money,
  version: z.coerce.number().int().positive(),
}).nullable();

const bankAccountRegisterSchema = z.object({
  limit: z.coerce.number().int().positive(),
  offset: z.coerce.number().int().nonnegative(),
  rows: z.array(accountSchema),
  total: z.coerce.number().int().nonnegative(),
});

const accountStatementSchema = z.object({
  capabilities: z.object({ can_manage_accounts: z.boolean(), can_post: z.boolean() }),
  account: z.object({
    account_type: z.enum(["company_treasury", "business", "personal", "escrow"]),
    available_balance_minor: money,
    balance_minor: money,
    currency_code: z.string(),
    display_name: z.string(),
    id: z.guid(),
    party_id: z.guid().nullable(),
    party_name: z.string().nullable(),
    public_reference: z.string(),
    status: z.enum(["active", "frozen", "closed"]),
    version: z.coerce.number().int().positive(),
  }),
  entries: z.array(z.object({
    amount_minor: money,
    external_reference: z.string().nullable(),
    is_reversed: z.boolean(),
    memo: z.string(),
    occurred_on: z.string(),
    posted_at: z.string(),
    public_reference: z.string(),
    running_balance_minor: money,
    source_record_id: z.guid().nullable(),
    source_record_type: z.string().nullable(),
    source_reference: z.string().nullable(),
    transaction_id: z.guid(),
    transaction_type: z.string(),
  })),
  holds: z.array(z.object({
    amount_minor: money,
    expires_at: z.string().nullable(),
    id: z.guid(),
    public_reference: z.string(),
    reason: z.string(),
    status: z.enum(["active", "released", "captured", "expired"]),
    version: z.coerce.number().int().positive(),
  })),
  loans: z.array(z.object({
    id: z.guid(),
    maturity_on: z.string(),
    principal_minor: money,
    public_reference: z.string(),
    status: z.enum(["active", "paid", "defaulted", "written_off", "cancelled"]),
    version: z.coerce.number().int().positive(),
  })),
});

const loanDetailSchema = z.object({
  capabilities: z.object({ can_manage: z.boolean(), can_post: z.boolean() }),
  installments: z.array(z.object({
    balance_due_minor: money,
    due_on: z.string(),
    fee_due_minor: money,
    fee_paid_minor: money,
    id: z.guid(),
    installment_number: z.coerce.number().int().positive(),
    interest_due_minor: money,
    interest_paid_minor: money,
    principal_due_minor: money,
    principal_paid_minor: money,
    status: z.enum(["scheduled", "partially_paid", "paid", "overdue", "waived"]),
    version: z.coerce.number().int().positive(),
  })),
  loan: z.object({
    annual_rate_basis_points: z.coerce.number().int().nonnegative(),
    borrower_account_id: z.guid(),
    borrower_account_name: z.string(),
    borrower_account_reference: z.string(),
    borrower_name: z.string().nullable(),
    currency_code: z.string(),
    first_due_on: z.string(),
    grace_days: z.coerce.number().int().nonnegative(),
    id: z.guid(),
    late_fee_minor: money,
    maturity_on: z.string(),
    originated_on: z.string(),
    principal_minor: money,
    product_name: z.string(),
    public_reference: z.string(),
    purpose: z.string(),
    repayment_frequency: z.enum(["weekly", "monthly"]),
    status: z.enum(["active", "paid", "defaulted", "written_off", "cancelled"]),
    term_count: z.coerce.number().int().positive(),
    version: z.coerce.number().int().positive(),
  }),
  payments: z.array(z.object({
    amount_minor: money,
    id: z.guid(),
    is_reversed: z.boolean(),
    occurred_on: z.string(),
    payment_reference: z.string().nullable(),
    transaction_id: z.guid(),
    transaction_reference: z.string(),
  })),
});

export type BankingWorkspace = z.infer<typeof bankingWorkspaceSchema>;
export type BankAccount = z.infer<typeof accountSchema>;
export type BankAccountRegister = z.infer<typeof bankAccountRegisterSchema>;
export type BankAccountStatement = z.infer<typeof accountStatementSchema>;
export type BankLoanDetail = z.infer<typeof loanDetailSchema>;
export type BankInvoice = z.infer<typeof invoiceSchema>;
export type BankLoan = z.infer<typeof loanSchema>;
export type OrderFinance = z.infer<typeof orderFinanceSchema>;

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; code: "access_denied" | "invalid_response" | "query_failed" };

function failure(error: { code?: string; message: string }) {
  return error.code === "42501" || error.message.includes("permission_denied")
    ? "access_denied" as const
    : "query_failed" as const;
}

export async function getStaffBankingWorkspace(client: SupabaseClient): Promise<Result<BankingWorkspace>> {
  const { data, error } = await client.rpc("get_staff_money_workspace");
  if (error) {
    console.error(`[staff-bank:workspace] ${error.message}`);
    return { ok: false, code: failure(error) };
  }
  const parsed = bankingWorkspaceSchema.safeParse(data);
  if (!parsed.success) {
    console.error(`[staff-bank:workspace] Invalid response: ${parsed.error.message}`);
    return { ok: false, code: "invalid_response" };
  }
  return { ok: true, data: parsed.data };
}

export async function getStaffOrderFinance(client: SupabaseClient, orderId: string): Promise<Result<OrderFinance>> {
  const { data, error } = await client.rpc("get_staff_order_finance", { p_order_id: orderId });
  if (error) {
    console.error(`[staff-bank:order] ${error.message}`);
    return { ok: false, code: failure(error) };
  }
  const parsed = orderFinanceSchema.safeParse(data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, code: "invalid_response" };
}

export async function getStaffBankAccountRegister(
  client: SupabaseClient,
  options: { search?: string; status?: "active" | "frozen" | "closed"; limit?: number; offset?: number } = {},
): Promise<Result<BankAccountRegister>> {
  const { data, error } = await client.rpc("get_staff_bank_account_register", {
    p_limit: options.limit ?? 50,
    p_offset: options.offset ?? 0,
    p_search: options.search?.trim() || null,
    p_status: options.status ?? null,
  });
  if (error) {
    console.error(`[staff-bank:accounts] ${error.message}`);
    return { ok: false, code: failure(error) };
  }
  const parsed = bankAccountRegisterSchema.safeParse(data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, code: "invalid_response" };
}

export async function getStaffFinancialAccountStatement(
  client: SupabaseClient,
  accountId: string,
): Promise<Result<BankAccountStatement>> {
  const { data, error } = await client.rpc("get_staff_financial_account_statement", {
    p_account_id: accountId,
    p_before: null,
    p_limit: 100,
  });
  if (error) {
    console.error(`[staff-bank:statement] ${error.message}`);
    return { ok: false, code: failure(error) };
  }
  const parsed = accountStatementSchema.safeParse(data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, code: "invalid_response" };
}

export async function getStaffLoan(client: SupabaseClient, loanId: string): Promise<Result<BankLoanDetail>> {
  const { data, error } = await client.rpc("get_staff_loan", { p_loan_id: loanId });
  if (error) {
    console.error(`[staff-bank:loan] ${error.message}`);
    return { ok: false, code: failure(error) };
  }
  const parsed = loanDetailSchema.safeParse(data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, code: "invalid_response" };
}
