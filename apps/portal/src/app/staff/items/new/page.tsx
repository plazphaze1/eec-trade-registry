import Link from "next/link";

import { quickCreateItemAction } from "@/app/staff/configuration/actions";
import { ConfigurationNotice } from "@/components/configuration-notice";
import { StaffAccessDenied } from "@/components/staff-access-denied";
import { getStaffConfigurationWorkspace } from "@/lib/configuration";
import { readPublicSupabaseEnvironment } from "@/lib/env";
import { requireStaffSession } from "@/lib/staff-auth";

interface NewStaffCatalogueItemPageProps {
  searchParams: Promise<{ error?: string }>;
}

function preferredCode(codes: string[], preferred: string[]) {
  return preferred.find((code) => codes.includes(code)) ?? codes[0] ?? "";
}

const supplyChoices = [
  { description: "Finished goods that staff can add to stock.", label: "Keep it in stock", value: "warehouse_stocked" },
  { description: "Materials the Company buys from players.", label: "Buy it from players", value: "player_sourced_reserve" },
  { description: "Customers can order it without stock on hand.", label: "Make it when ordered", value: "made_to_order" },
  { description: "Available only when staff deliberately release it.", label: "Limited release", value: "limited_release" },
  { description: "Each individual object has its own custody record.", label: "Track each one separately", value: "serialized_unique" },
] as const;

export default async function NewStaffCatalogueItemPage({ searchParams }: NewStaffCatalogueItemPageProps) {
  const { error } = await searchParams;
  if (!readPublicSupabaseEnvironment()) {
    return <main className="staff-main"><section className="notice-panel"><h1>Supabase is not configured</h1><p>No authoritative catalogue source is available.</p></section></main>;
  }

  const { client } = await requireStaffSession();
  const result = await getStaffConfigurationWorkspace(client);
  if (!result.ok && result.code === "access_denied") {
    return <main className="staff-main"><StaffAccessDenied /></main>;
  }
  if (!result.ok) {
    return <main className="staff-main"><section className="notice-panel"><h1>Product choices could not be loaded</h1><p>No authoritative data was changed.</p></section></main>;
  }

  const workspace = result.data;
  const categories = workspace.categories.filter((entry) => entry.active);
  const units = workspace.units.filter((entry) => entry.active);
  const controls = workspace.control_profiles.filter((entry) => entry.active);
  const availability = workspace.availability_profiles.filter((entry) => entry.active);
  const defaultControl = preferredCode(controls.map((entry) => entry.code), ["ordinary-economic", "ordinary"]);
  const defaultAvailability = preferredCode(availability.map((entry) => entry.code), ["available", "reserve-dependent", "by-request"]);
  const canCreate = workspace.capabilities.can_manage_catalogue
    && workspace.capabilities.can_manage_supply_policy
    && categories.length > 0
    && units.length > 0
    && Boolean(defaultControl)
    && Boolean(defaultAvailability);

  return (
    <main className="staff-main product-create-main">
      <Link className="back-link" href="/staff">← Back to Products</Link>
      <header className="staff-page-header product-create-header">
        <div>
          <p className="eyebrow">New product</p>
          <h1>Add something the Company trades</h1>
          <p>Name it, classify it, and choose how the Company gets it. Codes and audit records are created automatically.</p>
        </div>
      </header>

      <ConfigurationNotice error={error} />

      <form action={quickCreateItemAction} className="product-create-form">
        <input name="availability_profile_code" type="hidden" value={defaultAvailability} />
        <input name="control_profile_code" type="hidden" value={defaultControl} />
        <input name="item_code" type="hidden" value="" />
        <input name="reason" type="hidden" value="Product added through the staff Products workspace." />
        <input name="requirement_summary" type="hidden" value="" />
        <input name="slug" type="hidden" value="" />

        <section className="product-create-section">
          <span className="product-create-step">1</span>
          <div className="product-create-fields">
            <div><h2>What is it?</h2><p>Use the name players should recognize.</p></div>
            <label className="field"><span>Product name</span><input autoFocus maxLength={200} name="display_name" placeholder="Example: Iron Sword" required /></label>
            <label className="field"><span>Short description <small>optional</small></span><textarea maxLength={4000} name="description" placeholder="What should customers know?" rows={3} /></label>
          </div>
        </section>

        <section className="product-create-section">
          <span className="product-create-step">2</span>
          <div className="product-create-fields">
            <div><h2>Where does it belong?</h2><p>These choices control how it is grouped and counted.</p></div>
            <div className="product-create-inline">
              <label className="field"><span>Category</span><select name="category_code" required>{categories.map((entry) => <option key={entry.id} value={entry.code}>{entry.display_name}</option>)}</select></label>
              <label className="field"><span>Measured as</span><select name="unit_code" required>{units.map((entry) => <option key={entry.id} value={entry.code}>{entry.display_name}{entry.symbol ? ` (${entry.symbol})` : ""}</option>)}</select></label>
            </div>
          </div>
        </section>

        <fieldset className="product-create-section product-supply-section">
          <span className="product-create-step">3</span>
          <div className="product-create-fields">
            <legend>How does the Company get it?</legend>
            <p>Choose the closest normal workflow. This can be refined later.</p>
            <div className="product-supply-choices">
              {supplyChoices.map((choice, index) => <label className="product-supply-choice" key={choice.value}>
                <input defaultChecked={index === 0} name="supply_mode" type="radio" value={choice.value} />
                <span><strong>{choice.label}</strong><small>{choice.description}</small></span>
              </label>)}
            </div>
          </div>
        </fieldset>

        <label className="product-publish-choice">
          <input defaultChecked={workspace.capabilities.can_manage_publication} disabled={!workspace.capabilities.can_manage_publication} name="publish" type="checkbox" />
          <span><strong>Show it in the public shop</strong><small>You can change its public description and price afterward.</small></span>
        </label>

        {!canCreate && <p className="form-error">Products cannot be added until the required categories, units, and staff permissions are available.</p>}
        <div className="product-create-actions">
          <Link className="button button-secondary" href="/staff">Cancel</Link>
          <button className="button button-primary" disabled={!canCreate} type="submit">Add product</button>
        </div>
      </form>
    </main>
  );
}
