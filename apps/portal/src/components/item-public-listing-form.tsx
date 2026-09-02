import Link from "next/link";

import { setItemPublicTermsAction } from "@/app/staff/configuration/actions";
import type { ConfigurationWorkspace } from "@/lib/configuration";

type ConfigurationItem = ConfigurationWorkspace["items"][number];

function preferredCode(codes: string[], preferred: string[]) {
  return preferred.find((code) => codes.includes(code)) ?? codes[0] ?? "";
}

function priceLabel(item: ConfigurationItem) {
  return item.price_amount_minor === null
    ? "No normal price yet"
    : `${item.price_amount_minor.toLocaleString()} ${item.currency_code ?? ""}`.trim();
}

export function ItemPublicListingForm({ item, workspace }: { item: ConfigurationItem; workspace: ConfigurationWorkspace }) {
  const controls = workspace.control_profiles.filter((entry) => entry.active);
  const availability = workspace.availability_profiles.filter((entry) => entry.active);
  const defaultControl = preferredCode(controls.map((entry) => entry.code), ["ordinary-economic", "ordinary"]);
  const defaultAvailability = preferredCode(availability.map((entry) => entry.code), ["available", "reserve-dependent", "by-request"]);
  const published = item.publication_status === "published";

  return (
    <section className="product-public-card">
      <header>
        <div><p className="eyebrow">Public shop</p><h2>What customers see</h2><p>Publish the product and keep its customer-facing wording here.</p></div>
        <div className="product-price-summary"><span>Normal price</span><strong>{priceLabel(item)}</strong><Link href="/staff/inventory">Change in Stock &amp; prices</Link></div>
      </header>

      {!workspace.capabilities.can_manage_publication ? <p className="empty-state">Your current access cannot change public listings.</p> : (
        <form action={setItemPublicTermsAction} className="product-public-form">
          <input name="item_id" type="hidden" value={item.id} />
          <input name="price_action" type="hidden" value="keep" />
          <label className="product-publish-choice product-publish-inline">
            <input defaultChecked={published} name="publish" type="checkbox" />
            <span><strong>Show this product in the public shop</strong><small>Turn this off to hide it without deleting its history.</small></span>
          </label>
          <div className="product-create-inline">
            <label className="field"><span>Customer-facing name</span><input defaultValue={item.public_name ?? item.display_name} maxLength={200} name="public_name" required /></label>
            <label className="field"><span>Availability</span><select defaultValue={item.availability_profile_code ?? defaultAvailability} name="availability_profile_code" required>{availability.map((entry) => <option key={entry.id} value={entry.code}>{entry.display_name}</option>)}</select></label>
          </div>
          <label className="field"><span>Shop description</span><textarea defaultValue={(item.public_description ?? item.description) || item.display_name} maxLength={4000} name="public_description" required rows={3} /></label>

          <details className="product-advanced-details">
            <summary>Ordering rules</summary>
            <div className="product-advanced-content product-ordering-rules">
              <label className="field"><span>Customer instructions</span><input defaultValue={item.requirement_summary ?? "Choose the amount you need. An Agent will confirm the order."} maxLength={1000} name="requirement_summary" required /></label>
              <label className="field"><span>Control level</span><select defaultValue={item.control_profile_code ?? defaultControl} name="control_profile_code" required>{controls.map((entry) => <option key={entry.id} value={entry.code}>{entry.display_name}</option>)}</select></label>
              <div className="product-create-inline">
                <label className="field"><span>Bulk minimum <small>optional</small></span><input defaultValue={item.bulk_minimum ?? ""} min="0.001" name="bulk_minimum" step="0.001" type="number" /></label>
                <label className="field"><span>Order increment</span><input defaultValue={item.order_increment ?? 1} min="0.001" name="order_increment" required step="0.001" type="number" /></label>
              </div>
              <label className="field"><span>Audit note <small>optional</small></span><input maxLength={500} name="reason" placeholder="Only if this change needs explanation" /></label>
            </div>
          </details>
          <button className="button button-primary" type="submit">Save public listing</button>
        </form>
      )}
    </section>
  );
}
