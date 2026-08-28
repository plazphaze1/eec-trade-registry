# ADR 0025: One-step intake and buying prices

- Status: accepted
- Date: 2026-08-28

## Context

The storefront work in ADR 0024 simplified ordering, but three common surfaces still exposed setup concepts instead of the task a person intended to complete. Public applicants selected license classes, regions, and every endorsement group at once. Stock omitted player-sourced materials because it reused the ordinary-receipt eligibility list. Material purchasing sent staff to a separate reserve-economy desk before the first guaranteed price could be used.

The product owner requires the public and ordinary staff flows to be understandable without training. The distinction between ordinary receipt, player-sourced procurement, effective-dated offers, reserve thresholds, and immutable ledger evidence remains important to the system but must not become a navigation problem for the user.

## Decision

- Public licensing uses ordinary links for **Get a new license** and **Renew a license**, so task selection works without client-side tab state.
- The configured standard business license class and fixed jurisdiction are derived for ordinary new applications. Applicants enter the business name, Discord name, trade categories, and a short description. Exceptional endorsements remain available under one clearly labeled optional disclosure.
- Application-status lookup is collapsed until requested. The receipt still shows the application reference and one-time private token because both are required by the secure public lookup.
- Stock lists every active inventory item, including zero-stock and player-sourced items. Each card shows one available quantity and the correct plain-language action: **Add stock**, **Buy from a player**, or **Open unique goods**.
- Ordinary stock receipt derives the configured available location and asks only for quantity. The secure receipt command still validates the item, location, staff scope, and ledger invariants.
- The Buy materials page owns routine guaranteed-price setup. Staff enter one positive whole-number amount per material. A new secure database command atomically retires any overlapping current offer and creates its replacement while preserving audit history and previously snapshotted purchases.
- If no supplier exists, material intake asks only for the seller name and derives the configured default supplier type and jurisdiction. Once setup exists, the ordinary purchase asks for seller, material, and quantity.
- `/staff/economy` redirects to the simple Buy materials page. Owner-only system records remain available at `/staff/economy?view=system`; they do not appear as a routine workflow.

## Consequences

- Normal users no longer need to understand license-class names, jurisdiction assignment, reserve thresholds, effective periods, minimum deliveries, audit reasons, warehouse locations, or offer records.
- Supabase remains authoritative. The simplified forms supply fewer user decisions, not fewer server validations.
- Retired procurement offers remain queryable evidence. Existing deliveries retain their snapshotted price and are not repriced.
- The configured default license class, jurisdiction, currency, supplier party type, and warehouse mode must remain explicit deployment configuration.
- Special applicants and advanced reserve-policy changes remain possible, but they are exceptions reviewed by staff rather than unavoidable questions for every player.
