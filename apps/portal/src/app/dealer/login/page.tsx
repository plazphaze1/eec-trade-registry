import Link from "next/link";
import { redirect } from "next/navigation";

import { signInDealerAction } from "@/app/dealer/actions";
import { EecLogo } from "@/components/eec-logo";
import { hasAuthenticatedDealerSession } from "@/lib/dealer-auth";
import { readPublicSupabaseEnvironment } from "@/lib/env";

interface DealerLoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function DealerLoginPage({
  searchParams,
}: DealerLoginPageProps) {
  const { error } = await searchParams;
  const configured = Boolean(readPublicSupabaseEnvironment());
  if (configured && (await hasAuthenticatedDealerSession())) {
    redirect("/dealer");
  }

  return (
    <main className="staff-login-main dealer-login-main">
      <section className="staff-login-card dealer-login-card">
        <div className="login-card-intro">
          <EecLogo className="login-card-logo" priority sizes="150px" />
          <p className="eyebrow">Business portal</p>
          <h1>Business sign in</h1>
          <p>
            Use the license number and private access code issued by the East
            Empire Company. No email or Discord account is required.
          </p>
        </div>

        {!configured ? (
          <div className="staff-flash staff-flash-error" role="alert">
            Business sign-in is not available right now. Try again later.
          </div>
        ) : (
          <form action={signInDealerAction} className="staff-login-form">
            {error === "invalid_credentials" && (
              <div className="staff-flash staff-flash-error" role="alert">
                That license number or access code was not recognized. Check
                both entries or ask an EEC Agent to reset the code.
              </div>
            )}
            <label className="field">
              <span>License number</span>
              <input
                autoComplete="username"
                autoCapitalize="characters"
                name="license_reference"
                placeholder="LIC-…"
                required
              />
              <small>Use the LIC number printed on the business license.</small>
            </label>
            <label className="field">
              <span>Private access code</span>
              <input
                autoComplete="current-password"
                minLength={8}
                name="access_code"
                required
                type="password"
              />
            </label>
            <button className="button button-primary" type="submit">
              Sign in
            </button>
          </form>
        )}

        <footer>
          <Link className="back-link" href="/">
            ← Return to the public catalogue
          </Link>
          <p>
            Need an access code? An EEC Owner can create or reset it from the
            business record. The license must still be active when you sign in
            and whenever you place an order.
          </p>
        </footer>
      </section>
    </main>
  );
}
