"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import {
  readConfigurationReferenceForm,
  readControlProfileForm,
  readPublicTermsForm,
  readQuickItemForm,
} from "@/lib/configuration-form";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const configurationPath = "/staff/configuration";
const productCreatePath = "/staff/items/new";

function destination(path: string, key: "error" | "notice", value: string) {
  const [pathname, query = ""] = path.split("?", 2);
  const parameters = new URLSearchParams(query);
  parameters.set(key, value);
  return `${pathname}?${parameters}`;
}

function mutationErrorPath(path: string, error: { code?: string; message: string }) {
  console.error(`[staff-configuration:mutation] ${error.code ?? "unknown"}`);
  if (error.code === "42501" || error.code === "28000") return destination(path, "error", "access_denied");
  if (error.code === "23505") return destination(path, "error", "duplicate");
  if (error.code === "P0002") return destination(path, "error", "not_found");
  if (error.code === "40001" || error.message.includes("version_conflict")) return destination(path, "error", "conflict");
  if (["22023", "23514", "23P01"].includes(error.code ?? "")) return destination(path, "error", "invalid_input");
  return destination(path, "error", "save_failed");
}

function generatedCode(displayName: string, suppliedCode: string) {
  if (suppliedCode) return suppliedCode;
  const readable = displayName
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return readable || `option-${crypto.randomUUID().slice(0, 8)}`;
}

function itemEditPath(formData: FormData) {
  const itemId = formData.get("item_id");
  return typeof itemId === "string" && /^[0-9a-f-]{36}$/i.test(itemId)
    ? `/staff/items/${itemId}/edit`
    : "/staff";
}

async function verifiedClient() {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getClaims();
  return !error && typeof data?.claims?.sub === "string" ? client : null;
}

function refreshConfiguration() {
  updateTag("public-catalogue");
  revalidatePath(configurationPath);
  revalidatePath("/staff");
  revalidatePath("/staff/economy");
  revalidatePath("/staff/inventory");
  revalidatePath("/catalogue");
  revalidatePath("/");
}

export async function quickCreateItemAction(formData: FormData) {
  const parsed = readQuickItemForm(formData);
  if (!parsed.success) redirect(destination(productCreatePath, "error", "invalid_input"));
  const client = await verifiedClient();
  if (!client) redirect("/staff/login");
  const input = parsed.data;
  const reason = input.reason || `Quick-create ${input.displayName} with configured trade terms.`;
  const { error } = await client.rpc("staff_quick_create_item", {
    p_availability_profile_code: input.availabilityProfileCode,
    p_business_bulk_review_threshold: input.businessBulkReviewThreshold,
    p_category_code: input.categoryCode,
    p_control_profile_code: input.controlProfileCode,
    p_critical_level: input.criticalLevel,
    p_description: input.description,
    p_direct_individual_allowed: input.directIndividualAllowed,
    p_direct_weekly_limit: input.directWeeklyLimit,
    p_display_name: input.displayName,
    p_item_code: input.itemCode,
    p_minimum_level: input.minimumLevel,
    p_opening_quantity: input.openingQuantity,
    p_opening_stock_location_id: input.openingStockLocationId,
    p_price_amount_minor: input.priceAmountMinor,
    p_price_schedule_id: input.priceScheduleId,
    p_publish: input.publish,
    p_reason: reason,
    p_request_id: crypto.randomUUID(),
    p_requirement_summary: input.requirementSummary,
    p_slug: input.slug,
    p_source_reference: input.sourceReference,
    p_supply_mode: input.supplyMode,
    p_surplus_level: input.surplusLevel,
    p_target_level: input.targetLevel,
    p_unit_code: input.unitCode,
  });
  if (error) redirect(mutationErrorPath(productCreatePath, error));
  refreshConfiguration();
  redirect(destination("/staff", "notice", "product_created"));
}

export async function createConfigurationReferenceAction(formData: FormData) {
  const kind = formData.get("kind");
  const viewByKind: Record<string, string> = {
    availability_profile: "advanced",
    endorsement: "endorsements",
    item_category: "categories",
    license_class: "licenses",
    unit: "units",
  };
  const returnPath = `${configurationPath}?view=${viewByKind[String(kind)] ?? "categories"}`;
  const parsed = readConfigurationReferenceForm(formData);
  if (!parsed.success) redirect(destination(returnPath, "error", "invalid_input"));
  const client = await verifiedClient();
  if (!client) redirect("/staff/login");
  const input = parsed.data;
  const reason = input.reason || `Create configured ${input.kind.replaceAll("_", " ")} ${input.displayName}.`;
  const { error } = await client.rpc("staff_create_configuration_reference", {
    p_code: generatedCode(input.displayName, input.code),
    p_description: input.description,
    p_display_name: input.displayName,
    p_kind: input.kind,
    p_public_display_name: input.publicDisplayName,
    p_quantity_scale: input.quantityScale,
    p_reason: reason,
    p_request_id: crypto.randomUUID(),
    p_sort_order: input.sortOrder,
    p_symbol: input.symbol,
  });
  if (error) redirect(mutationErrorPath(returnPath, error));
  refreshConfiguration();
  redirect(destination(returnPath, "notice", "reference_created"));
}

export async function createControlProfileAction(formData: FormData) {
  const returnPath = `${configurationPath}?view=advanced`;
  const parsed = readControlProfileForm(formData);
  if (!parsed.success) redirect(destination(returnPath, "error", "invalid_input"));
  const client = await verifiedClient();
  if (!client) redirect("/staff/login");
  const input = parsed.data;
  const reason = input.reason || `Create configured control profile ${input.displayName}.`;
  const { error } = await client.rpc("staff_create_control_profile", {
    p_code: generatedCode(input.displayName, input.code),
    p_display_name: input.displayName,
    p_public_description: input.publicDescription,
    p_reason: reason,
    p_request_id: crypto.randomUUID(),
    p_requires_serial_tracking: input.requiresSerialTracking,
    p_requires_staff_review: input.requiresStaffReview,
    p_requires_transaction_approval: input.requiresTransactionApproval,
  });
  if (error) redirect(mutationErrorPath(returnPath, error));
  refreshConfiguration();
  redirect(destination(returnPath, "notice", "control_created"));
}

export async function setItemPublicTermsAction(formData: FormData) {
  const returnPath = itemEditPath(formData);
  const parsed = readPublicTermsForm(formData);
  if (!parsed.success) redirect(destination(returnPath, "error", "invalid_input"));
  const client = await verifiedClient();
  if (!client) redirect("/staff/login");
  const input = parsed.data;
  const reason = input.reason || `Update public catalogue terms for ${input.publicName}.`;
  const { error } = await client.rpc("staff_set_item_public_terms", {
    p_availability_profile_code: input.availabilityProfileCode,
    p_bulk_minimum: input.bulkMinimum,
    p_control_profile_code: input.controlProfileCode,
    p_item_id: input.itemId,
    p_order_increment: input.orderIncrement,
    p_price_action: input.priceAction,
    p_price_amount_minor: input.priceAmountMinor,
    p_price_schedule_id: input.priceScheduleId,
    p_public_description: input.publicDescription,
    p_public_name: input.publicName,
    p_publish: input.publish,
    p_reason: reason,
    p_request_id: crypto.randomUUID(),
    p_requirement_summary: input.requirementSummary,
  });
  if (error) redirect(mutationErrorPath(returnPath, error));
  refreshConfiguration();
  redirect(destination(returnPath, "notice", "listing_saved"));
}
