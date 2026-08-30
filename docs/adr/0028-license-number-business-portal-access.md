# ADR 0028: License-number business portal access

Status: Accepted
Date: 2026-08-30

## Context

The business ordering portal exposed a representative email and password form. That contradicted the approved player experience: businesses should not need an email address, a Discord account, or an individually provisioned staff-style identity to place licensed orders. The visible “dealer” and “representative” terminology also made an ordinary business account appear more complicated than it is.

The license number is public verification data and therefore cannot be the secret by itself. Existing order, license, scope, audit, and revocation rules must continue to be enforced in PostgreSQL. A business login must also remain separate from the Discord-authenticated staff session so an Owner can use both surfaces in one browser.

## Decision

- Present the surface as the **Business portal**. “Dealer” remains an internal configurable relationship type and route name for compatibility; it is not the player-facing account label.
- A business signs in with its current `LIC` reference plus a private access code issued by an Owner. No email or Discord account is requested or displayed.
- Treat the license reference as an identifier, never a secret. Supabase Auth stores the access-code hash. PostgreSQL stores only the organization-to-auth-user binding, status, credential version, rotation time, and audit metadata.
- Create one organization account per party. The server uses a deterministic, non-routable internal Auth email solely because Supabase password authentication requires an Auth identifier. That value is never exposed to the business.
- Resolve a license number to its internal Auth identity only through a service-role-only function. It returns a result only while the license, dealer authorization, organization account, and dealer actor are all active.
- Use a dedicated business-session cookie so business sign-in cannot replace a staff Discord session.
- Let an Owner set, reset, or disable the access code from the business record. Each change is permission-checked, audited, versioned, and emitted to the outbox. Disabling the account blocks the actor and revokes its active representative grant so existing sessions fail closed.
- Continue using the existing scoped representative and order functions behind the simplified login. Authentication does not bypass license, catalogue, price, order, inventory, or compliance rules.

## Consequences

Businesses receive an Amazon-like two-field sign-in and can immediately use the existing shop and order history. Owners no longer need Supabase Studio or a manual representative-binding workflow. The organization credential is shared by the business, so the audit identifies the business account rather than an individual player. Individually attributable representatives or Discord-linked business identities may be added later as an optional stronger-control mode, not as a requirement for normal business ordering.

This decision supersedes the visible email/password enrollment described by ADRs 0004, 0005, and 0009. Their separation of authentication from database authority remains valid.
