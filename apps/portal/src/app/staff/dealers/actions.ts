"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  readChangeDealerStatusForm,
  readCreateDealerForm,
  readUpdateDealerForm,
} from "@/lib/staff-dealer-form";
import {
  businessAccountEmail,
  getStaffBusinessAccess,
  readDisableBusinessAccessForm,
  readSetBusinessAccessForm,
} from "@/lib/business-access";
import { createIntegrationSupabaseClient } from "@/lib/integration-supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function destination(path: string, key: "error" | "notice", value: string) {
  return `${path}?${new URLSearchParams({ [key]: value }).toString()}`;
}

function dealerPath(candidate: FormDataEntryValue | null) {
  return typeof candidate === "string" && z.guid().safeParse(candidate).success
    ? `/staff/dealers/${candidate}`
    : "/staff/dealers";
}

function mutationErrorPath(path: string, error: { code?: string; message: string }) {
  console.error(`[staff-dealers:mutation] ${error.code ?? "unknown"}`);
  if (error.code === "40001" || error.message.includes("version_conflict")) return destination(path, "error", "conflict");
  if (error.code === "42501" || error.code === "28000" || error.message.includes("staff_permission_denied")) return destination(path, "error", "access_denied");
  if (error.code === "P0002") return destination(path, "error", "not_found");
  if (error.code === "22023" || error.code === "23P01") return destination(path, "error", "invalid_input");
  return destination(path, "error", "save_failed");
}

async function verifiedClient() {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getClaims();
  return error || typeof data?.claims?.sub !== "string" ? null : client;
}

export async function createDealerAction(formData: FormData) {
  const parsed = readCreateDealerForm(formData);
  if (!parsed.success) redirect(destination("/staff/dealers/new", "error", "invalid_input"));
  const client = await verifiedClient();
  if (!client) redirect("/staff/login");
  const input = parsed.data;
  const { data, error } = await client.rpc("staff_create_dealer_authorization", {
    p_approved_premises_public: input.approvedPremisesPublic,
    p_dealer_type_code: input.dealerTypeCode,
    p_display_name: input.displayName,
    p_initial_status_code: input.initialStatusCode,
    p_jurisdiction_code: input.jurisdictionCode,
    p_legal_name: input.legalName,
    p_party_type_code: input.partyTypeCode,
    p_private_notes: input.privateNotes,
    p_public_disclosure_enabled: input.publicDisclosureEnabled,
    p_public_display_name: input.publicDisplayName,
    p_public_notes: input.publicNotes,
    p_reason: input.reason,
    p_request_id: crypto.randomUUID(),
  });
  if (error) redirect(mutationErrorPath("/staff/dealers/new", error));
  const dealerId = Array.isArray(data) ? data[0]?.id : null;
  revalidatePath("/staff/dealers");
  revalidatePath("/staff/licensing/new");
  revalidatePath("/verify/dealer");
  if (typeof dealerId === "string") redirect(destination(`/staff/dealers/${dealerId}`, "notice", "dealer_created"));
  redirect(destination("/staff/dealers", "notice", "dealer_created"));
}

export async function updateDealerAction(formData: FormData) {
  const path = dealerPath(formData.get("dealer_authorization_id"));
  const parsed = readUpdateDealerForm(formData);
  if (!parsed.success) redirect(destination(path, "error", "invalid_input"));
  const client = await verifiedClient();
  if (!client) redirect("/staff/login");
  const input = parsed.data;
  const { error } = await client.rpc("staff_update_dealer_authorization", {
    p_approved_premises_public: input.approvedPremisesPublic,
    p_dealer_authorization_id: input.dealerAuthorizationId,
    p_display_name: input.displayName,
    p_expected_version: input.expectedVersion,
    p_legal_name: input.legalName,
    p_private_notes: input.privateNotes,
    p_public_disclosure_enabled: input.publicDisclosureEnabled,
    p_public_display_name: input.publicDisplayName,
    p_public_notes: input.publicNotes,
    p_reason: input.reason,
    p_request_id: crypto.randomUUID(),
  });
  if (error) redirect(mutationErrorPath(path, error));
  revalidatePath("/staff/dealers");
  revalidatePath(path);
  revalidatePath("/verify/dealer");
  redirect(destination(path, "notice", "dealer_updated"));
}

export async function changeDealerStatusAction(formData: FormData) {
  const path = dealerPath(formData.get("dealer_authorization_id"));
  const parsed = readChangeDealerStatusForm(formData);
  if (!parsed.success) redirect(destination(path, "error", "invalid_input"));
  const client = await verifiedClient();
  if (!client) redirect("/staff/login");
  const input = parsed.data;
  const { error } = await client.rpc("staff_change_dealer_authorization_status", {
    p_dealer_authorization_id: input.dealerAuthorizationId,
    p_expected_version: input.expectedVersion,
    p_reason: input.reason,
    p_request_id: crypto.randomUUID(),
    p_target_status_code: input.targetStatusCode,
  });
  if (error) redirect(mutationErrorPath(path, error));
  revalidatePath("/staff/dealers");
  revalidatePath(path);
  revalidatePath("/staff/licensing/new");
  revalidatePath("/verify/dealer");
  redirect(destination(path, "notice", "dealer_status_changed"));
}

export async function setBusinessPortalAccessAction(formData: FormData) {
  const path = dealerPath(formData.get("dealer_authorization_id"));
  const parsed = readSetBusinessAccessForm(formData);
  if (!parsed.success) redirect(destination(path, "error", "invalid_access_code"));
  const client = await verifiedClient();
  if (!client) redirect("/staff/login");

  const current = await getStaffBusinessAccess(
    client,
    parsed.data.dealerAuthorizationId,
  );
  if (!current.ok) {
    redirect(
      destination(
        path,
        "error",
        current.code === "access_denied" ? "access_denied" : "save_failed",
      ),
    );
  }
  if (current.data.eligible_license_references.length === 0) {
    redirect(destination(path, "error", "business_license_required"));
  }

  let adminClient;
  try {
    adminClient = createIntegrationSupabaseClient();
  } catch {
    console.error("[staff-business-access] Service authentication is unavailable.");
    redirect(destination(path, "error", "save_failed"));
  }

  let authUserId = current.data.auth_user_id;
  let createdAuthUser = false;
  if (current.data.configured && authUserId) {
    const updated = await adminClient.auth.admin.updateUserById(authUserId, {
      password: parsed.data.accessCode,
    });
    if (updated.error) {
      console.error(`[staff-business-access:update-auth] ${updated.error.code ?? "unknown"}`);
      redirect(destination(path, "error", "save_failed"));
    }
  } else {
    const created = await adminClient.auth.admin.createUser({
      email: businessAccountEmail(current.data.party_id),
      email_confirm: true,
      password: parsed.data.accessCode,
      user_metadata: {
        account_purpose: "business_portal",
        party_id: current.data.party_id,
      },
    });
    if (created.error || !created.data.user) {
      console.error(`[staff-business-access:create-auth] ${created.error?.code ?? "unknown"}`);
      redirect(destination(path, "error", "save_failed"));
    }
    authUserId = created.data.user.id;
    createdAuthUser = true;
  }

  const requestId = crypto.randomUUID();
  const { error } = await client.rpc("staff_activate_business_portal_account", {
    p_auth_user_id: authUserId,
    p_dealer_authorization_id: parsed.data.dealerAuthorizationId,
    p_reason: current.data.configured
      ? "Owner reset the business portal access code."
      : "Owner enabled business portal access.",
    p_request_id: requestId,
  });
  if (error) {
    console.error(`[staff-business-access:activate] ${error.code ?? "unknown"}`);
    if (createdAuthUser && authUserId) {
      await adminClient.auth.admin.deleteUser(authUserId);
    }
    if (error.code === "42501") redirect(destination(path, "error", "access_denied"));
    if (error.code === "22023") redirect(destination(path, "error", "business_license_required"));
    redirect(destination(path, "error", "save_failed"));
  }

  revalidatePath(path);
  revalidatePath("/dealer");
  redirect(destination(path, "notice", "business_access_ready"));
}

export async function disableBusinessPortalAccessAction(formData: FormData) {
  const path = dealerPath(formData.get("dealer_authorization_id"));
  const parsed = readDisableBusinessAccessForm(formData);
  if (!parsed.success) redirect(destination(path, "error", "invalid_input"));
  const client = await verifiedClient();
  if (!client) redirect("/staff/login");
  const { error } = await client.rpc("staff_disable_business_portal_account", {
    p_dealer_authorization_id: parsed.data.dealerAuthorizationId,
    p_reason: "Owner disabled business portal access.",
    p_request_id: crypto.randomUUID(),
  });
  if (error) {
    console.error(`[staff-business-access:disable] ${error.code ?? "unknown"}`);
    if (error.code === "42501") redirect(destination(path, "error", "access_denied"));
    if (error.code === "P0002") redirect(destination(path, "error", "not_found"));
    redirect(destination(path, "error", "save_failed"));
  }
  revalidatePath(path);
  revalidatePath("/dealer");
  redirect(destination(path, "notice", "business_access_disabled"));
}
