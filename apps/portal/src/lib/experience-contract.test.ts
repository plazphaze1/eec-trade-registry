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

  it("keeps routine stock and price work directly editable in one item row", () => {
    const stockWorkspace = source("../components/simple-stock-workspace.tsx");
    const inventoryActions = source("../app/staff/inventory/actions.ts");
    const economyActions = source("../app/staff/economy/actions.ts");
    const experienceStyles = source("../app/experience.css");
    const staffShell = source("../components/staff-shell.tsx");

    expect(staffShell).toContain('label: "Stock & prices"');
    expect(staffShell).not.toContain('label: "Buy from a player"');
    expect(stockWorkspace).toContain('className="stock-sheet-table"');
    expect(stockWorkspace).toContain("Add stock");
    expect(stockWorkspace).toContain("Buy + add");
    expect(stockWorkspace).toContain("Selling price");
    expect(stockWorkspace).toContain("Company pays");
    expect(stockWorkspace).not.toContain(">Manage<");
    expect(stockWorkspace).toContain('value="/staff/inventory"');
    expect(inventoryActions).toContain('client.rpc("staff_set_item_public_terms"');
    expect(economyActions).toContain('candidate === "/staff/inventory"');
    const stockSheetRule = experienceStyles.slice(
      experienceStyles.indexOf(".stock-sheet-header"),
      experienceStyles.indexOf(".stock-sheet-header") + 420,
    );
    expect(stockSheetRule).toContain("grid-template-columns:");
  });
});
