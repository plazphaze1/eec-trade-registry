import Link from "next/link";

import { GuidedOrderForm } from "@/components/guided-order-form";
import { StaffAccessDenied } from "@/components/staff-access-denied";
import { getStaffInventoryWorkspace } from "@/lib/inventory";
import { getLaunchWorkspace } from "@/lib/launch-workspace";
import { requireStaffSession } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export default async function NewStaffOrderPage() {
  const { client } = await requireStaffSession();
  const [result, inventoryResult] = await Promise.all([
    getLaunchWorkspace(client),
    getStaffInventoryWorkspace(client),
  ]);
  if (!result.ok && result.denied) return <main className="staff-main"><StaffAccessDenied /></main>;
  if (!result.ok) return <main className="staff-main"><section className="notice-panel"><h1>Order intake unavailable</h1><p>No fallback business state was used.</p></section></main>;
  if (!result.data.capabilities.can_create_order) return <main className="staff-main"><StaffAccessDenied /></main>;
  const stock = inventoryResult.ok ? inventoryResult.data.positions.reduce<Record<string, { available: number; unit: string }>>((summary, position) => {
    if (position.stock_state !== "available") return summary;
    const current = summary[position.item_id] ?? { available: 0, unit: position.unit_code };
    summary[position.item_id] = { available: current.available + position.available, unit: position.unit_code };
    return summary;
  }, {}) : {};

  return (
    <main className="staff-main staff-order-intake-main">
      <header className="staff-page-header simple-task-header">
        <div>
          <p className="eyebrow">Shop</p>
          <h1>New order</h1>
          <p>Choose goods, review the cart, and place the order. The system handles everything else.</p>
        </div>
        <Link className="button button-secondary" href="/staff/orders">Back to orders</Link>
      </header>
      <GuidedOrderForm stock={stock} workspace={result.data} />
    </main>
  );
}
