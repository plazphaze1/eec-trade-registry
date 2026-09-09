# ADR 0039: Retry-safe money commands

Status: accepted
Date: 2026-09-08

## Context

The financial database functions already deduplicate commands by request UUID, but the staff and business server actions created a new UUID inside every invocation. A browser double submission or platform retry could therefore present the same logical instruction with different identifiers and post it twice. Transfers also locked the source account before the destination account, allowing opposing transfers to acquire the same pair in different orders.

The primary Bank movement forms were collapsed without a visible disclosure affordance, and the transfer form initially selected the same account at both ends.

## Decision

- Every staff and business money form receives one UUID when the form is rendered.
- That UUID is submitted as `request_id`, validated as a UUID at the server boundary, and passed unchanged to the authoritative database command.
- Money forms reject integers outside JavaScript's exact integer range before any database call.
- Balanced transactions lock both account rows in deterministic identifier order before validating or posting the movement.
- Serialization failures and deadlocks return a specific retry message; an invalid same-account transfer receives a specific correction message.
- The ordinary deposit/withdrawal form is expanded on arrival. Transfers require an explicit destination rather than selecting a rejected default.

## Consequences

A repeated submission of the same rendered form reaches Supabase with the same logical request identifier and returns the existing result instead of posting a duplicate. A new rendered form represents a new instruction and receives a new identifier. Database uniqueness remains the final authority; button state is not treated as a concurrency control.

Financial entries remain immutable, balanced, attributable, and derived through the existing functions. This decision changes no balance semantics and creates no client-side financial authority.
