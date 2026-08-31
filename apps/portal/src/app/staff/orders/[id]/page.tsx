import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import {
  cancelStaffOrderAction,
  fulfillOrderReservationAction,
  prepareOrderLineAction,
  priceOrderLineAction,
  reserveOrderLineAction,
  reviewOrderLineAction,
} from "@/app/staff/orders/actions";
import { OrderNotice } from "@/components/order-notice";
import { StaffAccessDenied } from "@/components/staff-access-denied";
import { UiIcon } from "@/components/ui-icon";
import { getDefaultLocale } from "@/lib/env";
import { getStaffFulfillmentWorkspace } from "@/lib/fulfillment";
import { getStaffInventoryWorkspace } from "@/lib/inventory";
import { getStaffOrder } from "@/lib/orders";
import { requireStaffSession } from "@/lib/staff-auth";

interface StaffOrderDetailProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}

function label(value: string) {
  const labels: Record<string, string> = {
    approved: "Open",
    awaiting_stock: "Open · waiting for stock",
    cancelled: "Cancelled",
    denied: "Denied",
    fulfilled: "Completed",
    partially_fulfilled: "Open",
    processing: "Ready",
    reserved: "Ready",
    review_required: "Open",
    submitted: "Open",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function fulfillmentLabel(value: string) {
  if (value === "collection") return "Customer collection";
  if (value === "delivery") return "Delivery";
  if (value === "consignment") return "Consignment";
  return value.replaceAll("_", " ");
}

export default async function StaffOrderDetail({ params, searchParams }: StaffOrderDetailProps) {
  const [{ id }, parameters] = await Promise.all([params, searchParams]);
  if (!z.guid().safeParse(id).success) notFound();
  const { client } = await requireStaffSession();
  const [result, inventoryResult, fulfillmentResult] = await Promise.all([
    getStaffOrder(client, id),
    getStaffInventoryWorkspace(client),
    getStaffFulfillmentWorkspace(client),
  ]);
  if (!result.ok && result.code === "access_denied") {
    return <main className="staff-editor-main staff-main"><StaffAccessDenied /></main>;
  }
  if (!result.ok) {
    return <main className="staff-editor-main staff-main"><section className="notice-panel"><h1>Order unavailable</h1></section></main>;
  }
  if (!result.data) notFound();
  const order = result.data;
  const inventory = inventoryResult.ok ? inventoryResult.data : null;
  const fulfillment = fulfillmentResult.ok ? fulfillmentResult.data : null;
  const locale = getDefaultLocale();
  const terminal = ["cancelled", "denied", "fulfilled"].includes(order.status);
  const itemsNeedingAction = order.lines.filter((line) => line.status === "review_required").length;
  const placedAt = new Date(order.submitted_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <main className="staff-editor-main staff-main order-workspace">
      <Link className="back-link" href="/staff/orders">← Back to order queue</Link>
      <header className="staff-editor-header order-workspace-header">
        <div>
          <p className="eyebrow">Order {order.public_reference}</p>
          <h1>{order.ordering_party_name}</h1>
          <p>{placedAt} · {fulfillmentLabel(order.fulfillment_mode)} · {order.license_reference ? "Business pricing" : "Individual pricing"}</p>
        </div>
        <span className={`order-status order-status-${order.status}`}>{label(order.status)}</span>
      </header>

      <OrderNotice error={parameters.error} notice={parameters.notice} />

      <section className="order-detail-lines">
        <header className="order-items-heading"><div><h2>{order.lines.length} {order.lines.length === 1 ? "item" : "items"}</h2><p>{itemsNeedingAction ? `${itemsNeedingAction} waiting for you` : "No item needs an approval decision"}</p></div></header>
        {order.lines.map((line) => {
          const reservableLine = inventory?.order_lines.find((entry) => entry.id === line.id);
          const item = inventory?.items.find((entry) => entry.item_code === line.item_code) ?? null;
          const positions = item
            ? inventory?.positions.filter((position) => position.item_id === item.id && position.stock_state === "available" && position.available > 0) ?? []
            : [];
          const reservations = inventory?.reservations.filter((entry) => entry.order_line_id === line.id) ?? [];
          const activeReservation = reservations.find((entry) => entry.effective_status === "active");
          const readyReservation = fulfillment?.ready_reservations.find((entry) => entry.order_line_id === line.id);
          const completed = fulfillment?.fulfillments.filter((entry) => entry.order_reference === order.public_reference && entry.line_number === line.line_number && entry.status === "completed") ?? [];
          const reviewable = line.status === "review_required";
          const ordinary = !line.requires_staff_review && !line.requires_transaction_approval && !line.requires_serial_tracking;
          const approved = line.quantity_approved !== null;
          const reserved = reservations.some((entry) => ["active", "consumed"].includes(entry.effective_status));
          const fulfilled = line.status === "fulfilled" || line.quantity_fulfilled >= (line.quantity_approved ?? Number.POSITIVE_INFINITY);
          const ready = reserved || fulfilled;
          const remaining = reservableLine ? reservableLine.quantity_approved - reservableLine.quantity_fulfilled - reservableLine.quantity_reserved : 0;
          const readyPosition = positions.find((position) => position.available >= line.quantity_requested) ?? null;
          const readyQuantity = reservations.filter((entry) => entry.effective_status === "active").reduce((sum, entry) => sum + entry.quantity, 0);
          const lineState = fulfilled ? "Completed" : ready ? "Ready for handoff" : reviewable ? "Needs a decision" : line.status === "awaiting_stock" ? "Waiting for stock" : label(line.status);

          return (
            <article className="order-line-row" key={line.id}>
              <header className="order-line-row-header">
                <div>
                  <span className={`order-line-state order-line-state-${line.status}`}>{lineState}</span>
                  <h2>{line.item_name}</h2>
                  {(line.requires_serial_tracking || line.requires_staff_review) && <p>{line.requires_serial_tracking ? "Individually tracked good" : "Owner approval required"}</p>}
                </div>
                <strong>Qty {line.quantity_requested}</strong>
              </header>

              <div className="order-line-quick-facts"><span>{readyQuantity ? `${readyQuantity} ready` : "Nothing held yet"}</span><span>{line.unit_price_minor === null ? "Price not set" : `${line.unit_price_minor} ${order.currency_code} each`}</span></div>

              {!terminal && reviewable && ordinary && (
                <section className="order-next-action">
                  <div className="order-next-action-copy"><h3>{readyPosition ? "Hold available stock" : "Approve as a back-order"}</h3><p>{readyPosition ? "Approve this item and hold it for the customer." : "Approve it now and leave it open until stock arrives."}</p></div>
                  <form action={prepareOrderLineAction} className="order-guided-form is-compact">
                    <input name="order_id" type="hidden" value={order.id} />
                    <input name="order_line_id" type="hidden" value={line.id} />
                    <input name="expected_order_version" type="hidden" value={order.version} />
                    <input name="approved_quantity" type="hidden" value={line.quantity_requested} />
                    <input name="unit_price_minor" type="hidden" value={line.unit_price_minor ?? ""} />
                    <input name="inventory_account_id" type="hidden" value={readyPosition?.account_id ?? ""} />
                    <button className="button button-primary" type="submit"><UiIcon name={readyPosition ? "package" : "check"}/>{readyPosition ? "Hold stock" : "Approve back-order"}</button>
                  </form>
                </section>
              )}

              {!terminal && reviewable && !ordinary && (
                <section className="order-next-action">
                  <div className="order-next-action-copy"><p className="eyebrow">Next step</p><h3>{line.requires_staff_review ? "Review required" : "Approve this order"}</h3><p>{line.requires_staff_review ? "This item’s configured control requires an authorized decision." : "The customer, price, and item were checked when the order was entered."}</p></div>
                  <form action={reviewOrderLineAction} className="order-guided-form is-compact">
                    <input name="order_id" type="hidden" value={order.id} />
                    <input name="order_line_id" type="hidden" value={line.id} />
                    <input name="expected_order_version" type="hidden" value={order.version} />
                    <input name="decision" type="hidden" value="approve" />
                    <input name="approved_quantity" type="hidden" value={line.quantity_requested} />
                    <input name="reason" type="hidden" value="Order reviewed and approved by staff." />
                    <button className="button button-primary" type="submit"><UiIcon name="check"/>Approve order</button>
                  </form>
                  <details className="order-secondary-actions"><summary>Approve a different quantity, wait for stock, or deny</summary><form action={reviewOrderLineAction} className="staff-inline-action"><input name="order_id" type="hidden" value={order.id}/><input name="order_line_id" type="hidden" value={line.id}/><input name="expected_order_version" type="hidden" value={order.version}/><label className="field"><span>Decision</span><select defaultValue="awaiting_stock" name="decision"><option value="awaiting_stock">Approve and wait for stock</option><option value="approve">Approve a different quantity</option><option value="deny">Deny</option></select></label><label className="field"><span>Quantity</span><input defaultValue={line.quantity_requested} max={line.quantity_requested} min="0.001" name="approved_quantity" required step="0.001" type="number"/></label><label className="field"><span>Reason</span><input maxLength={500} minLength={1} name="reason" required/></label><button className="button button-secondary">Record decision</button></form></details>
                </section>
              )}

              {!terminal && !reviewable && reservableLine && !activeReservation && item?.inventory_mode === "fungible" && (
                <section className="order-next-action">
                  <div className="order-next-action-copy"><p className="eyebrow">Next step</p><h3>{positions.length ? "Reserve available stock" : "Stock is needed"}</h3><p>{positions.length ? "Choose a source only when more than one location can cover it." : "No assigned location currently has available stock. The approved order remains safely recorded."}</p></div>
                  {positions.length ? <form action={reserveOrderLineAction} className="order-guided-form">
                    <input name="order_id" type="hidden" value={order.id}/><input name="order_line_id" type="hidden" value={line.id}/>
                    {positions.length === 1 ? <><input name="inventory_account_id" type="hidden" value={positions[0].account_id}/><p className="derived-choice"><span>Source</span><strong>{positions[0].warehouse_name} · {positions[0].location_name}</strong><small>{positions[0].available} available</small></p></> : <label className="field"><span>Stock source</span><select name="inventory_account_id" required>{positions.map((position) => <option key={position.account_id} value={position.account_id}>{position.warehouse_name} · {position.location_name} · {position.available} available</option>)}</select></label>}
                    {positions.length === 1 ? <input name="quantity" type="hidden" value={Math.min(remaining, positions[0].available)}/> : <label className="field"><span>Quantity to make ready</span><input defaultValue={remaining} max={remaining} min="0.001" name="quantity" required step="0.001" type="number"/></label>}
                    <input name="reason" type="hidden" value="Available stock held for this customer order."/>
                    <button className="button button-primary"><UiIcon name="package"/>Make order ready</button>
                  </form> : <Link className="button button-secondary" href="/staff/inventory"><UiIcon name="box"/>Receive or inspect stock</Link>}
                </section>
              )}

              {!terminal && item?.inventory_mode === "serialized" && approved && !fulfilled && (
                <section className="order-next-action"><div className="order-next-action-copy"><p className="eyebrow">Next step</p><h3>Assign the unique asset</h3><p>Serialized goods require a named asset and custody record.</p></div><Link className="button button-primary" href="/staff/assets"><UiIcon name="key"/>Open matching assets</Link></section>
              )}

              {!terminal && readyReservation && (
                <section className="order-next-action">
                  <div className="order-next-action-copy"><h3>Complete the handoff</h3><p>{readyReservation.quantity} is ready at {readyReservation.warehouse_name} · {readyReservation.location_name}.</p></div>
                  <form action={fulfillOrderReservationAction} className="order-guided-form is-compact">
                    <input name="order_id" type="hidden" value={order.id}/><input name="reservation_id" type="hidden" value={readyReservation.id}/><input name="expected_version" type="hidden" value={readyReservation.version}/><input name="reason" type="hidden" value="Reserved goods handed to the recorded customer."/>
                    <button className="button button-primary"><UiIcon name="check"/>Confirm handoff</button>
                  </form>
                </section>
              )}

              {activeReservation && !readyReservation && <p className="order-action-note">Reservation {activeReservation.public_reference} is active. Your current assignment cannot post its handoff from this warehouse.</p>}
              {completed.map((entry) => <p className="order-completion-note" key={entry.id}><UiIcon name="check" size={15}/><span>Completed {new Date(entry.completed_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })} · Qty {entry.quantity}</span></p>)}

              {!reviewable && !terminal && line.status !== "fulfilled" && (
                <details className="order-secondary-actions"><summary>Edit recorded price</summary><form action={priceOrderLineAction} className="staff-inline-action"><input name="order_id" type="hidden" value={order.id}/><input name="order_line_id" type="hidden" value={line.id}/><input name="expected_order_version" type="hidden" value={order.version}/><label className="field"><span>Unit price; blank returns to pending</span><input defaultValue={line.unit_price_minor ?? ""} min="0" name="unit_price_minor" step="1" type="number"/></label><label className="field"><span>Reason</span><input defaultValue="Recorded order price updated." maxLength={500} minLength={1} name="reason" required/></label><button className="button button-secondary">Save price</button></form></details>
              )}
            </article>
          );
        })}
      </section>

      {!terminal && (
        <details className="staff-danger-zone order-cancel-zone">
          <summary>Cancel this order</summary>
          <div><p>Cancellation preserves the submitted request and every completed action.</p><form action={cancelStaffOrderAction} className="staff-status-form"><input name="order_id" type="hidden" value={order.id}/><input name="expected_version" type="hidden" value={order.version}/><label className="field"><span>Cancellation reason</span><textarea maxLength={500} minLength={1} name="reason" required rows={3}/></label><button className="button button-secondary" type="submit">Cancel order</button></form></div>
        </details>
      )}
    </main>
  );
}
