import Link from "next/link";

import { DealerAccessDenied } from "@/components/dealer-access-denied";
import { requireDealerSession } from "@/lib/dealer-auth";
import { getDealerPortalOverview } from "@/lib/dealer-portal";
import { getDefaultLocale, readPublicSupabaseEnvironment } from "@/lib/env";

export const dynamic = "force-dynamic";

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
}

export default async function DealerPortalPage() {
  if (!readPublicSupabaseEnvironment()) return <main className="dealer-main"><section className="notice-panel"><h1>Business portal unavailable</h1><p>Please try again later.</p></section></main>;
  const { client } = await requireDealerSession();
  const result = await getDealerPortalOverview(client);
  if (!result.ok && result.code === "access_denied") return <main className="dealer-main"><DealerAccessDenied /></main>;
  if (!result.ok) return <main className="dealer-main"><section className="notice-panel"><h1>Your account could not be loaded</h1><p>Please try again.</p></section></main>;
  const locale = getDefaultLocale();

  return (
    <main className="dealer-main dealer-home">
      <header className="dealer-page-header">
        <div><p className="eyebrow">Business account</p><h1>Welcome, {result.data.actor_display_name}</h1><p>Shop, follow an order, or check the business licenses connected to your Discord account.</p></div>
        <div className="staff-button-row"><Link className="button button-primary" href="/dealer/orders/new">Shop</Link><Link className="button button-secondary" href="/dealer/orders">View orders</Link></div>
      </header>

      <section className="dealer-account-grid" aria-label="Connected businesses">
        {result.data.representations.map((representation) => {
          const currentLicense = representation.licenses.find((license) => license.is_currently_authorized) ?? representation.licenses[0];
          const isActive = representation.dealer_authorizations.some((authorization) => authorization.is_currently_authorized);
          return <article className="dealer-account-card" key={representation.representation_id}>
            <header><div><span className={isActive ? "dealer-status-current" : "dealer-status-inactive"}>{isActive ? "Ready to order" : "Needs attention"}</span><h2>{representation.party_name}</h2><p>{representation.role_label}</p></div></header>
            {currentLicense ? <dl><div><dt>License</dt><dd>{currentLicense.license_class_label}</dd></div><div><dt>Status</dt><dd>{currentLicense.status_label}</dd></div><div><dt>Valid until</dt><dd>{currentLicense.expires_at ? formatDate(currentLicense.expires_at, locale) : "No end date"}</dd></div></dl> : <p className="dealer-account-warning">No license is connected to this business.</p>}
            <div className="staff-button-row"><Link className="button button-primary" href="/dealer/orders/new">Start an order</Link></div>
            <details className="dealer-account-details"><summary>License details</summary>{representation.licenses.length ? <ul>{representation.licenses.map((license) => <li key={license.public_reference}><strong>{license.license_class_label}</strong><span>{license.public_reference} · {license.status_label}</span></li>)}</ul> : <p>No licenses recorded.</p>}</details>
          </article>;
        })}
      </section>
    </main>
  );
}
