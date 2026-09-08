# ADR 0038: Product-authoritative order pricing

Status: accepted
Date: 2026-09-08

## Context

The routine staff order screen exposed a unit-price field when an older order line did not contain a price snapshot. That made the order desk look like a second product-pricing system and allowed staff to type a value during order processing.

The intended simple workflow has one normal place to manage selling prices: **Stock & prices**. Orders should inherit the applicable effective product price and freeze that result for historical and financial use.

## Decision

- Effective product price rules are the only normal source of order prices.
- New lines continue to snapshot the applicable product rule at submission.
- An older active line without a snapshot may display the currently applicable product price to staff.
- When that older line is approved, Supabase re-resolves the effective product price inside the review transaction and records the full price provenance on the line.
- Caller-supplied order prices are ignored by the review command.
- The legacy authenticated order-price edit command is revoked.
- If no applicable product price exists, the order screen links directly to the product in **Stock & prices**. It never asks staff to price the order itself.
- Denying a line does not require a price.

## Consequences

Staff set a product price once and then process eligible orders without recalculation or duplicate entry. Existing frozen snapshots do not change when product prices change later. Price schedule, rule, channel multiplier, and currency provenance remain reconstructable from the order line and audit history.

Exceptional negotiated pricing remains a separate future override workflow with its own request and approval records; it must not reintroduce an editable ordinary order-price field.
