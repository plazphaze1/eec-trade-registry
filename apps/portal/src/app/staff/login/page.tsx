import Link from "next/link";
import { redirect } from "next/navigation";

import { signInWithDiscordAction } from "@/app/staff/actions";
import { EecSeal } from "@/components/eec-seal";
import { readPublicSupabaseEnvironment } from "@/lib/env";
import { getMyStaffAccessState } from "@/lib/staff-access";
import { createServerSupabaseClient } from "@/lib/supabase-server";

interface StaffLoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function StaffLoginPage({
  searchParams,
}: StaffLoginPageProps) {
  const { error } = await searchParams;
  const configured = Boolean(readPublicSupabaseEnvironment());
  if (configured) {
    const client = await createServerSupabaseClient();
    const session = await client.auth.getClaims();
    if (!session.error && typeof session.data?.claims?.sub === "string") {
      const access = await getMyStaffAccessState(client);
      if (access.ok && access.data.state === "authorized") redirect("/staff/dashboard");
      if (access.ok) redirect(`/staff/access/pending?state=${access.data.state}`);
    }
  }

  return (
    <main className="staff-login-main">
      <section className="staff-login-card">
        <div className="login-card-intro">
          <EecSeal className="login-card-seal" />
          <p className="eyebrow">Restricted staff surface</p>
          <h1>Staff sign in</h1>
          <p>
            Continue with Discord. It confirms who you are, and the Owner decides
            whether you can access staff tools.
          </p>
        </div>

        {!configured ? (
          <div className="staff-flash staff-flash-error" role="alert">
            Staff sign-in is not available right now. Try again later.
          </div>
        ) : (
          <form action={signInWithDiscordAction} className="staff-login-form">
            {error === "cancelled" && (
              <div className="staff-flash staff-flash-error" role="alert">
                Discord sign-in was cancelled. No session was created.
              </div>
            )}
            {(error === "exchange_failed" ||
              error === "provider_unavailable" ||
              error === "provider_error" ||
              error === "missing_code") && (
              <div className="staff-flash staff-flash-error" role="alert">
                Discord did not complete the sign-in. Try again and approve the
                identity prompt. If this repeats, the owner should verify the
                Discord OAuth redirect configuration.
              </div>
            )}
            {error === "request_failed" && (
              <div className="staff-flash staff-flash-error" role="alert">
                Your Discord session was created, but the access request could
                not be recorded. The session was closed and no authority was granted.
              </div>
            )}
            {error === "signup_disabled" && (
              <div className="staff-flash staff-flash-error" role="alert">
                First-time Discord sign-in is currently disabled by the authentication
                service. The owner must enable new user signups before this identity can
                enter the approval queue.
              </div>
            )}
            <button className="button button-primary" type="submit">
              Continue with Discord
            </button>
          </form>
        )}

        <footer>
          <Link className="back-link" href="/">
            ← Return to the public catalogue
          </Link>
          <p>
            First-time staff enter the Owner&apos;s review queue. Nothing becomes
            available until the Owner approves access as an Agent.
          </p>
        </footer>
      </section>
    </main>
  );
}
