# East Empire Company Trade Registry — Operator Guide

This is the everyday guide for Owners and Agents. It explains what to do in the site without requiring knowledge of the database, ledger, price rules, or internal permission system.

## The four rules

1. Start routine work from **Today**.
2. Describe what happened; let the site choose the rules.
3. Finish an order from that order’s page.
4. For rare work, search for the task instead of browsing technical menus.

Supabase is the authoritative record. Google Sheets, Discord, and PDF documents copy approved information from it; editing those copies never changes the registry.

## Signing in

1. Open **Staff access** and choose **Continue with Discord**.
2. Discord proves which account you control. It does not grant EEC authority.
3. A first-time identity appears in the Owner’s access requests.
4. The Owner approves the person as an Agent, denies the request, or blocks it.
5. After approval, sign in again if the pending page does not refresh automatically.

There are only two staff roles:

- **Agent:** ordinary EEC work allowed by the assigned database permissions.
- **Owner:** all Agent work plus staff access, advanced policy, corrections, and system administration.

A business account is not a staff role. A public visitor has no staff access.

## Today

The Today page has four routine starting points:

- **Record an order**
- **Record activity**
- **Review applications**
- **Money**

Below them, **Needs attention** shows only real work: pending applications, orders awaiting review or stock, low reserves, unpaid purchases, access requests, or failed projections. Zero-value panels are omitted.

Recent orders open directly to the order page. You never need to copy an order reference between screens.

## Record an order

Open **New order**.

### Licensed business order

Example: Solitude Tailor orders a Nocturnal Dress for Aurelion Earandil.

1. Under **Ordering for**, choose **Solitude Tailor**.
2. Find **Nocturnal Dress** and select **Add to order**.
3. In the cart, change the quantity if needed and optionally enter **Aurelion Earandil** as the recipient.
4. Choose **Collect** or **Deliver**.
5. Select **Review order**, confirm the business price, and select **Place order**.

The site carries the active business authorization and license internally. Staff do not type a sales channel, license reference, dealer reference, price schedule, control level, warehouse, reservation, or audit reference.

### Direct individual order

1. Choose the returning individual under **Ordering for**, or choose **New individual**.
2. For a new person, enter the character name and optional Discord name.
3. Find the goods, select **Add to order**, and adjust the quantity in the cart.
4. Choose collection or delivery.
5. Select **Review order**.
6. Confirm the premium price and remaining weekly limit, then select **Place order**.

Direct pricing and personal limits are determined by Supabase. Staff cannot bypass them by selecting a different form path.

### Multiple items

Select **Add to order** on each product the same buyer wants. Use **Remove** in the cart for an unwanted product.

### Orders without stock

An order can be recorded when stock is unavailable. Recording demand does not create inventory. The order remains waiting until real stock is received or purchased.

### Consignment order

Open **Special order options** and select consignment only when the transaction is actually governed by an EEC consignment agreement. Ordinary wholesale resale is not consignment.

## Continue an order

Open **Orders**, search by customer or reference, and select **Open order**.

Each item shows a simple path:

`Ordered → Ready → Completed`

Only the next permitted action appears.

### Review

For an ordinary request, select **Make ready**. When stock can cover the order, this completes the routine approval and holds the goods in one interaction. When stock is unavailable, select **Mark waiting for stock**.

Restricted or unique goods may require an Owner or another specifically authorized Agent. The button is not permission; Supabase checks authority again on submission.

### Make ready

The site chooses the stock source. Agents do not select warehouse accounts or reservation records during ordinary work.

This creates an internal stock hold so two Agents cannot promise the same unit. Operators do not manage a separate reservation desk during ordinary work.

### Complete handoff

Select **Confirm handoff** only after the recorded goods physically leave EEC custody for the buyer or recipient. That action consumes the hold, posts the inventory movement, updates the order, and records history together.

Never confirm handoff merely because an admin intends to spawn or deliver an item later.

### Cancel or correct

Cancellation is at the bottom of the order page. It preserves history and releases eligible outstanding claims. Completed quantities are corrected through a linked reversal, not by editing or deleting the original transaction.

## Record player-supplied materials

Use **Record activity → Bought materials** when the Company buys naturally produced reserve materials from a miner, hunter, lumber worker, or other player.

1. Choose the material.
2. Enter the amount bought.
3. Confirm the date.
4. Select **Save purchase**.

No seller name is required for ordinary aggregate buying. If a buying rate was active on that date, Supabase applies it and updates **Money** automatically. If no rate existed, stock still updates and the entry is clearly marked **Unpriced**; the site never invents a price.

Set or change the normal Company buying rate directly in **Stock & prices**. Earlier purchases keep the rate recorded when they occurred. Named suppliers and separate payment evidence remain available only in the advanced material record for exceptional purchases that genuinely require counterparty evidence.

## Receive ordinary stock

Open **Stock & prices** for goods whose supply policy permits a normal receipt.

1. Find the item and select **Add stock**.
2. Enter the quantity physically received.
3. Select **Save**.

Every active catalogue item appears even when its quantity is zero. Player-sourced materials show **Buy from a player** so provenance and payment are captured. Unique goods show **Open unique goods** because each asset requires its own identity.

Each item shows **Available**, which already excludes goods held for existing orders. The number is calculated; staff never overwrite a current-stock cell.

Owners reach hold history, corrections, and movement evidence through **Stock & prices → Corrections & history**. These records are not part of ordinary stock intake.

## Businesses and licenses

Use **Businesses** to find a licensed business. Open it to see its current authorization, linked licenses, and Business portal access.

A license is separate from the business authorization. Both may be required for wholesale ordering. The license page records class, endorsements, dates, standing, conditions, and public verification reference.

Use **License requests** for public requests:

1. Open the pending application.
2. Read the applicant statement and requested endorsements.
3. Match or create the correct holder record.
4. Approve and issue, renew, request correction where supported, or deny.
5. Enter a reason for the decision.

A pending application is never a valid license. Approval must finish the issuance or renewal transaction.

The public form deliberately asks only for the business name, Discord contact, ordinary trade categories, and a short description. The standard class and region are configured automatically. Unusual bulk, consignment, controlled, or serialized authority is available under **special permissions** rather than confronting every applicant.

## Products

Use **Products** to find the goods and materials maintained by the Company. Select **Add item** for new ordinary configuration.

An item can exist without being public, without a price, and without stock. Blank pricing means unavailable or pending; it never means zero.

The item’s name does not control its rules. Supply workflow, public availability, license requirements, control profile, and inventory mode are configured records.

## Specialist work

There is no second dashboard of technical tools. The ordinary routes remain the right place to work:

- Open licenses from **License requests** or the relevant **Business**.
- Open stock corrections and movement history from **Stock & prices**.
- Finish routine stock handoff from the order itself; do not use a separate fulfillment queue.
- Press `Ctrl+K` or `⌘K` and search for **special pricing**, **transfer**, **consignment**, **unique asset**, **document**, or **compliance** only when that exact situation exists.

The Owner sees a short **Administration** row on Today:

- **Staff access** approves or blocks Discord identities.
- **Company setup** manages reusable categories, units, license types, endorsements, and other choices. It never contains product, stock, or pricing forms.
- **Sheets & Discord** opens the public Sheet and projection-delivery status.
- **System health** shows failures and access evidence.

These destinations do not grant permission. Supabase checks the current Owner or Agent authority again for every read and action.

## Google Sheets and Discord

The public Google Sheet is a one-way copy of approved Supabase records. **Sheets and Discord** shows its destination, latest successful generation time, and failures. Editing the Sheet does not update the site.

Discord staff sign-in proves identity only. Discord roles do not grant EEC permissions. Bot lookups and notifications read approved Supabase projections; reactions and message edits do not approve orders or licenses.

## Fixing mistakes

- Unsubmitted form mistake: correct the field normally.
- Wrong pending order: cancel it with a reason and enter the correct order.
- Wrong posted receipt or handoff: use an authorized linked reversal.
- Wrong price on an uncompleted order: open the order’s recorded-price section and supply the reason.
- Wrong public item information: update the catalogue item; historical orders keep their original snapshots.
- Unsure what happened: stop and ask the Owner before posting another transaction.

Never delete history, edit Google Sheets as a correction, invent stock, share another person’s account, or use Discord messages as proof that a secure action occurred.
