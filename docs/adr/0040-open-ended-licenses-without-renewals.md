# ADR 0040: Open-ended licenses without renewals

Status: accepted

## Decision

Ordinary Company business licenses do not expire on a routine schedule and do not have a renewal workflow. A license remains current until an authorized staff action suspends, revokes, or records the surrender of that authority.

The public site offers one licensing action: apply for a new business license. Staff approval creates the business, its dealer authorization, and its license in one transaction.

Existing renewal applications and renewal-event rows are retained as historical evidence. New renewal applications and renewal events are rejected by the database. Legacy pending renewal requests may only be declined; they cannot be approved.

Anonymous application submission and private-token status lookup run through secure server actions with scoped rate limits. Anonymous browser clients no longer receive direct execute access to the underlying database functions.

## Consequences

- Players no longer need to understand a separate renewal path or remember an expiration date.
- License validity is controlled by explicit standing changes, not a background expiry or grace-period policy.
- Old records remain auditable and are not deleted or rewritten.
- Any future proposal to reintroduce expiry must be a new policy decision with an explicit transition plan.

This decision supersedes the renewal portions of ADRs 0020, 0025, and 0029. Their other decisions remain in force.
