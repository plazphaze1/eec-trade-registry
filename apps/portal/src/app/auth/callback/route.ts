import { NextResponse } from "next/server";

import {
  getStaffAccessPendingUrl,
  getStaffOAuthFailureUrl,
  getStaffOAuthProviderFailureReason,
  getStaffOAuthSuccessUrl,
} from "@/lib/staff-oauth";
import { registerStaffAccessRequest } from "@/lib/staff-access";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const providerError = requestUrl.searchParams.get("error");
  const providerErrorCode = requestUrl.searchParams.get("error_code");

  if (providerError) {
    const reason = getStaffOAuthProviderFailureReason(
      providerError,
      providerErrorCode,
    );
    console.error(
      `[staff-auth:provider] ${providerErrorCode ?? providerError}`,
    );
    return NextResponse.redirect(getStaffOAuthFailureUrl(reason));
  }
  if (!code) {
    return NextResponse.redirect(getStaffOAuthFailureUrl("missing_code"));
  }

  const client = await createServerSupabaseClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) {
    console.error(`[staff-auth:callback] ${error.code ?? "exchange_failed"}`);
    return NextResponse.redirect(getStaffOAuthFailureUrl("exchange_failed"));
  }

  const registration = await registerStaffAccessRequest(client);
  if (!registration.ok) {
    await client.auth.signOut();
    return NextResponse.redirect(getStaffOAuthFailureUrl("request_failed"));
  }
  if (registration.data.state === "authorized") {
    return NextResponse.redirect(getStaffOAuthSuccessUrl());
  }
  return NextResponse.redirect(getStaffAccessPendingUrl(registration.data.state));
}
