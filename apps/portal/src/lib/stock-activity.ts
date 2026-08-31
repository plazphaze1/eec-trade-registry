import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const nullableMoney = z.union([z.null(), z.coerce.number().int()]);

const activityItemSchema = z.object({
  buying_currency_code: z.string().nullable(),
  buying_price_minor: nullableMoney,
  can_purchase: z.boolean(),
  can_set_total: z.boolean(),
  current_quantity: z.coerce.number(),
  id: z.guid(),
  item_code: z.string(),
  item_name: z.string(),
  unit_code: z.string(),
});

const recentActivitySchema = z.object({
  activity_type: z.enum(["anonymous_purchase", "count_reconciliation"]),
  created_at: z.string(),
  currency_code: z.string().nullable(),
  financial_status: z.enum(["paid", "unpriced", "not_applicable"]),
  id: z.guid(),
  is_reversed: z.boolean(),
  item_name: z.string(),
  note: z.string(),
  occurred_on: z.string(),
  public_reference: z.string(),
  quantity_delta: z.coerce.number(),
  recorded_by: z.string(),
  recorded_quantity: z.coerce.number(),
  resulting_quantity: z.coerce.number(),
  total_amount_minor: nullableMoney,
  unit_code: z.string(),
});

const stockActivityWorkspaceSchema = z.object({
  capabilities: z.object({
    can_reconcile_count: z.boolean(),
    can_record_purchase: z.boolean(),
  }),
  generated_at: z.string(),
  items: z.array(activityItemSchema),
  recent_activity: z.array(recentActivitySchema),
});

const moneyWorkspaceSchema = z.object({
  generated_at: z.string(),
  recent_purchases: z.array(z.object({
    created_at: z.string(),
    currency_code: z.string().nullable(),
    id: z.guid(),
    item_name: z.string(),
    occurred_on: z.string(),
    public_reference: z.string(),
    quantity: z.coerce.number(),
    seller_label: z.string(),
    source_type: z.enum(["anonymous_purchase", "named_delivery"]),
    status: z.enum(["paid", "pending", "unpriced"]),
    total_amount_minor: nullableMoney,
    unit_code: z.string(),
    unit_price_minor: nullableMoney,
  })),
  summaries: z.array(z.object({
    currency_code: z.string(),
    outstanding_total_minor: z.coerce.number().int(),
    paid_30d_minor: z.coerce.number().int(),
    paid_total_minor: z.coerce.number().int(),
  })),
  unpriced_purchase_count: z.coerce.number().int().nonnegative(),
});

export type StockActivityWorkspace = z.infer<typeof stockActivityWorkspaceSchema>;
export type MoneyWorkspace = z.infer<typeof moneyWorkspaceSchema>;

type WorkspaceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: "access_denied" | "invalid_response" | "query_failed" };

function failure(error: { code?: string; message: string }) {
  return error.code === "42501" || error.message.includes("permission_denied")
    ? "access_denied" as const
    : "query_failed" as const;
}

export async function getStaffStockActivityWorkspace(client: SupabaseClient): Promise<WorkspaceResult<StockActivityWorkspace>> {
  const { data, error } = await client.rpc("get_staff_stock_activity_workspace");
  if (error) {
    console.error(`[staff-activity:workspace] ${error.message}`);
    return { ok: false, code: failure(error) };
  }
  const parsed = stockActivityWorkspaceSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[staff-activity:workspace] Supabase returned an unexpected response shape.");
    return { ok: false, code: "invalid_response" };
  }
  return { ok: true, data: parsed.data };
}

export async function getStaffMoneyWorkspace(client: SupabaseClient): Promise<WorkspaceResult<MoneyWorkspace>> {
  const { data, error } = await client.rpc("get_staff_money_workspace");
  if (error) {
    console.error(`[staff-money:workspace] ${error.message}`);
    return { ok: false, code: failure(error) };
  }
  const parsed = moneyWorkspaceSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[staff-money:workspace] Supabase returned an unexpected response shape.");
    return { ok: false, code: "invalid_response" };
  }
  return { ok: true, data: parsed.data };
}
