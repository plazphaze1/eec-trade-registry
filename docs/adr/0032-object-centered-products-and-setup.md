# ADR 0032: Object-centered Products and Company setup

- Status: accepted
- Date: 2026-09-01

## Context

The rapid-operations workspace introduced by ADR 0019 proved that catalogue, supply-policy, publication, and optional receipt records could be committed safely in one transaction. Its page later became a catch-all interface: product creation, ordinary receipt, reusable registry setup, and full public terms for every item appeared together. With only seven products it already required a long page and exposed warehouse locations, price schedules, control profiles, stable codes, and audit language before the owner could identify the intended task.

The same ordinary work was also available in **Products**, **Stock & prices**, and **Record activity**. Keeping all four interfaces made the system harder to understand without adding authority or safety.

## Decision

- **Products** is the only ordinary place to create or edit a product.
- New-product entry asks for name, optional description, category, unit, supply workflow, and whether it should appear publicly. Stable codes, slugs, and routine audit wording are generated. The existing atomic `staff_quick_create_item` command remains authoritative.
- Product details and public-shop presentation live on the product record. Advanced public ordering rules remain collapsed on that record. Normal selling and guaranteed buying prices remain in **Stock & prices**.
- Ordinary quantities are changed in **Stock & prices** or **Record activity**. The duplicate three-field receipt form and its server action are removed from Company setup. Ledger functions and posted history are unchanged.
- **Company setup** contains reusable choices only: categories, units, license types, endorsements, availability language, and control profiles.
- Company setup presents one type of reusable choice at a time. Stable configuration codes and routine audit wording are generated unless an owner deliberately opens advanced fields.
- The page includes short links back to Products, Stock & prices, and Record activity so an owner who chose the wrong destination can recover immediately.
- No schema, permission, RLS, audit, or ledger rule changes as part of this interface separation.

## Consequences

- A staff member no longer needs to understand “configuration” to add a product, publish it, add stock, or set a price.
- Company setup remains rare owner administration and scales with the number of reusable choices rather than the number of products.
- Every product has one obvious edit page, while stock and money continue to use their task-specific workspaces.
- The database retains its atomic onboarding command and immutable history even though the interface shows fewer inputs.
- Advanced control behavior remains available without competing with routine work.

## Superseded presentation

This decision supersedes ADR 0019 only where that record placed rapid item creation, ordinary receipt, and public terms on one **Configuration and quick operations** page. ADR 0019's transaction, permission, audit, idempotency, and ledger decisions remain accepted.
