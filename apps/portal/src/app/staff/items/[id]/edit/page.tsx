import Link from "next/link";
import { notFound } from "next/navigation";

import { setCatalogueItemStatusAction } from "@/app/staff/actions";
import { ItemPublicListingForm } from "@/components/item-public-listing-form";
import { StaffAccessDenied } from "@/components/staff-access-denied";
import { StaffItemForm } from "@/components/staff-item-form";
import { StaffNotice } from "@/components/staff-notice";
import { getStaffConfigurationWorkspace } from "@/lib/configuration";
import { readPublicSupabaseEnvironment } from "@/lib/env";
import { requireStaffSession } from "@/lib/staff-auth";
import {
  getStaffCatalogueItem,
  getStaffCatalogueReferenceData,
} from "@/lib/staff-catalogue";

interface EditStaffCatalogueItemPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}

export default async function EditStaffCatalogueItemPage({
  params,
  searchParams,
}: EditStaffCatalogueItemPageProps) {
  const [{ id }, messages] = await Promise.all([params, searchParams]);
  if (!readPublicSupabaseEnvironment()) {
    return (
      <main className="staff-main">
        <section className="notice-panel">
          <h1>Supabase is not configured</h1>
          <p>No authoritative catalogue source is available.</p>
        </section>
      </main>
    );
  }
  const { client } = await requireStaffSession();
  const [itemResult, referenceResult, configurationResult] = await Promise.all([
    getStaffCatalogueItem(client, id),
    getStaffCatalogueReferenceData(client),
    getStaffConfigurationWorkspace(client),
  ]);

  if (
    (!itemResult.ok && itemResult.code === "access_denied") ||
    (!referenceResult.ok && referenceResult.code === "access_denied") ||
    (!configurationResult.ok && configurationResult.code === "access_denied")
  ) {
    return (
      <main className="staff-main">
        <StaffAccessDenied />
      </main>
    );
  }
  if (!itemResult.ok || !referenceResult.ok || !configurationResult.ok) {
    return (
      <main className="staff-main">
        <section className="notice-panel">
          <h1>The canonical record could not be loaded</h1>
          <p>No authoritative data was changed.</p>
        </section>
      </main>
    );
  }
  if (itemResult.data === null) {
    notFound();
  }

  const item = itemResult.data;
  const configuredItem = configurationResult.data.items.find((entry) => entry.id === item.id);
  if (!configuredItem) {
    return <main className="staff-main"><section className="notice-panel"><h1>The product settings could not be loaded</h1><p>No authoritative data was changed.</p></section></main>;
  }
  const nextStatus = item.status === "active" ? "archived" : "active";

  return (
    <main className="staff-main staff-editor-main">
      <Link className="back-link" href="/staff">← Back to Products</Link>
      <header className="staff-editor-header product-editor-header">
        <p className="eyebrow">Product · {item.item_code}</p>
        <h1>{item.display_name}</h1>
        <p>Update the product itself or change what customers see in the public shop.</p>
      </header>

      <StaffNotice error={messages.error} notice={messages.notice} />
      <StaffItemForm item={item} references={referenceResult.data} />
      <ItemPublicListingForm item={configuredItem} workspace={configurationResult.data} />

      <section className="staff-danger-zone">
        <div>
          <p className="eyebrow">Record lifecycle</p>
          <h2>{item.status === "active" ? "Archive item" : "Restore item"}</h2>
          <p>
            Archiving removes the item from authoritative public projections
            without deleting its catalogue, publication, price, or audit history.
          </p>
        </div>
        <form action={setCatalogueItemStatusAction} className="staff-status-form">
          <input name="item_id" type="hidden" value={item.id} />
          <input
            name="expected_version"
            type="hidden"
            value={item.version}
          />
          <input name="status" type="hidden" value={nextStatus} />
          <label className="field">
            <span>Reason for {nextStatus === "archived" ? "archive" : "restore"}</span>
            <textarea maxLength={500} minLength={3} name="reason" required rows={3} />
          </label>
          <button className="button button-secondary" type="submit">
            {nextStatus === "archived" ? "Archive canonical item" : "Restore item"}
          </button>
        </form>
      </section>
    </main>
  );
}
