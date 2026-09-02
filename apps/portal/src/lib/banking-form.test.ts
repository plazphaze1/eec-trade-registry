import { describe, expect, it } from "vitest";

import {
  readAccountForm,
  readAccountHoldForm,
  readClosePeriodForm,
  readCashInfusionForm,
  readInvoicePaymentForm,
  readLateFeeRunForm,
  readLoanProductForm,
  readOriginateLoanForm,
  readPaymentCorrectionForm,
  readReconciliationForm,
  readReopenPeriodForm,
  readTransferForm,
} from "@/lib/banking-form";

const id = (suffix: number) => `10000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
function form(entries: Record<string, string>) {
  const result = new FormData();
  Object.entries(entries).forEach(([key, value]) => result.set(key, value));
  return result;
}

describe("banking forms", () => {
  it("accepts a simple Company cash infusion", () => {
    const result = readCashInfusionForm(form({
      amount_minor: "2500", currency_code: "SEP", note: "Owner capital",
      occurred_on: "2026-09-02", source_reference: "Opening purse",
    }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount_minor).toBe(2500);
  });

  it("rejects a zero Company cash infusion", () => {
    expect(readCashInfusionForm(form({
      amount_minor: "0", currency_code: "SEP", note: "", occurred_on: "2026-09-02", source_reference: "",
    })).success).toBe(false);
  });

  it("accepts a party-linked business account without an opening balance", () => {
    const result = readAccountForm(form({
      account_type: "business", currency_code: "SEP", display_name: "Solitude Tailor",
      note: "", opening_balance_minor: "0", party_id: id(1),
    }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.opening_balance_minor).toBe(0);
  });

  it("rejects a negative opening balance", () => {
    expect(readAccountForm(form({
      account_type: "personal", currency_code: "SEP", display_name: "Aurelion",
      note: "", opening_balance_minor: "-1", party_id: "",
    })).success).toBe(false);
  });

  it("rejects a transfer to the same account", () => {
    expect(readTransferForm(form({
      amount_minor: "50", from_account_id: id(2), memo: "Test", occurred_on: "2026-09-02",
      reference: "", to_account_id: id(2),
    })).success).toBe(false);
  });

  it("requires positive invoice payment money", () => {
    expect(readInvoicePaymentForm(form({
      amount_minor: "0", from_account_id: id(2), invoice_id: id(3), note: "",
      occurred_on: "2026-09-02", payment_reference: "Receipt 1",
    })).success).toBe(false);
  });

  it("parses an optional hold expiry without inventing one", () => {
    const result = readAccountHoldForm(form({ account_id: id(4), amount_minor: "25", expires_at: "", reason: "Pending order" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.expires_at).toBeNull();
  });

  it("validates coherent loan product limits", () => {
    expect(readLoanProductForm(form({
      annual_rate_basis_points: "1000", code: "standard-loan", description: "",
      display_name: "Standard Loan", grace_days: "3", late_fee_minor: "0",
      maximum_principal_minor: "10000", maximum_term_count: "24", minimum_principal_minor: "100",
      minimum_term_count: "1", repayment_frequency: "monthly",
    })).success).toBe(true);
  });

  it("rejects inverted loan term limits", () => {
    expect(readLoanProductForm(form({
      annual_rate_basis_points: "1000", code: "standard-loan", description: "",
      display_name: "Standard Loan", grace_days: "3", late_fee_minor: "0",
      maximum_principal_minor: "10000", maximum_term_count: "2", minimum_principal_minor: "100",
      minimum_term_count: "12", repayment_frequency: "monthly",
    })).success).toBe(false);
  });

  it("accepts a dated loan origination", () => {
    expect(readOriginateLoanForm(form({
      borrower_account_id: id(5), first_due_on: "2026-10-02", loan_product_id: id(6),
      originated_on: "2026-09-02", principal_minor: "5000", purpose: "Working capital", term_count: "12",
    })).success).toBe(true);
  });

  it("requires a reason and record version for payment corrections", () => {
    expect(readPaymentCorrectionForm(form({
      expected_version: "2", reason: "Entered twice", record_id: id(7),
    })).success).toBe(true);
    expect(readPaymentCorrectionForm(form({
      expected_version: "2", reason: "", record_id: id(7),
    })).success).toBe(false);
  });

  it("accepts a negative counted balance during reconciliation", () => {
    expect(readReconciliationForm(form({
      account_id: id(8), note: "Counted from the treasury book",
      statement_balance_minor: "-25", statement_through: "2026-09-01",
    })).success).toBe(true);
  });

  it("rejects an inverted financial period", () => {
    expect(readClosePeriodForm(form({
      ends_on: "2026-08-01", note: "", starts_on: "2026-08-31",
    })).success).toBe(false);
  });

  it("validates fee runs and period reopening", () => {
    expect(readLateFeeRunForm(form({ as_of: "2026-09-02", reason: "Routine review" })).success).toBe(true);
    expect(readReopenPeriodForm(form({
      expected_version: "1", period_id: id(9), reason: "Post an authorized correction",
    })).success).toBe(true);
  });
});
