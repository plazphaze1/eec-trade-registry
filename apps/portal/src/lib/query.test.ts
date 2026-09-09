import { describe, expect, it } from "vitest";

import {
  normalizeCategory,
  normalizePage,
  normalizeSearch,
  parseCatalogueQuery,
} from "@/lib/query";

describe("catalogue query normalization", () => {
  it("normalizes whitespace and arrays", () => {
    expect(
      parseCatalogueQuery({ q: ["  brass   lantern  "], category: "TOOLS" }),
    ).toEqual({ search: "brass lantern", category: "tools", page: 1 });
  });

  it("rejects invalid category codes", () => {
    expect(normalizeCategory("../private")).toBeNull();
  });

  it("limits public search input length", () => {
    expect(normalizeSearch("x".repeat(150))).toHaveLength(100);
  });

  it("accepts only positive catalogue page numbers", () => {
    expect(normalizePage("3")).toBe(3);
    expect(normalizePage("-4")).toBe(1);
    expect(normalizePage("anything")).toBe(1);
  });
});
