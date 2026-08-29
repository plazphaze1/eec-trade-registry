# ADR 0026: Consumer-grade interface

- Status: accepted
- Date: 2026-08-29

## Context

ADR 0025 reduced the number of inputs in routine workflows, but the presentation still resembled an administrative registry. Small type, weak visual hierarchy, technical labels, dense outlined cards, and narrow work areas made ordinary tasks feel more difficult than the underlying commands. A person could technically complete a task without understanding the database, yet the interface still looked as though that understanding was expected.

The product owner requires the catalogue, licensing, ordering, stock, and material-buying surfaces to feel as familiar as a mainstream shopping application. This is an experience requirement, not permission to weaken authoritative validation, inventory history, or audit evidence.

## Decision

- Public navigation uses task language: **Shop**, **Check a license**, and **Get a trade license**.
- The public catalogue is a storefront. Search and category selection are prominent; product cards emphasize name, description, price, availability, and one **View item** action. Registry codes and controls visually recede.
- A new license application is presented as three numbered questions: identity, goods sold, and a one-sentence business description. Special authority remains available behind a clearly optional disclosure.
- Staff navigation names the task rather than the domain record: **Create an order**, **Buy from a player**, **Stock**, and **License requests**. Advanced records remain in Staff tools and direct authorized routes.
- Stock uses a searchable product grid with one quantity and one appropriate action per item. Ordinary intake opens directly on the selected card and asks only for quantity.
- Material purchasing presents setup in sequence. Missing buying prices are shown first; once configured, the purchase asks who sold, what they brought, and how many, with a live payment summary.
- Public, business, and staff surfaces share a responsive visual system with readable type, clear status color, large targets, consistent spacing, and strong primary actions. Desktop workspaces use available screen width instead of forcing routine work into a narrow central column.
- Technical references, immutable history, reservation details, policy records, and audit evidence remain accessible to authorized users but do not compete with the routine action.

## Consequences

- The experience layer may use friendlier labels while stable machine states, references, permissions, and authoritative commands remain unchanged.
- Simplification must never hide a required policy choice that the server cannot derive safely. Such a choice is presented only when it becomes relevant.
- CSS and component copy are part of the product contract and require responsive and keyboard-accessible verification.
- A surface that is technically complete but visually requires training to locate its primary action does not meet the definition of done.
