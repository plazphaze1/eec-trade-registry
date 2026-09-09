import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { createIntegrationSupabaseClient } from "@/lib/integration-supabase";

export type PublicActionRateLimitScope =
  | "license_application_submit_ip"
  | "license_application_status_ip"
  | "license_application_status_reference";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function clientAddress(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded =
    requestHeaders.get("x-vercel-forwarded-for") ??
    requestHeaders.get("x-forwarded-for") ??
    requestHeaders.get("x-real-ip") ??
    "unresolved-client";
  return forwarded.split(",")[0]?.trim() || "unresolved-client";
}

export async function consumePublicActionRateLimit(
  scope: PublicActionRateLimitScope,
  discriminator = "",
): Promise<boolean> {
  const address = await clientAddress();
  const fingerprint = digest(
    `public-action:${scope}:${address}:${discriminator.trim().toUpperCase()}`,
  );
  const { data, error } = await createIntegrationSupabaseClient().rpc(
    "consume_public_action_rate_limit",
    { p_fingerprint: fingerprint, p_scope: scope },
  );
  if (error) {
    console.error(`[public-rate-limit:${scope}] ${error.code ?? "unknown"}`);
    return false;
  }
  return data === true;
}
