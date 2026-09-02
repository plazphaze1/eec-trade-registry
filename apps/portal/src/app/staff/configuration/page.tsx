import Link from "next/link";

import {
  createConfigurationReferenceAction,
  createControlProfileAction,
} from "@/app/staff/configuration/actions";
import { ConfigurationNotice } from "@/components/configuration-notice";
import { StaffAccessDenied } from "@/components/staff-access-denied";
import { UiIcon } from "@/components/ui-icon";
import { getStaffConfigurationWorkspace } from "@/lib/configuration";
import { requireStaffSession } from "@/lib/staff-auth";

interface PageProps {
  searchParams: Promise<{ error?: string; notice?: string; view?: string }>;
}

type SetupView = "advanced" | "categories" | "endorsements" | "licenses" | "units";

const views: Array<{ description: string; kind?: "endorsement" | "item_category" | "license_class" | "unit"; label: string; singular: string; value: SetupView }> = [
  { description: "How products are grouped in the shop.", kind: "item_category", label: "Categories", singular: "category", value: "categories" },
  { description: "How quantities are counted.", kind: "unit", label: "Units", singular: "unit", value: "units" },
  { description: "The kinds of authority a business can hold.", kind: "license_class", label: "License types", singular: "license type", value: "licenses" },
  { description: "Extra permissions that can be added to a license.", kind: "endorsement", label: "Endorsements", singular: "endorsement", value: "endorsements" },
  { description: "Availability language and controlled-goods behavior.", label: "Advanced rules", singular: "advanced rule", value: "advanced" },
];

export default async function ConfigurationPage({ searchParams }: PageProps) {
  const parameters = await searchParams;
  const { client } = await requireStaffSession();
  const result = await getStaffConfigurationWorkspace(client);
  if (!result.ok && result.code === "access_denied") {
    return <main className="staff-main"><StaffAccessDenied /></main>;
  }
  if (!result.ok) {
    return <main className="staff-main"><section className="notice-panel"><h1>Company setup is unavailable</h1><p>No fallback data was used and no records were changed.</p></section></main>;
  }

  const workspace = result.data;
  if (!workspace.capabilities.can_manage_configuration) {
    return <main className="staff-main"><StaffAccessDenied /></main>;
  }

  const selectedView = views.some((entry) => entry.value === parameters.view)
    ? parameters.view as SetupView
    : "categories";
  const selected = views.find((entry) => entry.value === selectedView) ?? views[0];
  const optionsByView = {
    categories: workspace.categories,
    endorsements: workspace.endorsements,
    licenses: workspace.license_classes,
    units: workspace.units,
  };
  const options = selectedView === "advanced" ? [] : optionsByView[selectedView];

  return (
    <main className="staff-main company-setup-main">
      <header className="staff-page-header">
        <div>
          <p className="eyebrow">Owner administration</p>
          <h1>Company setup</h1>
          <p>Change reusable choices that appear throughout the registry. Products, stock, prices, and purchases are managed in their own everyday workspaces.</p>
        </div>
      </header>

      <ConfigurationNotice error={parameters.error} notice={parameters.notice} />

      <section aria-labelledby="setup-shortcuts-title" className="setup-shortcuts">
        <div><p className="eyebrow">Looking for everyday work?</p><h2 id="setup-shortcuts-title">Go straight to the thing you want to change.</h2></div>
        <nav aria-label="Everyday product work">
          <Link href="/staff"><UiIcon name="catalogue" /><span><strong>Products</strong><small>Add or edit a product</small></span><UiIcon name="arrow" /></Link>
          <Link href="/staff/inventory"><UiIcon name="box" /><span><strong>Stock &amp; prices</strong><small>Change quantities or normal prices</small></span><UiIcon name="arrow" /></Link>
          <Link href="/staff/activity"><UiIcon name="clipboard" /><span><strong>Record activity</strong><small>Save a purchase or counted total</small></span><UiIcon name="arrow" /></Link>
        </nav>
      </section>

      <section className="configuration-workspace">
        <header>
          <p className="eyebrow">Reusable choices</p>
          <h2>What do you want to configure?</h2>
          <p>Most owners set these once and rarely return.</p>
        </header>

        <nav aria-label="Company setup sections" className="configuration-tabs">
          {views.map((entry) => <Link aria-current={entry.value === selectedView ? "page" : undefined} className={entry.value === selectedView ? "is-active" : ""} href={`/staff/configuration?view=${entry.value}`} key={entry.value}>{entry.label}</Link>)}
        </nav>

        {selectedView !== "advanced" ? (
          <div className="configuration-settings-layout">
            <section aria-labelledby="configured-options-title" className="configuration-existing-options">
              <div><h3 id="configured-options-title">Current {selected.label.toLocaleLowerCase()}</h3><p>{selected.description}</p></div>
              <ul>{options.map((entry) => <li key={entry.id}><span className={entry.active ? "is-active" : ""} /><strong>{entry.display_name}</strong>{"symbol" in entry && entry.symbol ? <small>{entry.symbol}</small> : null}</li>)}</ul>
            </section>

            <form action={createConfigurationReferenceAction} className="configuration-add-form">
              <input name="kind" type="hidden" value={selected.kind} />
              <input name="sort_order" type="hidden" value="0" />
              <div><p className="eyebrow">Add another</p><h3>New {selected.singular}</h3></div>
              <label className="field"><span>Name</span><input maxLength={200} name="display_name" placeholder={selected.value === "categories" ? "Example: Enchanted goods" : selected.value === "units" ? "Example: Bundle" : "Enter a clear name"} required /></label>
              {(selected.value === "licenses" || selected.value === "endorsements") && <label className="field"><span>Public name <small>optional</small></span><input maxLength={200} name="public_display_name" placeholder="Uses the same name when blank" /></label>}
              <label className="field"><span>Description <small>optional</small></span><textarea maxLength={2000} name="description" rows={3} /></label>
              {selected.value === "units" && <div className="product-create-inline"><label className="field"><span>Short symbol <small>optional</small></span><input maxLength={30} name="symbol" placeholder="crate" /></label><label className="field"><span>Decimal places</span><input defaultValue="0" max="6" min="0" name="quantity_scale" type="number" /></label></div>}
              {selected.value !== "units" && <input name="quantity_scale" type="hidden" value="0" />}
              <details className="configuration-advanced-fields"><summary>Advanced identifier and audit note</summary><label className="field"><span>Stable code <small>optional</small></span><input maxLength={50} name="code" pattern="[a-z0-9][a-z0-9_-]*" placeholder="Generated from the name" /></label><label className="field"><span>Audit note <small>optional</small></span><input maxLength={500} name="reason" /></label></details>
              <button className="button button-primary" type="submit">Add {selected.singular}</button>
            </form>
          </div>
        ) : (
          <div className="configuration-advanced-layout">
            <section className="configuration-rule-card">
              <div><p className="eyebrow">Customer wording</p><h3>Availability messages</h3><p>Reusable descriptions such as “Made to order” or “Reserve dependent.”</p></div>
              <ul className="configuration-rule-list">{workspace.availability_profiles.map((entry) => <li key={entry.id}><strong>{entry.display_name}</strong><small>{entry.public_description}</small></li>)}</ul>
              <details><summary>Add availability message</summary><form action={createConfigurationReferenceAction} className="configuration-add-form configuration-inline-add"><input name="kind" type="hidden" value="availability_profile" /><input name="quantity_scale" type="hidden" value="0" /><input name="sort_order" type="hidden" value="0" /><label className="field"><span>Name</span><input maxLength={200} name="display_name" required /></label><label className="field"><span>What customers see</span><textarea maxLength={2000} name="description" required rows={2} /></label><input name="code" type="hidden" value="" /><button className="button button-primary" type="submit">Add message</button></form></details>
            </section>

            <section className="configuration-rule-card">
              <div><p className="eyebrow">Controlled goods</p><h3>Control profiles</h3><p>Use these only when a class of goods needs review or individual tracking.</p></div>
              <ul className="configuration-rule-list">{workspace.control_profiles.map((entry) => <li key={entry.id}><strong>{entry.display_name}</strong><small>{entry.public_description}</small></li>)}</ul>
              <details><summary>Add control profile</summary><form action={createControlProfileAction} className="configuration-add-form configuration-inline-add"><label className="field"><span>Name</span><input maxLength={200} name="display_name" required /></label><label className="field"><span>Public explanation</span><textarea maxLength={2000} name="public_description" required rows={2} /></label><div className="configuration-rule-switches"><label><input name="requires_staff_review" type="checkbox" />Staff review</label><label><input name="requires_transaction_approval" type="checkbox" />Approval</label><label><input name="requires_serial_tracking" type="checkbox" />Track each item</label></div><input name="code" type="hidden" value="" /><button className="button button-primary" type="submit">Add control profile</button></form></details>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
