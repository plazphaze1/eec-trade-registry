# ADR 0024: Storefront workflows and dark system records

- Status: accepted
- Date: 2026-08-28

## Context

ADR 0023 reduced navigation but left ordinary work represented as compact database forms. Operators still selected goods from line-row dropdowns, performed a separate price-check ritual, read internal inventory states, and encountered reservations and ledger evidence on the normal stock page. Dealer self-service exposed authorization and license identifiers that the authenticated relationship already determined.

The product owner requires a stronger standard: an untrained player must be able to order goods and check stock through familiar shopping interactions without understanding EEC workflow terminology.

## Decision

- Ordering uses a searchable product grid, **Add to order** buttons, a cart, collection or delivery, an order review, and **Place order**.
- The selected account derives the commercial channel, license context, pricing, and limits. Dealer self-service derives its active business authorization and license instead of asking the representative to choose their database records.
- Exact staff-visible availability is shown on product cards. Zero stock never prevents recording demand; it is described as an orderable backorder.
- Ordinary order progress uses **Open**, **Ready**, **Completed**, and **Closed**. Restricted approval may add a plain-language **Needs approval** exception.
- The ordinary order page offers one next action. When stock can cover an ordinary line, **Make ready** performs the ordinary approval and stock-hold commands from one server interaction. If stock cannot cover it, the order remains open and waiting.
- The normal Stock page is a searchable product list. Each item shows one available quantity and, where permitted, an inline **Add stock** action. Warehouse, account, state, item-code, reservation-version, and ledger terminology are absent from this surface.
- Reservation history, expiry controls, reversals, and movement evidence are Owner-only system records reached from the advanced panel on Today. They are not a collapsed section on the ordinary Stock page.
- Routine success and error messages describe the player-visible outcome. Technical evidence remains in audit and domain records rather than success banners.

## Consequences

- The database model, immutable ledger, permissions, authoritative pricing, history, and outbox remain unchanged.
- A storefront can conceal complexity only when server functions continue to derive and revalidate authority. Hidden fields and browser state are never trusted as authorization.
- One-click preparation may invoke more than one existing secure command. If stock changes between commands, the approved order remains valid and returns to an actionable open state; no inventory is fabricated.
- Advanced tools remain available for correction and audit, but their existence does not define the ordinary mental model.
- Future ordinary workflow changes must pass the no-training test: a first-time user can identify the next action without reading the Operator Guide.
