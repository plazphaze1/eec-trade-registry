import Link from "next/link";

import { DealerAccessDenied } from "@/components/dealer-access-denied";
import { OrderNotice } from "@/components/order-notice";
import { requireDealerSession } from "@/lib/dealer-auth";
import { getDefaultLocale } from "@/lib/env";
import { getDealerOrders } from "@/lib/orders";

interface DealerOrdersPageProps {
  searchParams: Promise<{ error?: string; notice?: string }>;
}

export default async function DealerOrdersPage({ searchParams }: DealerOrdersPageProps) {
  const parameters = await searchParams;
  const { client } = await requireDealerSession();
  const result = await getDealerOrders(client);
  if (!result.ok && result.code === "access_denied") {
    return (
      <main className="dealer-main">
        <DealerAccessDenied />
      </main>
    );
  }
  if (!result.ok) {
    return (
      <main className="dealer-main">
        <section className="notice-panel">
          <p className="eyebrow">Order desk unavailable</p>
          <h1>Orders could not be loaded</h1>
          <p>No cached or external record was substituted.</p>
        </section>
      </main>
    );
  }

  const locale = getDefaultLocale();
  return (
    <main className="dealer-main">
      <header className="dealer-page-header">
        <div>
          <p className="eyebrow">Your purchases</p>
          <h1>Orders</h1>
          <p>See what is open, ready, or completed.</p>
        </div>
        <div className="staff-button-row">
          <Link className="button button-primary" href="/dealer/orders/new">
            Shop
          </Link>
        </div>
      </header>

      <OrderNotice error={parameters.error} notice={parameters.notice} />

      <div className="order-list">
        {result.data.map((order) => (
          <article className="order-card" key={order.id}>
            <header>
              <div>
                <span className={`order-status order-status-${order.status}`}>
                  {order.status === "fulfilled" ? "Completed" : order.status === "reserved" || order.status === "processing" ? "Ready" : "Open"}
                </span>
                <h2>{order.public_reference}</h2>
                <p>{order.ordering_party_name}</p>
              </div>
              <strong>{order.lines.length} line{order.lines.length === 1 ? "" : "s"}</strong>
            </header>
            <dl className="order-facts">
              <div>
                <dt>Submitted</dt>
                <dd>{new Date(order.submitted_at).toLocaleString(locale)}</dd>
              </div>
              <div>
                <dt>Getting it</dt>
                <dd>{order.fulfillment_mode === "delivery" ? "Delivery" : "Collection"}</dd>
              </div>
              <div>
                <dt>Pricing</dt>
                <dd>
                  {order.lines.some((line) => line.pricing_status === "pending")
                    ? "Being confirmed"
                    : `Configured in ${order.currency_code}`}
                </dd>
              </div>
            </dl>
            <Link className="button button-secondary" href={`/dealer/orders/${order.id}`}>
              View order
            </Link>
          </article>
        ))}
      </div>

      {result.data.length === 0 && (
        <section className="empty-state">
          <p className="eyebrow">No orders</p>
          <h2>Start the first order</h2>
          <p>Use Shop to place the first order.</p>
        </section>
      )}
    </main>
  );
}
