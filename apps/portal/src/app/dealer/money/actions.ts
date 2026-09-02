"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createBusinessSupabaseClient } from "@/lib/supabase-server";

const transferSchema = z.object({
  amount_minor: z.coerce.number().int().positive(),
  from_account_id: z.guid(),
  memo: z.string().trim().min(1).max(500),
  occurred_on: z.iso.date(),
  to_account_reference: z.string().trim().min(1).max(80),
});

const paymentSchema = z.object({
  amount_minor: z.coerce.number().int().positive(),
  from_account_id: z.guid(),
  invoice_id: z.guid(),
  occurred_on: z.iso.date(),
  payment_reference: z.string().trim().min(1).max(200),
});

function destination(key: "error" | "notice", value: string) {
  return `/dealer/money?${new URLSearchParams({ [key]: value }).toString()}`;
}

async function client() {
  const supabase = await createBusinessSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") redirect("/dealer/login");
  return supabase;
}

function failure(error: { code?: string; message: string }) {
  console.error(`[dealer-bank:mutation] ${error.code ?? "unknown"}`);
  if (error.message.includes("insufficient_funds")) return destination("error", "insufficient_funds");
  if (error.code === "42501" || error.code === "28000" || error.message.includes("scope_denied")) return destination("error", "access_denied");
  if (error.message.includes("invoice_payment_amount")) return destination("error", "payment_invalid");
  return destination("error", "save_failed");
}

export async function dealerTransferAction(form: FormData) {
  const parsed = transferSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) redirect(destination("error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("dealer_transfer_funds", {
    p_amount_minor: input.amount_minor,
    p_from_account_id: input.from_account_id,
    p_memo: input.memo,
    p_occurred_on: input.occurred_on,
    p_request_id: crypto.randomUUID(),
    p_to_account_reference: input.to_account_reference,
  });
  if (error) redirect(failure(error));
  revalidatePath("/dealer/money");
  revalidatePath("/staff/money");
  redirect(destination("notice", "transfer_recorded"));
}

export async function dealerInvoicePaymentAction(form: FormData) {
  const parsed = paymentSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) redirect(destination("error", "invalid_input"));
  const input = parsed.data;
  const { error } = await (await client()).rpc("dealer_record_invoice_payment", {
    p_amount_minor: input.amount_minor,
    p_from_account_id: input.from_account_id,
    p_invoice_id: input.invoice_id,
    p_occurred_on: input.occurred_on,
    p_payment_reference: input.payment_reference,
    p_request_id: crypto.randomUUID(),
  });
  if (error) redirect(failure(error));
  revalidatePath("/dealer/money");
  revalidatePath("/dealer/orders");
  revalidatePath("/staff/money");
  redirect(destination("notice", "payment_recorded"));
}
