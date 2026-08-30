import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("consumer experience contracts", () => {
  it("keeps hidden cart values out of the checkout grid", () => {
    const staffShop = source("../components/guided-order-form.tsx");
    const dealerShop = source("../components/dealer-order-shop.tsx");
    const experienceStyles = source("../app/experience.css");

    expect(staffShop).toContain('className="shop-hidden-cart-line"');
    expect(dealerShop).toContain('className="shop-hidden-cart-line"');
    expect(experienceStyles).toContain(".shop-hidden-cart-line { display: none; }");
  });

  it("keeps routine stock and price work on one item card", () => {
    const stockWorkspace = source("../components/simple-stock-workspace.tsx");
    const inventoryActions = source("../app/staff/inventory/actions.ts");
    const economyActions = source("../app/staff/economy/actions.ts");
    const experienceStyles = source("../app/experience.css");
    const staffShell = source("../components/staff-shell.tsx");

    expect(staffShell).toContain('label: "Stock & prices"');
    expect(staffShell).not.toContain('label: "Buy from a player"');
    expect(stockWorkspace).toContain("Add stock");
    expect(stockWorkspace).toContain("Buy &amp; add");
    expect(stockWorkspace).toContain("Base selling price");
    expect(stockWorkspace).toContain("Company buying price");
    expect(stockWorkspace).toContain('value="/staff/inventory"');
    expect(inventoryActions).toContain('client.rpc("staff_set_item_public_terms"');
    expect(economyActions).toContain('candidate === "/staff/inventory"');
    const stockGridRule = experienceStyles.slice(
      experienceStyles.indexOf(".stock-card-grid"),
      experienceStyles.indexOf(".stock-card-grid") + 240,
    );
    expect(stockGridRule).toContain("align-items: start;");
  });
});
