# ADR 0034: Banking corrections, reconciliation, and period close

## Status

Accepted

## Context

ADR 0033 established the authoritative fictional-currency bank, but routine operation also needs safe correction, overdue-loan servicing, balance comparison, and bookkeeping close controls. None may turn a balance into an editable field or erase the original transaction.

## Decision

- An authorized correction undoes only the latest unreversed invoice or loan payment. It posts the exact opposite of every original ledger entry and links the reversal to that transaction.
- Invoice correction recalculates the invoice status and amount paid. Loan correction appends negative allocation evidence and recalculates installment and loan status. Original payments and allocations remain immutable.
- An invoice or loan payment can be corrected once. Request identifiers make retries return the existing result.
- Overdue-loan review assesses the configured fixed late fee at most once for each eligible installment after its grace period. Every batch and fee is retained even when a batch finds nothing to charge.
- Reconciliation compares a stated account balance with the ledger-derived balance through a selected date. It records `matched` or the exact variance; it never posts money or changes the balance.
- Closing a completed date range captures every account balance through the end date and rejects later transactions backdated into that range. The current day cannot be closed. Reopening requires an Owner reason and preserves the close snapshot.
- These exceptional controls live under **Money → Controls**. Payment correction stays beside the affected invoice or loan so staff do not carry references between screens.

## Authorization

Bank reading still requires `finance.bank.read`. Payment correction requires `finance.transaction.reverse`. Late-fee assessment, reconciliation, close, and reopen require `finance.account.manage`. Owner holds these administrative capabilities; ordinary Agent work remains payment entry, invoicing, and permitted movement.

## Consequences

- Frozen or closed counterpart accounts do not prevent an exact correction because a reversal restores the original accounting evidence rather than authorizing new discretionary spending.
- A closed period must be reopened before its dates can receive an authorized correction.
- Partial refunds, negotiated fee waiver, recurring service charges, credit limits, foreign exchange, statement-file import, and bulk account administration remain separate future decisions.

## Scope

This applies only to in-server configured currencies. It is not real-world banking, payment processing, lending, or financial advice.
