import Link from "next/link";

import { DealerOrderShop } from "@/components/dealer-order-shop";
import { DealerAccessDenied } from "@/components/dealer-access-denied";
import { OrderNotice } from "@/components/order-notice";
import { requireDealerSession } from "@/lib/dealer-auth";
import { getDealerOrderReferenceData } from "@/lib/orders";

interface NewDealerOrderPageProps {
  searchParams: Promise<{ error?: string; notice?: string }>;
}

export default async function NewDealerOrderPage({
  searchParams,
}: NewDealerOrderPageProps) {
  const parameters = await searchParams;
  const { client } = await requireDealerSession();
  const result = await getDealerOrderReferenceData(client);
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
          <h1>The requisition form could not be loaded</h1>
          <p>No secondary catalogue was used.</p>
        </section>
      </main>
    );
  }

  const representations = result.data.representations;
  return (
    <main className="staff-editor-main dealer-main">
      <Link className="back-link" href="/dealer/orders">
        ← Back to orders
      </Link>
      <header className="staff-editor-header simple-task-header">
        <p className="eyebrow">Shop</p>
        <h1>New order</h1>
        <p>Choose goods, review your cart, and place the order. Your business account is handled automatically.</p>
      </header>

      <OrderNotice error={parameters.error} notice={parameters.notice} />

      {representations.length > 0 ? <DealerOrderShop data={result.data} /> : <section className="empty-state"><h2>This business cannot order yet</h2><p>Ask an EEC Owner to check the license and reset the business access code.</p></section>}
    </main>
  );
}
