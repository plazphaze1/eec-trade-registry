# ADR 0031: Contextual specialist tools and legacy-route retirement

- Status: accepted
- Date: 2026-09-01

## Context

ADR 0023 correctly removed specialist systems from primary navigation, but the collapsed dashboard panel still presented fourteen large destinations as a second application. It mixed routine records, duplicate queue-wide desks, owner administration, and genuinely exceptional custody or compliance work. The command palette repeated most of the same destinations before the operator typed anything.

Two old launch surfaces also survived after their replacements shipped: `/staff/launch` redirected to Today, while `/staff/buy` retained the superseded named-seller intake even though **Record activity** now records ordinary aggregate purchases without a seller.

The product owner requires the staff experience to remain understandable without learning the database domain. Specialist capabilities must remain secure and available, but their existence must not make routine work look unfinished or mandatory.

## Decision

- Today no longer contains a general Staff tools catalogue. It contains routine work, non-zero exceptions, recent orders, and—only for the Owner—a compact Administration strip.
- The Administration strip contains only cross-system owner tasks: staff access, reusable company setup, Sheets and Discord, and system health.
- The command palette initially suggests only common work. Specialist destinations appear only when the operator searches for the relevant task.
- Existing licenses are reached from **License requests** or the relevant **Business** record. Manual issuance remains an exception path, not a routine starting action.
- Stock holds, corrections, and movement evidence remain under **Stock & prices → Corrections & history**. Material thresholds and offer history remain an Owner-only searchable record.
- The queue-wide fulfillment desk is no longer advertised. An order page is the canonical place to make goods ready and complete handoff. The old route remains available for authorized reversal and exceptional history work.
- Special pricing, transfers, consignments, unique assets, documents, and compliance remain implemented and searchable by their plain-language task names. They do not appear as dashboard cards.
- `/staff/buy` now redirects to **Record activity → Bought materials**. Its unused named-seller page components are removed. Named-supplier evidence remains available only in the advanced material record where it is actually required.
- `/staff/launch` remains as a compatibility redirect for old bookmarks, but links and unused actions targeting the retired launch page are removed.
- Removing an entry point does not remove a database table, secure function, permission check, immutable history record, or audit evidence.

## Consequences

- A first-time Agent sees one application rather than a routine console plus an advanced console.
- The Owner retains a short, stable administration surface without receiving fourteen domain choices at once.
- Rare functions remain discoverable through search and contextual records, while redundant queues stop competing with object-centered work.
- Old bookmarks fail gracefully through redirects instead of reopening obsolete workflows.
- A future specialist link may be added to Today only when evidence shows it is a frequent cross-record task. Otherwise it belongs on the affected record or in search.
