import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const licenseReferenceSchema = z.string().trim().min(6).max(128);
const accessCodeSchema = z.string().min(8).max(128);

const businessLoginSchema = z.object({
  accessCode: accessCodeSchema,
  licenseReference: licenseReferenceSchema,
});

const setBusinessAccessSchema = z.object({
  accessCode: accessCodeSchema,
  dealerAuthorizationId: z.guid(),
});

const disableBusinessAccessSchema = z.object({
  dealerAuthorizationId: z.guid(),
});

const staffBusinessAccessSchema = z.object({
  actor_id: z.guid().nullable(),
  auth_user_id: z.guid().nullable(),
  configured: z.boolean(),
  credential_rotated_at: z.string().nullable(),
  credential_version: z.number().int().positive().safe().nullable(),
  disabled_at: z.string().nullable(),
  eligible_license_references: z.array(z.string()),
  party_id: z.guid(),
  party_name: z.string(),
  status: z.enum(["active", "disabled"]).nullable(),
});

export type StaffBusinessAccess = z.infer<typeof staffBusinessAccessSchema>;

export function readBusinessLoginForm(formData: FormData) {
  return businessLoginSchema.safeParse({
    accessCode: formData.get("access_code"),
    licenseReference: formData.get("license_reference"),
  });
}

export function readSetBusinessAccessForm(formData: FormData) {
  return setBusinessAccessSchema.safeParse({
    accessCode: formData.get("access_code"),
    dealerAuthorizationId: formData.get("dealer_authorization_id"),
  });
}

export function readDisableBusinessAccessForm(formData: FormData) {
  return disableBusinessAccessSchema.safeParse({
    dealerAuthorizationId: formData.get("dealer_authorization_id"),
  });
}

export function businessAccountEmail(partyId: string): string {
  const parsed = z.guid().parse(partyId);
  return `business-${parsed.replaceAll("-", "")}@accounts.eec.invalid`;
}

export async function getStaffBusinessAccess(
  client: SupabaseClient,
  dealerAuthorizationId: string,
): Promise<
  | { ok: true; data: StaffBusinessAccess }
  | { ok: false; code: "access_denied" | "invalid_response" | "query_failed" }
> {
  const { data, error } = await client.rpc("get_staff_business_portal_access", {
    p_dealer_authorization_id: dealerAuthorizationId,
  });
  if (error) {
    console.error(`[business-access:detail] ${error.code ?? "unknown"}`);
    return {
      ok: false,
      code:
        error.code === "42501" || error.message.includes("staff_permission_denied")
          ? "access_denied"
          : "query_failed",
    };
  }
  const parsed = staffBusinessAccessSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[business-access:detail] Supabase returned an unexpected response shape.");
    return { ok: false, code: "invalid_response" };
  }
  return { ok: true, data: parsed.data };
}
