import Link from "next/link";

import { OrderNotice } from "@/components/order-notice";
import { RelativeTime } from "@/components/relative-time";
import { StaffAccessDenied } from "@/components/staff-access-denied";
import { UiIcon } from "@/components/ui-icon";
import { getStaffOrders, type OrderRecord } from "@/lib/orders";
import { requireStaffSession } from "@/lib/staff-auth";

interface StaffOrdersPageProps {
  searchParams: Promise<{
    error?: string;
    notice?: string;
    q?: string;
    view?: string;
  }>;
}

type QueueView = "open" | "attention" | "waiting" | "ready" | "history";

const views: Array<{ key: QueueView; label: string }> = [
  { key: "open", label: "Open" },
  { key: "attention", label: "Needs action" },
  { key: "waiting", label: "Waiting" },
  { key: "ready", label: "Ready" },
  { key: "history", label: "History" },
];

function isTerminal(order: OrderRecord) {
  return ["cancelled", "denied", "fulfilled"].includes(order.status);
}

function queueStage(order: OrderRecord) {
  if (order.status === "fulfilled") {
    return { action: "View", label: "Completed", tone: "done" } as const;
  }
  if (["cancelled", "denied"].includes(order.status)) {
    return { action: "View", label: "Closed", tone: "closed" } as const;
  }

  const unpriced = order.lines.filter(
    (line) => line.unit_price_minor === null && !["denied", "fulfilled"].includes(line.status),
  ).length;
  if (unpriced > 0) {
    return {
      action: "Open",
      label: unpriced === 1 ? "Product price missing" : "Product prices missing",
      tone: "attention",
    } as const;
  }

  const decisions = order.lines.filter((line) => line.status === "review_required").length;
  if (decisions > 0) {
    return {
      action: "Review",
      label: `${decisions} ${decisions === 1 ? "item" : "items"} to approve`,
      tone: "attention",
    } as const;
  }

  const ready = order.lines.filter((line) => ["reserved", "processing"].includes(line.status)).length;
  if (ready > 0 || ["reserved", "processing"].includes(order.status)) {
    return { action: "Hand off", label: "Ready for customer", tone: "ready" } as const;
  }

  const waiting = order.lines.filter((line) => line.status === "awaiting_stock").length;
  if (waiting > 0 || order.status === "awaiting_stock") {
    return { action: "Check stock", label: "Waiting for stock", tone: "waiting" } as const;
  }

  return { action: "Continue", label: "Continue preparing", tone: "open" } as const;
}

function belongsToView(order: OrderRecord, view: QueueView) {
  const stage = queueStage(order);
  if (view === "history") return isTerminal(order);
  if (isTerminal(order)) return false;
  if (view === "open") return true;
  if (view === "attention") return stage.tone === "attention";
  if (view === "waiting") return stage.tone === "waiting";
  return stage.tone === "ready";
}

function itemsSummary(order: OrderRecord) {
  return order.lines
    .map((line) => `${line.quantity_requested} × ${line.item_name}`)
    .join(", ");
}

function viewHref(view: QueueView, search?: string) {
  const params = new URLSearchParams();
  if (view !== "open") params.set("view", view);
  if (search) params.set("q", search);
  const query = params.toString();
  return query ? `/staff/orders?${query}` : "/staff/orders";
}

export default async function StaffOrdersPage({ searchParams }: StaffOrdersPageProps) {
  const parameters = await searchParams;
  const search = parameters.q?.trim().slice(0, 100) || undefined;
  const selectedView = views.some((view) => view.key === parameters.view)
    ? parameters.view as QueueView
    : "open";
  const { client } = await requireStaffSession();
  const result = await getStaffOrders(client, search);
  if (!result.ok && result.code === "access_denied") {
    return <main className="staff-main"><StaffAccessDenied /></main>;
  }
  if (!result.ok) {
    return <main className="staff-main"><section className="notice-panel"><h1>Order queue unavailable</h1><p>No authoritative data was changed.</p></section></main>;
  }

  const counts = Object.fromEntries(
    views.map((view) => [view.key, result.data.filter((order) => belongsToView(order, view.key)).length]),
  ) as Record<QueueView, number>;
  const orders = result.data
    .filter((order) => belongsToView(order, selectedView))
    .sort((left, right) => Date.parse(left.submitted_at) - Date.parse(right.submitted_at));

  return (
    <main className="staff-main order-queue-page">
      <header className="staff-page-header order-queue-header">
        <div>
          <p className="eyebrow">Order queue</p>
          <h1>Orders</h1>
          <p>Start with the first row. Each order tells you the one thing it needs next.</p>
        </div>
        <Link className="button button-primary" href="/staff/orders/new"><UiIcon name="clipboard" />New order</Link>
      </header>

      <OrderNotice error={parameters.error} notice={parameters.notice} />

      <section className="order-queue-controls" aria-label="Order filters and search">
        <nav className="order-queue-tabs" aria-label="Order queue views">
          {views.map((view) => (
            <Link
              aria-current={selectedView === view.key ? "page" : undefined}
              href={viewHref(view.key, search)}
              key={view.key}
            >
              <span>{view.label}</span>
              <strong>{counts[view.key]}</strong>
            </Link>
          ))}
        </nav>
        <form className="order-queue-search" method="get" role="search">
          {selectedView !== "open" && <input name="view" type="hidden" value={selectedView} />}
          <UiIcon name="search" size={17} />
          <input
            aria-label="Find an order"
            defaultValue={search}
            maxLength={100}
            name="q"
            placeholder="Search buyer or order number"
            type="search"
          />
          <button className="button button-secondary" type="submit">Search</button>
          {search && <Link className="order-search-clear" href={viewHref(selectedView)}>Clear</Link>}
        </form>
      </section>

      <section className="order-queue-panel" aria-label={`${views.find((view) => view.key === selectedView)?.label} orders`}>
        <header>
          <div>
            <strong>{orders.length} {orders.length === 1 ? "order" : "orders"}</strong>
            <span>{selectedView === "history" ? "Completed and closed records" : "Oldest work appears first"}</span>
          </div>
          <span>Select a row to continue</span>
        </header>

        <div className="order-queue-list">
          {orders.map((order) => {
            const stage = queueStage(order);
            return (
              <Link
                className={`order-queue-row is-${stage.tone}`}
                href={`/staff/orders/${order.id}`}
                key={order.id}
                prefetch={false}
              >
                <span className="order-queue-state" aria-hidden="true" />
                <span className="order-queue-identity">
                  <strong>{order.ordering_party_name}</strong>
                  <small>{order.public_reference}</small>
                </span>
                <span className="order-queue-items">
                  <strong>{itemsSummary(order)}</strong>
                  <small>{order.lines.length} {order.lines.length === 1 ? "item" : "items"}</small>
                </span>
                <span className="order-queue-next">
                  <small>Next</small>
                  <strong>{stage.label}</strong>
                </span>
                <span className="order-queue-time"><RelativeTime value={order.submitted_at} /></span>
                <span className="order-queue-action">{stage.action}<UiIcon name="arrow" size={16} /></span>
              </Link>
            );
          })}
        </div>

        {orders.length === 0 && (
          <div className="order-queue-empty">
            <UiIcon name="check" size={22} />
            <div>
              <strong>{search ? "No matching orders" : "Nothing here needs work"}</strong>
              <span>{search ? "Try a buyer name or complete order number." : "Choose another tab or start a new order."}</span>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
