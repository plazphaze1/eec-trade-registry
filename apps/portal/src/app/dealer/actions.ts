"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { businessAccountEmail, readBusinessLoginForm } from "@/lib/business-access";
import { createIntegrationSupabaseClient } from "@/lib/integration-supabase";
import { createBusinessSupabaseClient } from "@/lib/supabase-server";

function loginErrorDestination(): string {
  return `/dealer/login?${new URLSearchParams({
    error: "invalid_credentials",
  }).toString()}`;
}

export async function signInDealerAction(formData: FormData) {
  const parsed = readBusinessLoginForm(formData);
  if (!parsed.success) {
    redirect(loginErrorDestination());
  }

  let context: { auth_user_id: string; party_id: string } | null = null;
  try {
    const serviceClient = createIntegrationSupabaseClient();
    const result = await serviceClient.rpc("get_business_portal_login_context", {
      p_license_reference: parsed.data.licenseReference,
    });
    const candidate = Array.isArray(result.data) ? result.data[0] : null;
    if (
      !result.error &&
      candidate &&
      z.guid().safeParse(candidate.auth_user_id).success &&
      z.guid().safeParse(candidate.party_id).success
    ) {
      context = candidate as { auth_user_id: string; party_id: string };
    }
  } catch {
    console.error("[business-login] Service authentication is unavailable.");
  }
  if (!context) redirect(loginErrorDestination());

  const client = await createBusinessSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: businessAccountEmail(context.party_id),
    password: parsed.data.accessCode,
  });
  if (error) {
    redirect(loginErrorDestination());
  }
  if (data.user.id !== context.auth_user_id) {
    await client.auth.signOut();
    redirect(loginErrorDestination());
  }

  const overview = await client.rpc("get_dealer_portal_overview");
  if (overview.error) {
    await client.auth.signOut();
    redirect(loginErrorDestination());
  }
  redirect("/dealer");
}

export async function signOutDealerAction() {
  const client = await createBusinessSupabaseClient();
  await client.auth.signOut();
  redirect("/dealer/login");
}
