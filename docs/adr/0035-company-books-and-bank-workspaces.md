# ADR 0035: Separate Company books from customer banking

Status: Accepted

## Context

The first comprehensive money workspace put Company Treasury, sales invoices, supplier spending, customer accounts, transfers, loans, and accounting controls behind one tab. The records were authoritative, but the interface mixed two different jobs: operating the East Empire Company and operating its bank.

## Decision

- **Company books** is the EEC accounting workspace. It shows Treasury, sales invoices, supplier obligations, purchasing spend, the Company journal, cash infusions, reconciliation, and period close controls.
- **Bank** is the customer banking workspace. It shows business, personal, and escrow accounts, customer deposits and withdrawals, transfers, holds, statements, and loans.
- Both workspaces read and write the same balanced PostgreSQL ledger. They are task-oriented views, not separate sources of financial truth.
- A Company cash infusion is a balanced transfer from the hidden outside-world clearing account into the configured Company Treasury. It is neither sales revenue nor a customer bank deposit.
- The cash-infusion command derives the Treasury and clearing accounts from the configured currency. Staff enter only amount, occurrence date, and optional source/note.
- Company Treasury is excluded from the routine customer account register and ordinary Bank movement selectors.
- Cross-domain events remain linked. Paying a Company invoice from a customer bank account moves money between those exact accounts and updates the invoice in the same transaction.

## Consequences

Staff can understand where to work without learning the underlying ledger. Accounting remains complete and auditable, and the split cannot create conflicting balances because there is still only one authoritative financial ledger.
