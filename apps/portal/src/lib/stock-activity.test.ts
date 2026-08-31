import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { getStaffMoneyWorkspace, getStaffStockActivityWorkspace } from "./stock-activity";

describe("stock activity workspaces", () => {
  it("preserves an unpriced purchase without coercing missing money to zero", async () => {
    const data = {
      capabilities: { can_reconcile_count: true, can_record_purchase: true },
      generated_at: "2026-08-31T12:00:00Z",
      items: [{
        buying_currency_code: null, buying_price_minor: null, can_purchase: true,
        can_set_total: false, current_quantity: "10.000",
        id: "20000000-0000-0000-0000-000000000001", item_code: "RM-IRON-ORE",
        item_name: "Iron Ore", unit_code: "material-unit",
      }],
      recent_activity: [],
    };
    const client = { rpc: async () => ({ data, error: null }) } as unknown as SupabaseClient;
    const result = await getStaffStockActivityWorkspace(client);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.items[0]?.buying_price_minor).toBeNull();
  });

  it("parses known and unpriced purchases on the money page", async () => {
    const data = {
      generated_at: "2026-08-31T12:00:00Z",
      recent_purchases: [{
        created_at: "2026-08-31T12:00:00Z", currency_code: null,
        id: "30000000-0000-0000-0000-000000000001", item_name: "Iron Ore",
        occurred_on: "2026-08-31", public_reference: "EEC-ACT-1001", quantity: "50.000",
        seller_label: "Anonymous purchase", source_type: "anonymous_purchase", status: "unpriced",
        total_amount_minor: null, unit_code: "material-unit", unit_price_minor: null,
      }],
      summaries: [],
      unpriced_purchase_count: 1,
    };
    const client = { rpc: async () => ({ data, error: null }) } as unknown as SupabaseClient;
    const result = await getStaffMoneyWorkspace(client);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.unpriced_purchase_count).toBe(1);
      expect(result.data.recent_purchases[0]?.total_amount_minor).toBeNull();
    }
  });
});
