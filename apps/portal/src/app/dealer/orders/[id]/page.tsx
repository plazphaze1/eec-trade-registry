import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { cancelDealerOrderAction } from "@/app/dealer/orders/actions";
import { DealerAccessDenied } from "@/components/dealer-access-denied";
import { OrderNotice } from "@/components/order-notice";
import { requireDealerSession } from "@/lib/dealer-auth";
import { getDefaultLocale } from "@/lib/env";
import { getDealerOrder } from "@/lib/orders";

interface DealerOrderDetailProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}

export default async function DealerOrderDetail({
  params,
  searchParams,
}: DealerOrderDetailProps) {
  const [{ id }, parameters] = await Promise.all([params, searchParams]);
  if (!z.guid().safeParse(id).success) notFound();

  const { client } = await requireDealerSession();
  const result = await getDealerOrder(client, id);
  if (!result.ok && result.code === "access_denied") {
    return (
      <main className="dealer-main">
        <DealerAccessDenied />
      </main>
    );
  }
  if (!result.ok) {
    return <main className="dealer-main"><section className="notice-panel"><h1>Order unavailable</h1></section></main>;
  }
  if (!result.data) notFound();
  const order = result.data;
  const locale = getDefaultLocale();

  return (
    <main className="staff-editor-main dealer-main">
      <Link className="back-link" href="/dealer/orders">← Back to orders</Link>
      <header className="staff-editor-header">
        <p className="eyebrow">{order.status === "fulfilled" ? "Completed" : order.status === "reserved" || order.status === "processing" ? "Ready" : "Open"}</p>
        <h1>{order.public_reference}</h1>
        <p>{order.ordering_party_name} · submitted {new Date(order.submitted_at).toLocaleString(locale)}</p>
      </header>

      <OrderNotice error={parameters.error} notice={parameters.notice} />

      <section className="order-detail-lines">
        {order.lines.map((line) => (
          <article className="order-line-card" key={line.id}>
            <header>
              <div>
                <span className={`order-status order-status-${line.status}`}>
                  {line.status === "fulfilled" ? "Completed" : line.status === "reserved" ? "Ready" : "Open"}
                </span>
                <h2>{line.item_name}</h2>
              </div>
              <strong>{line.quantity_requested} {line.unit_code}</strong>
            </header>
            <dl className="order-facts">
              <div><dt>Quantity</dt><dd>{line.quantity_approved ?? line.quantity_requested}</dd></div>
              <div><dt>Price each</dt><dd>{line.unit_price_minor === null ? "Being confirmed" : `${line.unit_price_minor} ${order.currency_code}`}</dd></div>
              <div><dt>Availability</dt><dd>{line.status.includes("awaiting_stock") ? "Waiting for stock" : line.status === "reserved" ? "Ready" : "Being prepared"}</dd></div>
            </dl>
          </article>
        ))}
      </section>

      {!['cancelled', 'denied', 'fulfilled'].includes(order.status) && (
        <section className="staff-danger-zone">
          <div>
            <p className="eyebrow">Need to stop?</p>
            <h2>Cancel order</h2>
            <p>Completed goods cannot be cancelled.</p>
          </div>
          <form action={cancelDealerOrderAction} className="staff-status-form">
            <input name="order_id" type="hidden" value={order.id} />
            <input name="expected_version" type="hidden" value={order.version} />
            <label className="field"><span>Why are you cancelling?</span><textarea maxLength={500} minLength={1} name="reason" required rows={3} /></label>
            <button className="button button-secondary" type="submit">Cancel order</button>
          </form>
        </section>
      )}
    </main>
  );
}
