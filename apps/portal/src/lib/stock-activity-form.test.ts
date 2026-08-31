import { describe, expect, it } from "vitest";

import { readAnonymousPurchaseForm, readCountedTotalForm } from "./stock-activity-form";

const itemId = "20000000-0000-0000-0000-000000000001";

describe("stock activity form parsing", () => {
  it("accepts an anonymous purchase without a seller, price, or note", () => {
    const form = new FormData();
    form.set("item_id", itemId);
    form.set("quantity", "250");
    form.set("occurred_on", "2026-08-31");
    const parsed = readAnonymousPurchaseForm(form);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.quantity).toBe(250);
      expect(parsed.data.note).toBe("");
    }
  });

  it("accepts zero as a counted total but rejects a negative total", () => {
    const valid = new FormData();
    valid.set("item_id", itemId);
    valid.set("target_quantity", "0");
    valid.set("occurred_on", "2026-08-31");
    expect(readCountedTotalForm(valid).success).toBe(true);

    valid.set("target_quantity", "-1");
    expect(readCountedTotalForm(valid).success).toBe(false);
  });

  it("requires a calendar date and positive purchased quantity", () => {
    const form = new FormData();
    form.set("item_id", itemId);
    form.set("quantity", "0");
    form.set("occurred_on", "today");
    expect(readAnonymousPurchaseForm(form).success).toBe(false);
  });
});
