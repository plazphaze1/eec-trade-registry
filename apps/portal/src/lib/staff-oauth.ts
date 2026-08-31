import { getSiteOrigin } from "@/lib/env";

export type StaffOAuthFailureReason =
  | "cancelled"
  | "exchange_failed"
  | "missing_code"
  | "provider_error"
  | "request_failed"
  | "signup_disabled";

export function getStaffOAuthProviderFailureReason(
  providerError: string,
  providerErrorCode: string | null,
): StaffOAuthFailureReason {
  if (providerErrorCode === "signup_disabled") return "signup_disabled";
  if (providerError === "access_denied") return "cancelled";
  return "provider_error";
}

export function getStaffOAuthCallbackUrl(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return new URL("/auth/callback", getSiteOrigin(environment)).toString();
}

export function getStaffOAuthSuccessUrl(
  environment: NodeJS.ProcessEnv = process.env,
): URL {
  return new URL("/staff/dashboard", getSiteOrigin(environment));
}

export function getStaffAccessPendingUrl(
  state: "pending" | "denied" | "blocked" | "unregistered",
  environment: NodeJS.ProcessEnv = process.env,
): URL {
  const target = new URL("/staff/access/pending", getSiteOrigin(environment));
  target.searchParams.set("state", state);
  return target;
}

export function getStaffOAuthFailureUrl(
  reason: StaffOAuthFailureReason,
  environment: NodeJS.ProcessEnv = process.env,
): URL {
  const target = new URL("/staff/login", getSiteOrigin(environment));
  target.searchParams.set("error", reason);
  return target;
}
