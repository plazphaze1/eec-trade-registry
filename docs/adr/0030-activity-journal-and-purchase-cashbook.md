# ADR 0030: Activity journal and purchase cashbook

- Status: accepted
- Date: 2026-08-31

## Context

Routine stock intake still made staff think in supplier records, procurement offers, receiving locations, settlement evidence, and ledger commands. That evidence model is useful for a significant named supplier but is disproportionate when an Agent buys another ordinary load of iron from an incidental miner. Ordinary finished goods had the opposite problem: staff could add another quantity but could not simply record the total counted on the shelf.

The product owner requires one ordinary entry screen that asks what happened, which item, how much, and on which date. Seller identity and price must not be mandatory for aggregate player-material purchases. Known purchase money must be tabulated automatically, while an absent rate must remain visibly unknown rather than silently becoming zero. Supabase and the immutable inventory ledger remain authoritative.

## Decision

- Add **Record activity** as the ordinary intake surface.
- **Bought materials** records an aggregate purchase without creating or selecting a supplier. The database chooses the authorized warehouse location and posts a balanced receipt.
- If an effective guaranteed offer exists on the occurrence date, the command snapshots its unit price and calculated total. “Bought” means the known amount was paid at intake. If no offer exists, stock is still recorded and the purchase is explicitly `unpriced`; no monetary value is inferred.
- Named-supplier procurement remains available as an exceptional evidence path. Its accepted deliveries keep their pending/paid settlement workflow.
- **Set a stock total** is Owner-only and applies only to ordinary fungible goods whose policy permits administrative receipt. It calculates the difference from ledger-derived stock and posts a balanced reconciliation. It cannot be used for player-sourced-only or serialized goods, cannot create negative stock, and cannot reduce stock below active reservations.
- The selected business occurrence date may be today or earlier. It does not alter the exact database creation time or audit timestamp.
- Add **Money** as an operational purchase cashbook. It combines known paid aggregate purchases with named-supplier obligations and exposes unpriced purchase count separately. It is not described as a bank balance, sales ledger, or complete accounting system.
- `stock_activity_entries` is immutable provenance linked one-to-one to the inventory transaction. Corrections remain additive ledger evidence; calculated stock is never overwritten.

## Consequences

- A routine material purchase needs item, quantity, and date. Seller, offer, price, currency, warehouse, reference, and audit fields are derived or optional.
- A counted total feels like editing a total but remains an audited ledger delta internally.
- Money totals remain accurate within their stated scope: known procurement cash out and outstanding named-supplier obligations. Unpriced purchases are visible exceptions and are excluded from sums.
- Sales receipts, opening cash, transfers of funds, refunds, and a treasury balance remain separate future policy and cannot be inferred from orders alone.
- The existing supplier registry is not deleted. It is reserved for cases where named counterparty and settlement evidence matter.
