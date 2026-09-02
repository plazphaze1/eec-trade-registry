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
    expect(staffShell).toContain('label: "Record activity"');
    expect(staffShell).toContain('label: "Company books"');
    expect(staffShell).toContain('label: "Bank"');
    expect(staffShell).not.toContain('label: "Buy from a player"');
    expect(stockWorkspace).toContain('className="stock-sheet-table"');
    expect(stockWorkspace).toContain("Add stock");
    expect(stockWorkspace).toContain("Record purchase");
    expect(stockWorkspace).not.toContain("Add your first seller");
    expect(stockWorkspace).toContain("Selling price");
    expect(stockWorkspace).toContain("Company pays");
    expect(stockWorkspace).not.toContain(">Manage<");
    expect(stockWorkspace).toContain("/staff/activity?mode=purchase");
    expect(inventoryActions).toContain('client.rpc("staff_set_item_public_terms"');
    expect(economyActions).toContain('candidate === "/staff/inventory"');
    const stockSheetRule = experienceStyles.slice(
      experienceStyles.indexOf(".stock-sheet-header"),
      experienceStyles.indexOf(".stock-sheet-header") + 420,
    );
    expect(stockSheetRule).toContain("grid-template-columns:");
  });

  it("uses the approved Company artwork across every application surface", () => {
    const logo = source("../components/eec-logo.tsx");
    const publicChrome = source("../components/public-chrome.tsx");
    const staffShell = source("../components/staff-shell.tsx");
    const dealerShell = source("../components/dealer-shell.tsx");

    expect(logo).toContain('/brand/eec-warehouse-logo.png');
    expect(logo).toContain("EecHeroEmblem");
    expect(publicChrome).toContain("<EecLogo");
    expect(staffShell).toContain("<EecLogo");
    expect(dealerShell).toContain("<EecLogo");
  });

  it("keeps legacy desks out of the everyday dashboard and default launcher", () => {
    const dashboard = source("../app/staff/dashboard/page.tsx");
    const palette = source("../components/staff-command-palette.tsx");
    const oldBuyingPage = source("../app/staff/buy/page.tsx");
    const launchActions = source("../app/staff/launch/actions.ts");

    expect(dashboard).toContain('id="administration-title">Administration');
    expect(dashboard).not.toContain("toolGroups");
    expect(dashboard).not.toContain(">Staff tools<");
    expect(palette).toContain("available.filter((command) => command.suggested)");
    expect(palette).not.toContain('label: "Issue a license"');
    expect(palette).not.toContain('label: "Add a business"');
    expect(oldBuyingPage).toContain('redirect("/staff/activity?mode=purchase")');
    expect(launchActions).not.toContain("createTradeOrderAction");
    expect(launchActions).not.toContain("decideApplicationAction");
  });

  it("keeps product work out of Company setup", () => {
    const setup = source("../app/staff/configuration/page.tsx");
    const setupActions = source("../app/staff/configuration/actions.ts");
    const productList = source("../app/staff/page.tsx");
    const productCreate = source("../app/staff/items/new/page.tsx");
    const productEdit = source("../app/staff/items/[id]/edit/page.tsx");

    expect(setup).toContain(">Company setup<");
    expect(setup).toContain("Reusable choices");
    expect(setup).not.toContain("Quick-add an item or material");
    expect(setup).not.toContain("Add ordinary inventory");
    expect(setup).not.toContain("Edit publication and price");
    expect(setupActions).not.toContain("quickReceiptAction");
    expect(productList).toContain('href="/staff/items/new"');
    expect(productCreate).toContain(">Add product<");
    expect(productCreate).toContain("How does the Company get it?");
    expect(productEdit).toContain("<ItemPublicListingForm");
  });
});
