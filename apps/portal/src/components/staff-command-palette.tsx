"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { type IconName, UiIcon } from "@/components/ui-icon";

type Command = {
  description: string;
  href: string;
  icon: IconName;
  keywords: string;
  label: string;
  suggested?: boolean;
  ownerOnly?: boolean;
};

const commands: Command[] = [
  { href: "/staff/orders/new", icon: "spark", label: "Create an order", description: "Add goods to a customer order", keywords: "new customer cart", suggested: true },
  { href: "/staff/orders", icon: "clipboard", label: "Find an order", description: "See what is open, ready, or completed", keywords: "customer collect deliver", suggested: true },
  { href: "/staff/activity", icon: "package", label: "Record activity", description: "Save a purchase or counted stock total", keywords: "buy bought receive inventory quantity ore leather count", suggested: true },
  { href: "/staff/inventory", icon: "box", label: "Stock & prices", description: "Check stock or update normal prices", keywords: "inventory quantity procurement floor bulk price", suggested: true },
  { href: "/staff/money", icon: "coins", label: "Money", description: "See spending, unpaid purchases, and unpriced stock", keywords: "cashbook expenses bills payment finance", suggested: true },
  { href: "/staff/applications", icon: "license", label: "Review license requests", description: "Approve, renew, or decline a business application", keywords: "pending license renew application", suggested: true },
  { href: "/staff/dealers", icon: "building", label: "Find a business", description: "Open a licensed business record", keywords: "dealer organization shop customer", suggested: true },
  { href: "/staff", icon: "catalogue", label: "Find a product", description: "Open or edit a catalogue item", keywords: "product material catalogue" },
  { href: "/staff/configuration#quick-add-item", icon: "box", label: "Add a product", description: "Create and optionally publish a new good", keywords: "new product material catalogue" },
  { href: "/staff/economy?view=system", icon: "coins", label: "Reserve targets & history", description: "Inspect material thresholds and past buying rates", keywords: "procurement policy floor reserve", ownerOnly: true },
  { href: "/staff/pricing", icon: "coins", label: "Publish a price rule", description: "Bind a schedule to a business, class, region, or channel", keywords: "dealer pricing wholesale" },
  { href: "/staff/consignments", icon: "truck", label: "Open consignments", description: "Manage custody, reports, commission, and settlement", keywords: "consignment finance commission" },
  { href: "/staff/assets", icon: "key", label: "Open unique assets", description: "Manage serialized goods and ready handoffs", keywords: "unique custody reservation" },
  { href: "/staff/transfers", icon: "transfer", label: "Transfer warehouse stock", description: "Record custody moving between Company locations", keywords: "warehouse transit custody" },
  { href: "/staff/documents", icon: "document", label: "Open documents", description: "Generate or download official PDF snapshots", keywords: "certificate receipt pdf" },
  { href: "/staff/compliance", icon: "shield", label: "Open compliance cases", description: "Review investigations, findings, and appeals", keywords: "case action enforcement appeal" },
  { href: "/staff/integrations", icon: "external", label: "Sheets & Discord", description: "Check public copies and delivery failures", keywords: "google export bot projection", ownerOnly: true },
  { href: "/staff/access", icon: "people", label: "Approve staff access", description: "Review a Discord identity", keywords: "agent permissions role", ownerOnly: true },
  { href: "/staff/operations", icon: "heart", label: "Check system health", description: "Inspect authoritative services and workers", keywords: "status cron export", ownerOnly: true },
];

export function CommandPaletteButton({ compact = false }: { compact?: boolean }) {
  return (
    <button
      className={compact ? "command-palette-trigger is-compact" : "command-palette-trigger"}
      onClick={() => window.dispatchEvent(new Event("eec:open-command-palette"))}
      type="button"
    >
      <UiIcon name="search" size={16} />
      <span>Search or jump anywhere</span>
      <kbd>⌘ K</kbd>
    </button>
  );
}

export function StaffCommandPalette({ isOwner }: { isOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const available = useMemo(() => commands.filter((command) => !command.ownerOnly || isOwner), [isOwner]);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return available.filter((command) => command.suggested);
    return available.filter((command) => `${command.label} ${command.description} ${command.keywords}`.toLowerCase().includes(term));
  }, [available, query]);

  useEffect(() => {
    function openPalette() { setQuery(""); setOpen(true); }
    function keyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => {
          if (!current) setQuery("");
          return !current;
        });
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("eec:open-command-palette", openPalette);
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("eec:open-command-palette", openPalette);
      window.removeEventListener("keydown", keyboard);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;
  return (
    <div className="command-palette-backdrop" onMouseDown={() => setOpen(false)}>
      <section aria-label="Search or jump anywhere" aria-modal="true" className="command-palette" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <label className="command-palette-search">
          <UiIcon name="search" size={20} />
          <span className="sr-only">Search actions</span>
          <input onChange={(event) => setQuery(event.target.value)} placeholder="What do you need to do?" ref={inputRef} value={query} />
          <kbd>Esc</kbd>
        </label>
        <p className="command-palette-hint">{query.trim() ? "Matching actions and places" : "Common tasks"}</p>
        <div className="command-palette-results">
          {results.map((command) => (
            <Link href={command.href} key={command.href} onClick={() => setOpen(false)}>
              <span><UiIcon name={command.icon} size={18} /></span>
              <span><strong>{command.label}</strong><small>{command.description}</small></span>
              <UiIcon name="arrow" size={15} />
            </Link>
          ))}
          {!results.length && <p className="command-palette-empty">No match. Try “order”, “stock”, “license”, or “business”.</p>}
        </div>
      </section>
    </div>
  );
}
