import Link from "next/link";

import { signOutDealerAction } from "@/app/dealer/actions";

export function DealerAccessDenied() {
  return (
    <section className="notice-panel staff-access-panel">
      <p className="eyebrow">Business access ended</p>
      <h1>This business cannot use the portal right now</h1>
      <p>
        The business license or portal access is no longer active. Sign out and
        ask an EEC Owner to check the business record or reset its access code.
      </p>
      <div className="staff-button-row">
        <form action={signOutDealerAction}>
          <button className="button button-primary" type="submit">
            Sign out
          </button>
        </form>
        <Link className="button button-secondary" href="/verify">
          Public verification
        </Link>
      </div>
    </section>
  );
}
