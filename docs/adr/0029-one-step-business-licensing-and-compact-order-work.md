# ADR 0029: One-step business licensing and compact order work

- Status: accepted
- Date: 2026-08-30

## Context

The public license form was already short, but staff approval still required leaving the application queue, manually creating a party and dealer authorization, returning to the request, selecting the new holder, and issuing the license. The records were correctly separate but the workflow made staff reproduce relationships the system could derive from the reviewed application and configured license class.

Order detail also repeated a status badge, three-step progress diagram, quantities, price, explanatory panel, and full-width next-action region for every line. Multi-item orders became several stacked mini-dashboards even when each item needed the same ordinary decision. Technical unit codes and duplicate “Open” labels competed with the actual task.

## Decision

- Keep applications, parties, dealer authorizations, licenses, and endorsements as distinct authoritative records.
- Add one restricted onboarding profile per license class. It selects the configured party type, dealer type, initial dealer status, and public-disclosure default for an approved new application.
- When a reviewer approves an ordinary new request without an existing holder, one database transaction locks the application, creates the configured business and current dealer authorization, issues the linked license and endorsements, records the decision and audit history, emits outbox work, and either commits everything or nothing.
- The ordinary review UI asks only for the meaningful decision: **Approve business** or decline with a reason. Holder selection, versions, status codes, start dates, and manual business creation move to exceptional tools. Renewal continues to require an explicit new expiration until duration policy is decided.
- Present order detail as one compact item work list. Each line shows its item, plain quantity, one human state, price, and the next permitted action. Remove repeated progress diagrams, technical unit codes, duplicated order-state badges, and explanatory registry chrome from the ordinary surface.
- Preserve every existing server-side permission, version, price, stock, reservation, ledger, and custody check. Presentation simplification never creates implied stock or authority.

## Consequences

- A normal new applicant and Owner experience one application and one approval instead of two disconnected onboarding workflows.
- A configured profile, not an item name or UI label, controls the created record types. A missing or invalid profile fails closed without partial records.
- The approval actor must have application-review, dealer-create, and license-issue authority because the coupled command rechecks each underlying operation.
- Manual party, dealer, and license tools remain available for imported records, non-public intake, and exceptional legal structures.
- Order pages remain object-centred and auditable while becoming substantially shorter and easier to scan on desktop and mobile.

## Unresolved policy

- Default license duration and renewal term
- Whether approval should also generate and reveal a one-time business portal access code
- Duplicate-name review or identity matching when separate applications appear to describe the same business
