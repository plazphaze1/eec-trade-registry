import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(max).nullable(),
);
const optionalUuid = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.guid().nullable(),
);
const optionalDate = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.iso.date().nullable(),
);
const money = z.coerce.number().int().positive();

function object(form: FormData) {
  return Object.fromEntries(form.entries());
}

const accountSchema = z.object({
  account_type: z.enum(["business", "personal", "escrow"]),
  currency_code: text(12),
  display_name: text(160),
  note: optionalText(1000),
  opening_balance_minor: z.coerce.number().int().nonnegative(),
  party_id: optionalUuid,
});

const cashSchema = z.object({
  account_id: z.guid(),
  amount_minor: money,
  direction: z.enum(["deposit", "withdrawal"]),
  memo: text(500),
  occurred_on: z.iso.date(),
  reference: optionalText(200),
});

const transferSchema = z.object({
  amount_minor: money,
  from_account_id: z.guid(),
  memo: text(500),
  occurred_on: z.iso.date(),
  reference: optionalText(200),
  to_account_id: z.guid(),
}).refine((value) => value.from_account_id !== value.to_account_id, { path: ["to_account_id"] });

const invoiceSchema = z.object({
  due_on: optionalDate,
  issued_on: z.iso.date(),
  note: optionalText(1000),
  order_id: z.guid(),
});

const invoicePaymentSchema = z.object({
  amount_minor: money,
  from_account_id: optionalUuid,
  invoice_id: z.guid(),
  note: optionalText(500),
  occurred_on: z.iso.date(),
  payment_reference: text(200),
});

const loanProductSchema = z.object({
  annual_rate_basis_points: z.coerce.number().int().min(0).max(100000),
  code: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9-]{2,49}$/),
  description: optionalText(1000),
  display_name: text(120),
  grace_days: z.coerce.number().int().min(0).max(365),
  late_fee_minor: z.coerce.number().int().nonnegative(),
  maximum_principal_minor: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.coerce.number().int().positive().nullable(),
  ),
  maximum_term_count: z.coerce.number().int().positive().max(520),
  minimum_principal_minor: money,
  minimum_term_count: z.coerce.number().int().positive().max(520),
  repayment_frequency: z.enum(["weekly", "monthly"]),
}).refine((value) => value.maximum_term_count >= value.minimum_term_count, { path: ["maximum_term_count"] })
  .refine((value) => value.maximum_principal_minor === null || value.maximum_principal_minor >= value.minimum_principal_minor, { path: ["maximum_principal_minor"] });

const originateLoanSchema = z.object({
  borrower_account_id: z.guid(),
  first_due_on: z.iso.date(),
  loan_product_id: z.guid(),
  originated_on: z.iso.date(),
  principal_minor: money,
  purpose: optionalText(1000),
  term_count: z.coerce.number().int().positive().max(520),
});

const loanPaymentSchema = z.object({
  amount_minor: money,
  loan_id: z.guid(),
  note: optionalText(500),
  occurred_on: z.iso.date(),
  payment_reference: optionalText(200),
});

const accountStatusSchema = z.object({
  account_id: z.guid(),
  expected_version: z.coerce.number().int().positive(),
  reason: text(500),
  status: z.enum(["active", "frozen", "closed"]),
});

const accountHoldSchema = z.object({
  account_id: z.guid(),
  amount_minor: money,
  expires_at: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.iso.datetime({ local: true }).nullable(),
  ),
  reason: text(500),
});

const releaseHoldSchema = z.object({
  account_id: z.guid(),
  expected_version: z.coerce.number().int().positive(),
  hold_id: z.guid(),
  reason: text(500),
});

const loanStatusSchema = z.object({
  expected_version: z.coerce.number().int().positive(),
  loan_id: z.guid(),
  reason: text(500),
  status: z.enum(["active", "defaulted", "written_off"]),
});

const paymentCorrectionSchema = z.object({
  expected_version: z.coerce.number().int().positive(),
  record_id: z.guid(),
  reason: text(500),
});

const lateFeeRunSchema = z.object({
  as_of: z.iso.date(),
  reason: text(500),
});

const reconciliationSchema = z.object({
  account_id: z.guid(),
  note: optionalText(1000),
  statement_balance_minor: z.coerce.number().int(),
  statement_through: z.iso.date(),
});

const closePeriodSchema = z.object({
  ends_on: z.iso.date(),
  note: optionalText(1000),
  starts_on: z.iso.date(),
}).refine((value) => value.ends_on >= value.starts_on, { path: ["ends_on"] });

const reopenPeriodSchema = z.object({
  expected_version: z.coerce.number().int().positive(),
  period_id: z.guid(),
  reason: text(500),
});

export const readAccountForm = (form: FormData) => accountSchema.safeParse(object(form));
export const readCashForm = (form: FormData) => cashSchema.safeParse(object(form));
export const readTransferForm = (form: FormData) => transferSchema.safeParse(object(form));
export const readInvoiceForm = (form: FormData) => invoiceSchema.safeParse(object(form));
export const readInvoicePaymentForm = (form: FormData) => invoicePaymentSchema.safeParse(object(form));
export const readLoanProductForm = (form: FormData) => loanProductSchema.safeParse(object(form));
export const readOriginateLoanForm = (form: FormData) => originateLoanSchema.safeParse(object(form));
export const readLoanPaymentForm = (form: FormData) => loanPaymentSchema.safeParse(object(form));
export const readAccountStatusForm = (form: FormData) => accountStatusSchema.safeParse(object(form));
export const readAccountHoldForm = (form: FormData) => accountHoldSchema.safeParse(object(form));
export const readReleaseHoldForm = (form: FormData) => releaseHoldSchema.safeParse(object(form));
export const readLoanStatusForm = (form: FormData) => loanStatusSchema.safeParse(object(form));
export const readPaymentCorrectionForm = (form: FormData) => paymentCorrectionSchema.safeParse(object(form));
export const readLateFeeRunForm = (form: FormData) => lateFeeRunSchema.safeParse(object(form));
export const readReconciliationForm = (form: FormData) => reconciliationSchema.safeParse(object(form));
export const readClosePeriodForm = (form: FormData) => closePeriodSchema.safeParse(object(form));
export const readReopenPeriodForm = (form: FormData) => reopenPeriodSchema.safeParse(object(form));
