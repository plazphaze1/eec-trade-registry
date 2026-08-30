import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { BUSINESS_AUTH_COOKIE_NAME } from "@/lib/business-auth-cookie";
import { readPublicSupabaseEnvironment } from "@/lib/env";

async function updateCookieSession(request: NextRequest, cookieName?: string) {
  const environment = readPublicSupabaseEnvironment();
  if (!environment) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      ...(cookieName ? { cookieOptions: { name: cookieName } } : {}),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headersToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(headersToSet).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  await supabase.auth.getClaims();
  return response;
}

export async function updateSupabaseSession(request: NextRequest) {
  return updateCookieSession(request);
}

export async function updateBusinessSupabaseSession(request: NextRequest) {
  return updateCookieSession(request, BUSINESS_AUTH_COOKIE_NAME);
}
