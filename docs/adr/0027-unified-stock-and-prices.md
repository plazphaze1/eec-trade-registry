# ADR 0027: Unified stock and prices workspace

- Status: accepted
- Date: 2026-08-30

## Context

ADRs 0024 through 0026 simplified the appearance of stock and material purchasing, but an ordinary operator still had to move among **Stock**, **Buy from a player**, and catalogue configuration to answer three questions about one item: how many are available, how more stock enters, and what the current normal prices are. The backend separation is required for inventory provenance and effective-dated prices; the navigation separation is not.

The product owner requires these routine changes to feel like maintaining one product in an ordinary commerce application.

## Decision

- The primary staff navigation exposes one **Stock & prices** workspace.
- Every active item card shows ledger-derived available stock, its current base selling price when published, and its guaranteed Company buying price when player procurement applies.
- **Manage** opens controls on that same card. It does not navigate to another setup desk.
- Ordinary warehouse-stocked goods ask only for received quantity and invoke the existing secured ledger receipt command.
- Player-sourced goods ask for seller and quantity and invoke the existing atomic procurement-delivery command. When prerequisites are missing, the same card first asks for the one missing buying price or seller name.
- Base selling price and Company buying price are separate, clearly labeled fields. Each continues to use its existing effective-dated authoritative command; changing either never rewrites historical orders, offers, deliveries, or ledger entries.
- Serialized goods continue to use the unique-asset workflow because a quantity receipt cannot safely represent individual custody.
- Advanced publication, schedule binding, reserve policy, correction, and history records remain available on their authorized system surfaces.

## Consequences

- The interface joins related tasks without merging their database models or permissions.
- A staff member can find an item, add routine stock, record a player purchase, or change a normal price without carrying an item reference between routes.
- Hidden form context remains an instruction only. Every server command re-resolves the authenticated actor, permissions, item, location, schedule, supplier, offer, and current state.
- The dedicated material-purchase route remains a supported deep workflow, but it is no longer required primary navigation.
