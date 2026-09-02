import { describe, expect, it } from "vitest";

import {
  setCatalogueStatusSchema,
  updateCatalogueItemSchema,
} from "@/lib/staff-catalogue-form";

const validMutableFields = {
  displayName: "Harbor crate",
  description: "A sturdy shipping crate.",
  categoryCode: "equipment",
  unitCode: "each",
  inventoryMode: "fungible" as const,
  internalNotes: "Internal handling note.",
  reason: "Create an initial draft.",
};

describe("staff catalogue form schemas", () => {
  it("requires a positive concurrency version for updates", () => {
    expect(
      updateCatalogueItemSchema.safeParse({
        ...validMutableFields,
        itemId: "10000000-0000-0000-0000-000000000001",
        expectedVersion: 0,
        publicName: "Harbor crate",
      }).success,
    ).toBe(false);
  });

  it("accepts a public catalogue name alongside a canonical edit", () => {
    expect(
      updateCatalogueItemSchema.safeParse({
        ...validMutableFields,
        itemId: "10000000-0000-0000-0000-000000000001",
        expectedVersion: 2,
        publicName: "Public harbor crate",
      }).success,
    ).toBe(true);
  });

  it("allows only active and archived status transitions", () => {
    expect(
      setCatalogueStatusSchema.safeParse({
        itemId: "10000000-0000-0000-0000-000000000001",
        expectedVersion: 2,
        status: "deleted",
        reason: "Remove the item.",
      }).success,
    ).toBe(false);
  });
});
