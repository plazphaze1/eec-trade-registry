import Link from "next/link";

import { RelativeTime } from "@/components/relative-time";
import { StaffAccessDenied } from "@/components/staff-access-denied";
import { type IconName, UiIcon } from "@/components/ui-icon";
import { type CommandDashboard, getCommandDashboard } from "@/lib/command-dashboard";
import { requireStaffSession } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

type CounterGroup = CommandDashboard["orders"];
type AttentionItem = { description: string; href: string; icon: IconName; label: string; value: number };
type DashboardAction = { description: string; href: string; icon: IconName; label: string };

function value(group: CounterGroup, key: string) { return group[key] ?? 0; }

function QuickAction({ description, href, icon, label }: DashboardAction) {
  return (
    <Link className="dashboard-quick-action" href={href}>
      <span><UiIcon name={icon} size={22} /></span>
      <span><strong>{label}</strong><small>{description}</small></span>
      <UiIcon name="arrow" size={16} />
    </Link>
  );
}

export default async function DashboardPage() {
  const { client } = await requireStaffSession();
  const result = await getCommandDashboard(client);
  if (!result.ok && result.denied) return <main className="staff-main"><StaffAccessDenied /></main>;
  if (!result.ok) return <main className="staff-main"><section className="notice-panel"><h1>Today is unavailable</h1><p>The authoritative registry could not be reached. No fallback data is shown.</p></section></main>;

  const dashboard = result.data;
  const isOwner = dashboard.capabilities.can_manage_access;
  const attentionCandidates: AttentionItem[] = [
    { href: "/staff/access", icon: "people", label: "Discord access request", description: "An identity needs an Owner decision.", value: value(dashboard.access, "requests_pending") },
    { href: "/staff/applications", icon: "document", label: "license application", description: "An applicant is waiting for a decision.", value: value(dashboard.licensing, "applications_pending") },
    { href: "/staff/orders", icon: "clipboard", label: "order needing review", description: "Open it and continue from the order page.", value: value(dashboard.orders, "under_review") },
    { href: "/staff/orders", icon: "package", label: "order waiting for stock", description: "Demand is recorded and needs replenishment.", value: value(dashboard.orders, "awaiting_stock") },
    { href: "/staff/inventory", icon: "box", label: "critical reserve", description: "A material is below its configured safety level.", value: value(dashboard.inventory, "critical_reserves") },
    { href: "/staff/inventory", icon: "box", label: "expired stock hold", description: "Review the order before releasing or extending it.", value: value(dashboard.inventory, "expired_reservations") },
    { href: "/staff/money", icon: "coins", label: "payment outstanding", description: "A supplier purchase or settlement still needs evidence.", value: value(dashboard.finance, "procurement_payments_pending") + value(dashboard.finance, "settlements_pending") },
    { href: "/staff/compliance", icon: "shield", label: "compliance action", description: "A recorded action is waiting for review.", value: value(dashboard.compliance, "actions_pending") },
    { href: "/staff/integrations", icon: "external", label: "Sheet or Discord failure", description: "Business data is safe; its projection needs attention.", value: value(dashboard.integrations, "outbox_failed") + value(dashboard.integrations, "exports_failed") + value(dashboard.integrations, "deliveries_failed") },
  ];
  const attention = attentionCandidates.filter((item) => item.value > 0 && (!item.href.startsWith("/staff/access") || isOwner));
  const quickActions: DashboardAction[] = [
    { href: "/staff/orders/new", icon: "clipboard", label: "Record an order", description: "Choose the buyer, goods, and handoff." },
    { href: "/staff/activity", icon: "package", label: "Record activity", description: "Save a material purchase or counted stock total." },
    { href: "/staff/applications", icon: "license", label: "Review applications", description: "Approve, renew, or deny a license request." },
    { href: "/staff/money", icon: "coins", label: "Money", description: "See purchase spending, bills, and unpriced stock." },
  ];

  return (
    <main className="staff-main dashboard-main">
      <header className="dashboard-header">
        <div><p className="eyebrow">East Empire Company operations</p><h1>Today</h1><p>Start a routine task or handle the few records that actually need attention.</p></div>
      </header>
      <p className="dashboard-meta">Live from Supabase · refreshed <RelativeTime value={dashboard.generated_at} /></p>

      <section aria-labelledby="quick-actions-title" className="dashboard-quick-section">
        <div className="dashboard-section-heading"><div><p className="eyebrow">Everyday work</p><h2 id="quick-actions-title">What do you need to do?</h2></div></div>
        <div className="dashboard-quick-grid">{quickActions.map((action) => <QuickAction key={action.href} {...action} />)}</div>
      </section>

      <div className="dashboard-layout">
        <section className="dashboard-panel">
          <header className="dashboard-panel-header"><div><h2>Needs attention</h2><p>Only exceptions and decisions appear here.</p></div></header>
          {attention.length > 0 ? (
            <ul className="dashboard-attention-list">{attention.map((item) => (
              <li key={item.label}><Link className="dashboard-attention-item" href={item.href}><span><UiIcon name={item.icon} size={16} /></span><span><strong>{item.value} {item.label}{item.value === 1 ? "" : "s"}</strong><small>{item.description}</small></span><UiIcon name="arrow" size={15} /></Link></li>
            ))}</ul>
          ) : <div className="dashboard-clear-state"><UiIcon name="check" size={22} /><div><strong>Nothing needs immediate attention.</strong><p>You can start a new order or material purchase above.</p></div></div>}
        </section>

        <section className="dashboard-panel">
          <header className="dashboard-panel-header"><div><h2>Recent orders</h2><p>Open an order once and finish the work there.</p></div><Link href="/staff/orders">View all</Link></header>
          {dashboard.recent_orders.length > 0 ? <ul className="dashboard-activity-list">{dashboard.recent_orders.slice(0, 6).map((order) => (
            <li key={order.id}><Link className="dashboard-activity-item" href={`/staff/orders/${order.id}`}><span className="dashboard-activity-mark" /><span><strong>{order.customer}</strong><small>{order.status.replaceAll("_", " ")} · <RelativeTime value={order.submitted_at} /></small></span><UiIcon name="arrow" size={14} /></Link></li>
          ))}</ul> : <div className="dashboard-empty dashboard-empty-action"><p>No orders yet.</p><Link className="button button-primary button-compact" href="/staff/orders/new">Record the first order</Link></div>}
        </section>
      </div>

      {isOwner && <section className="dashboard-admin-strip" aria-labelledby="administration-title">
        <div><p className="eyebrow">Owner only</p><h2 id="administration-title">Administration</h2><p>Access, reusable setup, public copies, and system health.</p></div>
        <nav aria-label="Owner administration">
          <Link href="/staff/access"><UiIcon name="people" size={16} />Staff access</Link>
          <Link href="/staff/configuration"><UiIcon name="gear" size={16} />Company setup</Link>
          <Link href="/staff/integrations"><UiIcon name="external" size={16} />Sheets &amp; Discord</Link>
          <Link href="/staff/operations"><UiIcon name="heart" size={16} />System health</Link>
        </nav>
      </section>}
    </main>
  );
}
