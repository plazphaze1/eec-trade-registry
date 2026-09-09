import { cache } from "react";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase-server";

const getStaffRequestSession = cache(async () => {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getClaims();
  const subject = data?.claims?.sub;

  return {
    client,
    subject: !error && typeof subject === "string" && subject.length > 0
      ? subject
      : null,
  };
});

export async function requireStaffSession() {
  const { client, subject } = await getStaffRequestSession();

  if (!subject) {
    redirect("/staff/login");
  }

  return { client, subject };
}

export async function hasStaffSession(): Promise<boolean> {
  const { subject } = await getStaffRequestSession();
  return subject !== null;
}

export async function getOptionalStaffSession() {
  return getStaffRequestSession();
}
