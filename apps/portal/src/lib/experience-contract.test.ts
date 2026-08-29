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
});
