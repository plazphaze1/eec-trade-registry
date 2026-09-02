import { updateCatalogueItemAction } from "@/app/staff/actions";
import type { StaffCatalogueItem, StaffCatalogueReferenceData } from "@/lib/staff-catalogue";

interface StaffItemFormProps {
  item: StaffCatalogueItem;
  references: StaffCatalogueReferenceData;
}

export function StaffItemForm({ item, references }: StaffItemFormProps) {
  return (
    <form action={updateCatalogueItemAction} className="product-details-form">
      <input name="item_id" type="hidden" value={item.id} />
      <input name="expected_version" type="hidden" value={item.version} />
      <input name="public_name" type="hidden" value={item.public_name ?? ""} />
      <input name="reason" type="hidden" value="Product details updated through the Products workspace." />

      <header><p className="eyebrow">Product details</p><h2>What staff call it</h2><p>These details identify the product throughout Company records.</p></header>
      <label className="field"><span>Product name</span><input defaultValue={item.display_name} maxLength={160} name="display_name" required /></label>
      <label className="field"><span>Description <small>optional</small></span><textarea defaultValue={item.description} maxLength={4000} name="description" rows={4} /></label>
      <div className="product-create-inline">
        <label className="field"><span>Category</span><select defaultValue={item.category_code} name="category_code" required>{references.categories.map((category) => <option key={category.code} value={category.code}>{category.display_name}</option>)}</select></label>
        <label className="field"><span>Measured as</span><select defaultValue={item.unit_code} name="unit_code" required>{references.units.map((unit) => <option key={unit.code} value={unit.code}>{unit.display_name}</option>)}</select></label>
      </div>

      <details className="product-advanced-details">
        <summary>Advanced record details</summary>
        <div className="product-advanced-content">
          <dl><div><dt>Item code</dt><dd>{item.item_code}</dd></div><div><dt>Public address</dt><dd>/{item.slug}</dd></div></dl>
          <label className="field"><span>Inventory type</span><select defaultValue={item.inventory_mode} name="inventory_mode" required><option value="fungible">Counted quantity</option><option value="serialized">Track each item separately</option></select></label>
          <label className="field"><span>Internal notes <small>optional</small></span><textarea defaultValue={item.internal_notes} maxLength={4000} name="internal_notes" rows={3} /></label>
        </div>
      </details>

      <button className="button button-primary" type="submit">Save product details</button>
    </form>
  );
}
