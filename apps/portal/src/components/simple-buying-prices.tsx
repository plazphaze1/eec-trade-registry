import { setBuyingPriceAction } from "@/app/staff/economy/actions";
import type { EconomyWorkspace } from "@/lib/economy";
import { REGISTRY_CONFIG } from "@/lib/registry-config";

function number(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

export function SimpleBuyingPrices({ workspace }: { workspace: EconomyWorkspace }) {
  const currency = workspace.currencies.find((entry) => entry.code === REGISTRY_CONFIG.currency.code)
    ?? workspace.currencies[0];
  const materials = workspace.positions.filter((position) => position.procurement_enabled);
  const currentOffers = workspace.offers.filter((offer) => offer.is_current);
  const missingPrices = materials.filter((material) => !currentOffers.some((offer) => offer.item_id === material.item_id));

  if (!currency || !materials.length) return null;

  return (
    <details className="buying-price-panel" id="buying-prices" open={missingPrices.length > 0}>
      <summary>
        <span className="setup-step-number">1</span>
        <span><strong>{missingPrices.length > 0 ? "Set the buying prices" : "Buying prices are ready"}</strong><small>{missingPrices.length > 0 ? "Enter what the Company pays for each material. You only do this once." : "Open this only when a price needs to change."}</small></span>
        <span>{missingPrices.length > 0 ? `${missingPrices.length} left` : "Change prices"}</span>
      </summary>
      <div className="buying-price-grid">
        {materials.map((material) => {
          const offer = currentOffers.find((candidate) => candidate.item_id === material.item_id);
          return (
            <form action={setBuyingPriceAction} className="buying-price-card" key={material.item_id}>
              <input name="currency_id" type="hidden" value={currency.id} />
              <input name="item_id" type="hidden" value={material.item_id} />
              <div className="buying-price-name"><span className={offer ? "price-ready" : "price-needed"}>{offer ? "Ready" : "Price needed"}</span><h2>{material.item_name}</h2><p>{offer ? `${number(offer.amount_minor)} ${offer.currency_code} per ${material.unit_code}` : `Price per ${material.unit_code}`}</p></div>
              <label className="field"><span>{offer ? "New price" : "Company pays"}</span><div className="quantity-with-unit"><input aria-label={`${material.item_name} buying price`} min="1" name="amount_minor" placeholder={offer ? String(offer.amount_minor) : "Enter price"} required step="1" type="number" /><span>{currency.code}</span></div></label>
              <button className="button button-primary" type="submit">Save</button>
            </form>
          );
        })}
      </div>
      <p className="buying-price-help">New prices apply to future purchases only. Old receipts keep their original price.</p>
    </details>
  );
}
