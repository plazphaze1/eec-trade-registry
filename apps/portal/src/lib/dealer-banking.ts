import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const money = z.coerce.number().int();

const dealerBankingSchema = z.object({
  accounts: z.array(z.object({
    account_type: z.enum(["business", "personal", "escrow"]),
    active_hold_minor: money,
    available_balance_minor: money,
    balance_minor: money,
    currency_code: z.string(),
    display_name: z.string(),
    id: z.guid(),
    party_id: z.guid(),
    party_name: z.string(),
    public_reference: z.string(),
    status: z.enum(["active", "frozen", "closed"]),
    version: z.coerce.number().int().positive(),
  })),
  entries: z.array(z.object({
    account_id: z.guid(),
    account_name: z.string(),
    amount_minor: money,
    currency_code: z.string(),
    memo: z.string(),
    occurred_on: z.string(),
    posted_at: z.string(),
    public_reference: z.string(),
    source_reference: z.string().nullable(),
    transaction_id: z.guid(),
    transaction_type: z.string(),
  })),
  generated_at: z.string(),
  invoices: z.array(z.object({
    balance_due_minor: money,
    currency_code: z.string(),
    due_on: z.string().nullable(),
    id: z.guid(),
    issued_on: z.string(),
    order_id: z.guid(),
    order_reference: z.string(),
    paid_amount_minor: money,
    party_id: z.guid(),
    party_name: z.string(),
    public_reference: z.string(),
    status: z.enum(["open", "partially_paid", "paid", "void"]),
    total_amount_minor: money,
    version: z.coerce.number().int().positive(),
  })),
  loans: z.array(z.object({
    annual_rate_basis_points: z.coerce.number().int().nonnegative(),
    borrower_account_id: z.guid(),
    borrower_account_name: z.string(),
    borrower_name: z.string(),
    currency_code: z.string(),
    id: z.guid(),
    maturity_on: z.string(),
    next_due_on: z.string().nullable(),
    originated_on: z.string(),
    principal_minor: money,
    public_reference: z.string(),
    remaining_due_minor: money,
    repayment_frequency: z.enum(["weekly", "monthly"]),
    status: z.enum(["active", "paid", "defaulted", "written_off", "cancelled"]),
  })),
  parties: z.array(z.object({ id: z.guid(), name: z.string() })).min(1),
});

export type DealerBankingWorkspace = z.infer<typeof dealerBankingSchema>;

export async function getDealerBankingWorkspace(client: SupabaseClient) {
  const { data, error } = await client.rpc("get_dealer_banking_workspace");
  if (error) {
    const denied = error.code === "42501" || error.code === "28000" || error.message.includes("scope_denied");
    console.error(`[dealer-bank:workspace] ${error.code ?? "unknown"}`);
    return { ok: false as const, code: denied ? "access_denied" as const : "query_failed" as const };
  }
  const parsed = dealerBankingSchema.safeParse(data);
  return parsed.success
    ? { ok: true as const, data: parsed.data }
    : { ok: false as const, code: "invalid_response" as const };
}
