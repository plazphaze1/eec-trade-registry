import type { Metadata } from "next";
import Link from "next/link";

import { UiIcon, type IconName } from "@/components/ui-icon";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "A plain-language guide to buying, business licensing, orders, stock, and selling materials through the East Empire Company.",
};

const starts: Array<{
  description: string;
  href: string;
  icon: IconName;
  title: string;
}> = [
  {
    description: "See both ways to buy and what happens after an order is placed.",
    href: "#buy",
    icon: "catalogue",
    title: "I want to buy",
  },
  {
    description: "Apply, receive access, and order for your customers.",
    href: "#business",
    icon: "building",
    title: "I run a business",
  },
  {
    description: "Sell player-produced materials into the Company reserve.",
    href: "#sell",
    icon: "coins",
    title: "I want to sell materials",
  },
];

const orderSteps = [
  ["1", "Order placed", "The business or EEC Agent selects the goods, amount, and collection or delivery."],
  ["2", "Agent review", "An EEC Agent checks the license, item rules, quantity, and price."],
  ["3", "Ready or waiting", "Available goods are held for the order. If stock is short, the order stays open until it arrives."],
  ["4", "Completed", "The goods are collected or delivered and the stock record updates automatically."],
] as const;

export default function HowItWorksPage() {
  return (
    <main className="how-main">
      <section className="hero how-hero">
        <div>
          <p className="eyebrow">New here? Start here</p>
          <h1>How EEC trade works.</h1>
          <p className="hero-copy">
            Browse without an account. Buy through a licensed business, ask an
            EEC Agent for a direct order, apply for a business license, or sell
            materials into the Company reserve.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/">
              <UiIcon name="catalogue" /> Shop the catalogue
            </Link>
            <Link className="button button-secondary" href="/apply">
              <UiIcon name="license" /> Apply for a license
            </Link>
          </div>
        </div>
      </section>

      <nav className="how-start-grid" aria-label="Choose what you want to do">
        {starts.map((start) => (
          <a href={start.href} key={start.href}>
            <span><UiIcon name={start.icon} size={22} /></span>
            <div>
              <strong>{start.title}</strong>
              <p>{start.description}</p>
            </div>
            <UiIcon name="arrow" />
          </a>
        ))}
      </nav>

      <section className="how-section" id="buy">
        <header className="how-section-heading">
          <div>
            <p className="eyebrow">Buying goods</p>
            <h2>Choose the route that fits you.</h2>
          </div>
          <p>You do not need a personal account for either route.</p>
        </header>

        <div className="how-path-grid">
          <article className="how-path-card is-primary">
            <span className="how-card-label">Normal route</span>
            <h3>Buy through a licensed business</h3>
            <p>
              Ask an EEC-licensed shop to order for you. The business receives
              its approved EEC terms and may add the commission or retail margin
              allowed by server policy.
            </p>
            <ol>
              <li>Find the goods in the public catalogue.</li>
              <li>Check the business and license numbers if you want proof.</li>
              <li>The business orders in its portal, or an EEC Agent enters the order for it.</li>
              <li>The business completes its separate sale with you.</li>
            </ol>
            <Link className="text-link" href="/verify">Check a business or license <UiIcon name="arrow" size={15} /></Link>
          </article>

          <article className="how-path-card">
            <span className="how-card-label">Personal route</span>
            <h3>Order directly from an EEC Agent</h3>
            <p>
              Contact an EEC Agent and tell them what you want. For goods that
              permit personal orders, the system applies the direct-purchase
              rules automatically.
            </p>
            <ul>
              <li>The direct price is automatically 3× the current EEC base price.</li>
              <li>Configured weekly personal limits are checked automatically.</li>
              <li>The Agent creates the order; you do not need a login.</li>
              <li>Items not enabled for direct sale still require a licensed business.</li>
            </ul>
          </article>
        </div>

        <div className="how-flow" aria-label="Order journey">
          {orderSteps.map(([number, title, description]) => (
            <article key={number}>
              <span>{number}</span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </article>
          ))}
        </div>

        <aside className="how-callout">
          <UiIcon name="package" size={24} />
          <div>
            <strong>Zero stock does not mean “cannot order.”</strong>
            <p>Orders can be recorded before stock arrives. They remain open and waiting instead of creating imaginary stock.</p>
          </div>
        </aside>
      </section>

      <section className="how-section" id="business">
        <header className="how-section-heading">
          <div>
            <p className="eyebrow">Business licensing</p>
            <h2>From application to first order.</h2>
          </div>
          <p>No email or Discord account is required.</p>
        </header>

        <div className="how-numbered-list">
          <article><span>1</span><div><h3>Apply</h3><p>Enter the business name, Discord contact name, trade categories, and a one-sentence description. Save the application reference and private status token.</p></div></article>
          <article><span>2</span><div><h3>Wait for review</h3><p>An EEC Agent reviews the request. Approval creates the official business and license records together.</p></div></article>
          <article><span>3</span><div><h3>Receive private access</h3><p>An Owner enables the Business portal and privately gives the business its LIC number and access code.</p></div></article>
          <article><span>4</span><div><h3>Shop and track orders</h3><p>Sign in with the LIC number and access code. Choose goods, quantity, collection or delivery, and follow every order from the Orders page.</p></div></article>
        </div>

        <div className="how-reference-grid">
          <article>
            <span>DLR</span>
            <div><h3>Business authorization number</h3><p>Answers: “Is this business recognized by the EEC?” It is public proof, not a password.</p></div>
          </article>
          <article>
            <span>LIC</span>
            <div><h3>Trade license number</h3><p>Answers: “What is this business allowed to trade?” It is also used with the private code to enter the Business portal.</p></div>
          </article>
        </div>

        <div className="how-actions">
          <Link className="button button-primary" href="/apply">Start an application</Link>
          <Link className="button button-secondary" href="/dealer/login">Business sign in</Link>
          <Link className="button button-secondary" href="/verify">Verify a record</Link>
        </div>
      </section>

      <section className="how-section" id="sell">
        <header className="how-section-heading">
          <div>
            <p className="eyebrow">Selling materials</p>
            <h2>Turn player production into real reserve stock.</h2>
          </div>
          <p>For configured materials such as ore, stone, leather, cloth, or firewood.</p>
        </header>

        <div className="how-numbered-list how-numbered-list-compact">
          <article><span>1</span><div><h3>Bring the material to an EEC Agent</h3><p>Tell the Agent which material you have and the quantity. A seller account or license is not required.</p></div></article>
          <article><span>2</span><div><h3>The Agent records the purchase</h3><p>They choose the material, amount, and date. No seller name is needed for routine bulk purchases.</p></div></article>
          <article><span>3</span><div><h3>Price and totals calculate automatically</h3><p>If a Company buying rate is saved, the site calculates the amount. Stock and the Money summary update from the same record.</p></div></article>
          <article><span>4</span><div><h3>The reserve becomes available to trade</h3><p>The accepted amount enters the real stock ledger. Player-sourced reserve goods are not created with a manual admin stock edit.</p></div></article>
        </div>

        <aside className="how-callout how-callout-money">
          <UiIcon name="coins" size={24} />
          <div>
            <strong>If no buying rate has been set</strong>
            <p>The stock can still be recorded, but the Money page marks the purchase as unpriced instead of inventing a payment amount.</p>
          </div>
        </aside>
      </section>

      <section className="how-section" id="access">
        <header className="how-section-heading">
          <div>
            <p className="eyebrow">Accounts and access</p>
            <h2>Only use the login meant for you.</h2>
          </div>
        </header>

        <div className="how-access-grid">
          <article><UiIcon name="people" size={22} /><h3>Public player</h3><strong>No login</strong><p>Browse, verify records, apply for a license, or ask an Agent for a personal order.</p></article>
          <article><UiIcon name="building" size={22} /><h3>Licensed business</h3><strong>LIC number + private code</strong><p>Shop, place orders, see order history, and manage eligible business activity.</p></article>
          <article><UiIcon name="shield" size={22} /><h3>EEC staff</h3><strong>Discord + Owner approval</strong><p>Discord confirms identity. Only the Owner&apos;s approval grants Agent access.</p></article>
        </div>
      </section>

      <section className="how-final-cta">
        <div><p className="eyebrow">Ready?</p><h2>Start with the catalogue.</h2><p>You can browse everything without creating an account.</p></div>
        <Link className="button button-primary" href="/">Shop now <UiIcon name="arrow" /></Link>
      </section>
    </main>
  );
}
