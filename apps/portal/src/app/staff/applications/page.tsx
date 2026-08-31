import Link from "next/link";

import { reviewLicenseApplicationAction } from "@/app/staff/applications/actions";
import { StaffAccessDenied } from "@/components/staff-access-denied";
import { StaffNotice } from "@/components/staff-notice";
import { UiIcon } from "@/components/ui-icon";
import { getDefaultLocale } from "@/lib/env";
import {
  getLicenseApplicationReviewWorkspace,
  type LicenseApplicationReviewWorkspace,
} from "@/lib/license-application-review";
import { requireStaffSession } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

interface ApplicationsPageProps {
  searchParams: Promise<{ error?: string; notice?: string }>;
}

type Application = LicenseApplicationReviewWorkspace["applications"][number];

function submittedLabel(application: Application, locale: string) {
  return new Date(application.submitted_at).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ApprovalForm({ application }: { application: Application }) {
  const common = <>
    <input name="application_id" type="hidden" value={application.id} />
    <input name="expected_version" type="hidden" value={application.version} />
    <input name="decision" type="hidden" value="approve" />
    <input name="holder_party_id" type="hidden" value="" />
    <input name="effective_from" type="hidden" value="" />
    <input name="initial_status_code" type="hidden" value="active" />
  </>;

  if (application.type === "renewal") {
    return <form action={reviewLicenseApplicationAction} className="license-review-primary-action">
      {common}
      <input name="reason" type="hidden" value="Renewal application reviewed and approved." />
      <label className="field"><span>Renew until</span><input name="expires_at" required type="datetime-local" /></label>
      <button className="button button-primary"><UiIcon name="check" />Approve renewal</button>
    </form>;
  }

  return <form action={reviewLicenseApplicationAction} className="license-review-primary-action">
    {common}
    <input name="expires_at" type="hidden" value="" />
    <input name="reason" type="hidden" value="New business application reviewed and approved." />
    <div><strong>Approve this business</strong><p>This creates the business, its trading authorization, and its license together.</p></div>
    <button className="button button-primary"><UiIcon name="check" />Approve business</button>
  </form>;
}

function DenialForm({ application }: { application: Application }) {
  return <details className="license-review-secondary-action">
    <summary>Decline this request</summary>
    <form action={reviewLicenseApplicationAction}>
      <input name="application_id" type="hidden" value={application.id} />
      <input name="expected_version" type="hidden" value={application.version} />
      <input name="decision" type="hidden" value="deny" />
      <input name="holder_party_id" type="hidden" value="" />
      <input name="effective_from" type="hidden" value="" />
      <input name="expires_at" type="hidden" value="" />
      <input name="initial_status_code" type="hidden" value="active" />
      <label className="field"><span>Why is it being declined?</span><textarea maxLength={500} name="reason" required rows={3} /></label>
      <button className="button button-secondary">Decline request</button>
    </form>
  </details>;
}

export default async function StaffApplicationsPage({ searchParams }: ApplicationsPageProps) {
  const parameters = await searchParams;
  const { client } = await requireStaffSession();
  const result = await getLicenseApplicationReviewWorkspace(client);
  if (!result.ok && result.denied) {
    return <main className="staff-main"><StaffAccessDenied /></main>;
  }
  if (!result.ok) {
    return <main className="staff-main"><section className="notice-panel"><h1>License requests are unavailable</h1><p>No decision was recorded.</p></section></main>;
  }

  const locale = getDefaultLocale();
  const pending = result.data.applications.filter((application) =>
    application.status === "submitted" || application.status === "under_review"
  );
  const recent = result.data.applications.filter((application) =>
    application.status !== "submitted" && application.status !== "under_review"
  );

  return <main className="staff-main license-review-page">
    <header className="staff-page-header">
      <div><p className="eyebrow">Licensing</p><h1>License requests</h1><p>Read the request, then approve or decline it. A new approval creates the complete licensed business automatically.</p></div>
      <Link className="button button-secondary" href="/apply" target="_blank">View public form</Link>
    </header>
    <StaffNotice error={parameters.error} notice={parameters.notice} />

    <section className="license-review-queue">
      <header><div><h2>{pending.length ? `${pending.length} waiting` : "Nothing waiting"}</h2><p>Oldest requests appear first.</p></div></header>
      {pending.map((application) => <article className="license-review-card" key={application.id}>
        <header>
          <div><span className="license-review-kind">{application.type === "new" ? "New business" : "Renewal"}</span><h2>{application.applicant_name}</h2><p>{application.contact_label} · {submittedLabel(application, locale)}</p></div>
          <small>{application.reference}</small>
        </header>
        <div className="license-review-body">
          <div><span>Wants to sell</span><strong>{application.requested_endorsements.length ? application.requested_endorsements.map((item) => item.label).join(", ") : application.class_name}</strong></div>
          <div><span>What the business does</span><p>{application.statement}</p></div>
          {application.existing_license_reference && <div><span>Current license</span><strong>{application.existing_license_reference}</strong></div>}
        </div>
        <ApprovalForm application={application} />
        <DenialForm application={application} />
      </article>)}
      {!pending.length && <div className="license-review-empty"><UiIcon name="check" /><div><strong>You are caught up.</strong><p>New public applications will appear here automatically.</p></div></div>}
    </section>

    {recent.length > 0 && <details className="staff-tools-disclosure license-review-history">
      <summary>Recently reviewed requests</summary>
      <div>{recent.map((application) => <article key={application.id}><div><strong>{application.applicant_name}</strong><small>{application.reference}</small></div><span className={`staff-status staff-status-${application.status === "denied" ? "inactive" : "active"}`}>{application.status}</span></article>)}</div>
    </details>}

    <details className="staff-tools-disclosure license-manual-tools">
      <summary>Manual licensing tools</summary>
      <p>Use these only for imported records or exceptional cases that did not begin with a public application.</p>
      <div className="staff-button-row"><Link className="button button-secondary" href="/staff/dealers/new">Add a business manually</Link><Link className="button button-secondary" href="/staff/licensing">Open license registry</Link></div>
    </details>
  </main>;
}
