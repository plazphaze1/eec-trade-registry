"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { readAnonymousPurchaseForm, readCountedTotalForm } from "@/lib/stock-activity-form";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const activityPath = "/staff/activity";

function destination(key: "error" | "notice", value: string, mode?: "purchase" | "count") {
  const query = new URLSearchParams({ [key]: value });
  if (mode) query.set("mode", mode);
  return `${activityPath}?${query.toString()}`;
}

function errorPath(error: { code?: string; message: string }, mode: "purchase" | "count") {
  console.error(`[staff-activity:mutation] ${error.code ?? "unknown"}`);
  if (error.code === "42501" || error.message.includes("permission_denied")) {
    return destination("error", "access_denied", mode);
  }
  if (error.message.includes("below_reserved")) {
    return destination("error", "below_reserved", mode);
  }
  if (error.message.includes("unchanged")) {
    return destination("error", "unchanged", mode);
  }
  if (error.code === "P0002") return destination("error", "not_found", mode);
  if (error.code === "22023" || error.code === "23514") {
    return destination("error", "invalid_input", mode);
  }
  return destination("error", "save_failed", mode);
}

async function verifiedClient() {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getClaims();
  return !error && typeof data?.claims?.sub === "string" ? client : null;
}

function refresh() {
  updateTag("public-catalogue");
  for (const path of [activityPath, "/staff/money", "/staff/inventory", "/staff/buy", "/staff/dashboard", "/catalogue", "/"]) {
    revalidatePath(path);
  }
}

export async function recordAnonymousPurchaseAction(formData: FormData) {
  const parsed = readAnonymousPurchaseForm(formData);
  if (!parsed.success) redirect(destination("error", "invalid_input", "purchase"));
  const client = await verifiedClient();
  if (!client) redirect("/staff/login");
  const input = parsed.data;
  const { error } = await client.rpc("staff_record_anonymous_purchase", {
    p_item_id: input.itemId,
    p_note: input.note,
    p_occurred_on: input.occurredOn,
    p_quantity: input.quantity,
    p_request_id: crypto.randomUUID(),
  });
  if (error) redirect(errorPath(error, "purchase"));
  refresh();
  redirect(destination("notice", "purchase_recorded", "purchase"));
}

export async function setCountedTotalAction(formData: FormData) {
  const parsed = readCountedTotalForm(formData);
  if (!parsed.success) redirect(destination("error", "invalid_input", "count"));
  const client = await verifiedClient();
  if (!client) redirect("/staff/login");
  const input = parsed.data;
  const { error } = await client.rpc("staff_set_counted_stock_total", {
    p_item_id: input.itemId,
    p_occurred_on: input.occurredOn,
    p_reason: input.note || "Counted stock total recorded from the activity journal.",
    p_request_id: crypto.randomUUID(),
    p_target_quantity: input.targetQuantity,
  });
  if (error) redirect(errorPath(error, "count"));
  refresh();
  redirect(destination("notice", "count_recorded", "count"));
}
