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

  if (!currency || !materials.length) return null;

  return (
    <details className="buying-price-panel" id="buying-prices" open={currentOffers.length === 0}>
      <summary>
        <span><strong>{currentOffers.length === 0 ? "First, set what the Company pays" : "Buying prices"}</strong><small>One reusable price for each player-supplied material</small></span>
        <span>{currentOffers.length === 0 ? "Setup needed" : "View or change"}</span>
      </summary>
      <div className="buying-price-grid">
        {materials.map((material) => {
          const offer = currentOffers.find((candidate) => candidate.item_id === material.item_id);
          return (
            <form action={setBuyingPriceAction} className="buying-price-card" key={material.item_id}>
              <input name="currency_id" type="hidden" value={currency.id} />
              <input name="item_id" type="hidden" value={material.item_id} />
              <div><h2>{material.item_name}</h2><p>{offer ? `Currently ${number(offer.amount_minor)} ${offer.currency_code} each` : "No buying price yet"}</p></div>
              <label className="field"><span>{offer ? "New price" : "Company pays"}</span><div className="quantity-with-unit"><input min="1" name="amount_minor" placeholder={offer ? String(offer.amount_minor) : "0"} required step="1" type="number" /><span>{currency.code}</span></div></label>
              <button className="button button-primary" type="submit">{offer ? "Update" : "Save price"}</button>
            </form>
          );
        })}
      </div>
      <p className="buying-price-help">Saving a new price replaces the old one for future purchases. Earlier purchases keep the price they were made at.</p>
    </details>
  );
}
