# ADR 0037: Complete keystone-material baseline

Status: Accepted
Date: 2026-09-05

## Decision

The public baseline for the Company's player-sourced reserve consists of eight ordinary raw materials:

- Iron Ore
- Firewood
- Iron Ingot
- Corundum Ore
- Corundum Ingot
- Steel Ingot
- Leather
- Leather Strips

Existing stable references remain stable. The former public label **Leather Roll** is presented as **Leather** while its internal `RM-LEATHER-ROLL` code remains unchanged so existing orders, stock, and integrations do not lose their references.

All eight materials use `player_sourced_reserve`, require procurement evidence, disallow generic administrative receipts, and begin without prices or stock. Guaranteed buying rates are configured separately by staff; the catalogue does not invent them.

## Rationale

These materials form the economic floor for mining, smithing, leatherwork, construction, and ordinary production. Keeping them in the same catalogue makes the baseline visible to players and gives staff one consistent procurement and reserve workflow.

## Consequences

- The public catalogue gains five new baseline products and a clearer Leather label.
- Existing item references and ledger history remain valid.
- Staff must configure purchase offers before money is calculated for material buying.
- No material is considered physically available merely because its catalogue listing exists.
