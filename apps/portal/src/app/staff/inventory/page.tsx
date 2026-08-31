import Link from "next/link";

import {
  expireReservationAction,
  extendReservationAction,
  releaseReservationAction,
  reverseInventoryTransactionAction,
} from "@/app/staff/inventory/actions";
import { InventoryNotice } from "@/components/inventory-notice";
import { SimpleStockWorkspace } from "@/components/simple-stock-workspace";
import { StaffAccessDenied } from "@/components/staff-access-denied";
import { getStaffConfigurationWorkspace } from "@/lib/configuration";
import { getStaffEconomyWorkspace } from "@/lib/economy";
import { getDefaultLocale } from "@/lib/env";
import { getStaffInventoryWorkspace } from "@/lib/inventory";
import { REGISTRY_CONFIG } from "@/lib/registry-config";
import { getMyStaffAccessState } from "@/lib/staff-access";
import { requireStaffSession } from "@/lib/staff-auth";

interface StaffInventoryPageProps {
  searchParams: Promise<{ error?: string; notice?: string; view?: string }>;
}

function quantity(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

export default async function StaffInventoryPage({ searchParams }: StaffInventoryPageProps) {
  const parameters = await searchParams;
  const { client } = await requireStaffSession();
  const [result, access, configuration, economy] = await Promise.all([
    getStaffInventoryWorkspace(client),
    getMyStaffAccessState(client),
    getStaffConfigurationWorkspace(client),
    getStaffEconomyWorkspace(client),
  ]);
  if (!result.ok && result.code === "access_denied") {
    return <main className="staff-main"><StaffAccessDenied /></main>;
  }
  if (!result.ok) {
    return (
      <main className="staff-main">
        <section className="notice-panel">
          <h1>Inventory desk unavailable</h1>
          <p>No fallback balance was used and no authoritative data was changed.</p>
        </section>
      </main>
    );
  }

  const workspace = result.data;
  const locale = getDefaultLocale();
  const isOwner = access.ok && access.data.state === "authorized" && access.data.access_class === "owner";
  const showSystemRecords = isOwner && parameters.view === "system";
  const receivableIds = new Set(workspace.receipt_item_ids);
  const availableByItem = workspace.positions.reduce((balances, position) => {
    if (position.stock_state === "available") {
      balances.set(position.item_id, (balances.get(position.item_id) ?? 0) + position.available);
    }
    return balances;
  }, new Map<string, number>());
  const configurationData = configuration.ok ? configuration.data : null;
  const economyData = economy.ok ? economy.data : null;
  const publicSchedule = configurationData?.price_schedules.find((schedule) => schedule.audience_code === "public");
  const buyingCurrency = economyData?.currencies.find((currency) => currency.code === REGISTRY_CONFIG.currency.code)
    ?? economyData?.currencies[0];
  const currentOffers = economyData?.offers.filter((offer) => offer.is_current) ?? [];
  const stockItems = workspace.items.map((item) => {
    const configured = configurationData?.items.find((candidate) => candidate.id === item.id);
    const offer = currentOffers.find((candidate) => candidate.item_id === item.id);
    const procurementEnabled = economyData?.positions.some((position) => position.item_id === item.id && position.procurement_enabled) ?? false;
    const priceScheduleId = configured?.price_schedule_id ?? publicSchedule?.id ?? null;
    const published = configured?.publication_status === "published";
    return {
      action: receivableIds.has(item.id) ? "receipt" as const : item.inventory_mode === "serialized" ? "asset" as const : "purchase" as const,
      available: availableByItem.get(item.id) ?? 0,
      buyingPrice: procurementEnabled && buyingCurrency ? {
        amount: offer?.amount_minor ?? null,
        currencyCode: buyingCurrency.code,
        currencyId: buyingCurrency.id,
        offerId: offer?.id ?? null,
      } : null,
      id: item.id,
      name: item.display_name,
      salePrice: published && configured && priceScheduleId && configured.control_profile_code && configured.availability_profile_code ? {
        amount: configured.price_amount_minor,
        availabilityProfileCode: configured.availability_profile_code,
        bulkMinimum: configured.bulk_minimum,
        controlProfileCode: configured.control_profile_code,
        currencyCode: configured.currency_code ?? publicSchedule?.currency_code ?? REGISTRY_CONFIG.currency.code,
        orderIncrement: configured.order_increment ?? 1,
        priceScheduleId,
        publicDescription: configured.public_description ?? configured.description,
        publicName: configured.public_name ?? configured.display_name,
        requirementSummary: configured.requirement_summary ?? "Contact an authorized representative for current terms and availability.",
        canEdit: Boolean(configurationData?.capabilities.can_manage_pricing && configurationData.capabilities.can_manage_publication),
      } : null,
      unit: item.unit_code,
    };
  });
  stockItems.sort((left, right) => left.name.localeCompare(right.name));
  const locations = workspace.warehouses.flatMap((warehouse) => warehouse.locations);
  const defaultReceiptLocationId = locations.find((location) => location.location_type === "available")?.id
    ?? locations.find((location) => location.location_type === "receiving")?.id
    ?? null;
  const defaultPurchaseLocationId = economyData?.warehouses.flatMap((warehouse) => warehouse.locations)
    .find((location) => location.location_type === "receiving")?.id ?? null;
  const suppliers = economyData?.suppliers.filter((supplier) => supplier.status === "active")
    .map((supplier) => ({ id: supplier.id, name: supplier.display_name })) ?? [];
  const defaultSupplierPartyType = economyData?.party_types.find((type) => type.code === REGISTRY_CONFIG.procurement.defaultSupplierPartyTypeCode)
    ?? economyData?.party_types[0];
  const defaultSupplierSetup = economyData?.jurisdictions[0] && defaultSupplierPartyType ? {
    jurisdictionId: economyData.jurisdictions[0].id,
    partyTypeCode: defaultSupplierPartyType.code,
  } : null;

  return (
    <main className="staff-main">
      <header className="staff-page-header">
        <div>
          <p className="eyebrow">{showSystemRecords ? "Owner tools" : "Warehouse"}</p>
          <h1>{showSystemRecords ? "Stock records" : "Stock & prices"}</h1>
          <p>{showSystemRecords ? "Corrections and historical evidence for exceptional work." : "Search an item, add stock, or change its normal prices without leaving this page."}</p>
        </div>
        <div className="staff-button-row">
          {showSystemRecords
            ? <Link className="button button-secondary" href="/staff/inventory">Back to stock</Link>
            : <>{isOwner && <Link className="button button-secondary" href="/staff/inventory?view=system">Corrections &amp; history</Link>}<Link className="button button-primary" href="/staff/configuration">Add item</Link></>}
        </div>
      </header>

      <InventoryNotice error={parameters.error} notice={parameters.notice} />

      {!showSystemRecords && <SimpleStockWorkspace defaultPurchaseLocationId={defaultPurchaseLocationId} defaultReceiptLocationId={defaultReceiptLocationId} defaultSupplierSetup={defaultSupplierSetup} items={stockItems} suppliers={suppliers} />}

      {showSystemRecords && <div className="staff-tools-panel stock-tools-panel is-system-records"><div className="staff-tools-content">
      <section className="inventory-section embedded-inventory-section">
        <div className="inventory-section-heading"><div><p className="eyebrow">Time-bounded claims</p><h2>Reservations</h2></div><p>Elapsed claims stop reducing availability and must be finalized explicitly.</p></div>
        <div className="inventory-reservation-list">
          {workspace.reservations.map((reservation) => {
            const active = reservation.status === "active";
            const elapsed = reservation.effective_status === "elapsed";
            return <article className="inventory-reservation-card" key={reservation.id}>
              <header><div><span className={`order-status order-status-${reservation.effective_status}`}>{reservation.effective_status}</span><h3>{reservation.public_reference}</h3></div><strong>{quantity(reservation.quantity)}</strong></header>
              <p>{reservation.order_reference} · line {reservation.line_number} · {reservation.item_code}</p>
              <dl className="order-facts"><div><dt>Location</dt><dd>{reservation.warehouse_name} / {reservation.location_name}</dd></div><div><dt>Expires</dt><dd>{new Date(reservation.expires_at).toLocaleString(locale)}</dd></div><div><dt>Version</dt><dd>{reservation.version}</dd></div></dl>
              {active && <div className="inventory-reservation-actions">
                {!elapsed && <form action={extendReservationAction}><input name="reservation_id" type="hidden" value={reservation.id} /><input name="expected_version" type="hidden" value={reservation.version} /><label className="field"><span>New expiration (UTC)</span><input name="expires_at" required type="datetime-local" /></label><label className="field"><span>Reason</span><input maxLength={500} name="reason" required /></label><button className="button button-secondary" type="submit">Extend</button></form>}
                <form action={elapsed ? expireReservationAction : releaseReservationAction}><input name="reservation_id" type="hidden" value={reservation.id} /><input name="expected_version" type="hidden" value={reservation.version} /><label className="field"><span>Reason</span><input maxLength={500} name="reason" required /></label><button className="button button-secondary" type="submit">{elapsed ? "Finalize expiry" : "Release"}</button></form>
              </div>}
            </article>;
          })}
        </div>
        {workspace.reservations.length === 0 && <p className="empty-state">No reservation history yet.</p>}
      </section>

      <section className="inventory-section embedded-inventory-section">
        <div className="inventory-section-heading"><div><p className="eyebrow">Posted evidence</p><h2>Recent ledger transactions</h2></div><p>Corrections add a linked reversal; originals cannot be edited.</p></div>
        <div className="inventory-transaction-list">{workspace.transactions.map((transaction) => <article className="inventory-transaction-card" key={transaction.id}><div><span className="order-status">{transaction.transaction_type}</span><h3>{transaction.source_reference}</h3><p>{transaction.item_code} · {quantity(transaction.quantity_delta)} · {transaction.warehouse_name}</p><small>{new Date(transaction.posted_at).toLocaleString(locale)}</small></div>{transaction.transaction_type === "receipt" && !transaction.is_reversed && <form action={reverseInventoryTransactionAction}><input name="inventory_transaction_id" type="hidden" value={transaction.id} /><label className="field"><span>Correction reason</span><input maxLength={500} name="reason" required /></label><button className="button button-secondary" type="submit">Post reversal</button></form>}</article>)}</div>
      </section>
      </div></div>}
    </main>
  );
}
