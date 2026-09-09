"use server";

import { z } from "zod";

import { createIntegrationSupabaseClient } from "@/lib/integration-supabase";
import { consumePublicActionRateLimit } from "@/lib/public-action-rate-limit";

export interface ApplicationState {
  error?: string;
  reference?: string;
  status?: string;
  token?: string;
}

const newApplicationSchema = z.object({
  applicant_name: z.string().trim().min(2).max(200),
  application_type: z.literal("new"),
  contact_label: z.string().trim().min(2).max(300),
  jurisdiction_code: z.string().trim().min(1).max(50),
  license_class_code: z.string().trim().min(1).max(50),
  request_id: z.guid(),
  statement: z.string().trim().min(10).max(4000),
  website: z.string().max(0).default(""),
});

function receipt(data: unknown): ApplicationState {
  const row = Array.isArray(data) ? data[0] : null;
  return row
    ? {
        reference: String(row.public_reference),
        token: String(row.status_token),
      }
    : { error: "The application was not completed. Please try again." };
}

export async function submitApplicationAction(
  _previous: ApplicationState,
  form: FormData,
): Promise<ApplicationState> {
  const parsed = newApplicationSchema.safeParse(
    Object.fromEntries(form.entries()),
  );
  if (!parsed.success) {
    return { error: "Check every required field and provide a useful statement." };
  }
  const input = parsed.data;
  if (!(await consumePublicActionRateLimit("license_application_submit_ip"))) {
    return { error: "Too many applications were sent from this connection. Try again later." };
  }
  const endorsements = form
    .getAll("endorsement_codes")
    .filter((value): value is string => typeof value === "string");
  const client = createIntegrationSupabaseClient();
  const { data, error } = await client.rpc("public_submit_license_application", {
    p_applicant_name: input.applicant_name,
    p_application_type: "new",
    p_contact_label: input.contact_label,
    p_endorsement_codes: endorsements,
    p_existing_license_reference: null,
    p_jurisdiction_code: input.jurisdiction_code,
    p_license_class_code: input.license_class_code,
    p_request_id: input.request_id,
    p_statement: input.statement,
  });
  if (error) {
    console.error(`[public-application] ${error.code ?? "unknown"}`);
    return { error: "The application could not be sent. Please try again." };
  }
  return receipt(data);
}

export async function checkApplicationAction(
  _previous: ApplicationState,
  form: FormData,
): Promise<ApplicationState> {
  const reference = String(form.get("reference") ?? "").trim();
  const token = String(form.get("token") ?? "").trim();
  if (!reference || !token) {
    return { error: "Enter both the application reference and private status token." };
  }
  const [ipAllowed, referenceAllowed] = await Promise.all([
    consumePublicActionRateLimit("license_application_status_ip"),
    consumePublicActionRateLimit("license_application_status_reference", reference),
  ]);
  if (!ipAllowed || !referenceAllowed) {
    return { error: "Too many status checks were made. Wait a few minutes and try again." };
  }
  const client = createIntegrationSupabaseClient();
  const { data, error } = await client.rpc(
    "public_get_license_application_status",
    { p_reference: reference, p_status_token: token },
  );
  if (error) return { error: "Status lookup is temporarily unavailable." };
  const row = Array.isArray(data) ? data[0] : null;
  return row
    ? { reference: String(row.public_reference), status: String(row.status) }
    : { error: "No application matched that reference and private token." };
}
