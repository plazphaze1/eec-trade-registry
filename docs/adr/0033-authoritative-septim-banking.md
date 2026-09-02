# ADR 0033: Authoritative fictional-currency banking

- Status: accepted
- Date: 2026-09-02

## Context

ADR 0030 intentionally limited **Money** to a procurement cashbook because orders, customer payments, opening funds, transfers, and loans had no authoritative money workflow. That boundary made each individual number honest, but left the Company unable to reconcile sales, purchasing, business balances, and lending. The product owner has now explicitly expanded the platform to operate the server's fictional Septim banking system for a large population of player and business accounts.

This is in-server economic record keeping. It does not hold, transmit, exchange, or advise on real-world money and is not a real financial institution.

## Decision

- Supabase remains the only monetary authority. A balance is the signed sum of immutable entries; no account has an editable balance field.
- Every posted money transaction contains at least two entries whose signed amount sums to zero. Deposits and withdrawals use a hidden outside-world clearing account so the recorded boundary still balances.
- The normal account classes are Company Treasury, licensed business, personal, and escrow. Hidden clearing accounts are system records, not user funds.
- Activating a licensed-business portal creates its first business account for every active configured currency when one does not already exist.
- Orders become money only when staff issues an invoice from approved, priced order lines. The invoice freezes line descriptions, quantity, unit price, total, currency, issue date, and due date.
- Partial invoice payments are separate immutable transactions. Full paid status is derived and advanced only when the frozen total is satisfied.
- Paid aggregate material intake, paid named procurement, and paid consignment settlement automatically post Treasury expenditure. Unpriced intake remains a visible exception and never becomes zero-valued money.
- Transfers, deposits, withdrawals, holds, freezes, statements, reversals, invoices, loan products, loan disbursements, installment schedules, repayments, defaults, and write-offs use secured database functions with actor, request, audit, and outbox evidence.
- Loan disbursement moves principal from Treasury to the borrower account. Repayment moves funds back and allocates the amount to oldest fees, interest, then principal. The original terms and schedule remain preserved.
- Generic reversal is prohibited for invoice and loan payments because reversing only the money entries would corrupt their allocation state. Those domains require purpose-built refund or payment-correction commands before such corrections are exposed.
- Business representatives may see only accounts, invoices, loans, and statement entries for actively represented authorized organizations. They may spend only an owned active account and address a transfer recipient by exact account reference.
- Staff registers use server-side search and pagination. Routine overview payloads are bounded even when the deployment contains many accounts.

## Consequences

- Orders, procurement, consignment, and lending now affect the same Treasury and account ledger rather than unrelated page totals.
- An order alone is demand, not revenue. An invoice is a receivable, not cash. Only payment moves account balances.
- A stock receipt alone is not always expenditure. Money moves only when the coupled source explicitly records paid evidence or a separately authorized payment is posted.
- Account statements can be reconstructed without Discord, Sheets, or mutable running-total columns.
- Staff may freeze access or place a hold without rewriting ownership or history.
- Real-world payment rails, deposits, identity verification, legal banking, tax, payroll, securities, interest regulation, and currency conversion remain out of scope.

## Superseded boundary

This decision supersedes ADR 0030 only where it described **Money** as procurement-only and deferred opening cash, transfers, sales receipts, loans, and Treasury balance. ADR 0030's stock-activity, unpriced-purchase, immutable inventory, and aggregate-intake decisions remain accepted.
