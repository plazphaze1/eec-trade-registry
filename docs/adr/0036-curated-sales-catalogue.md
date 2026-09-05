# ADR 0036: Curated sales catalogue and outfit products

Status: Accepted

## Context

The catalogue foundation initially contained only a few economic materials and one garment. A broad game-item import would have produced thousands of duplicate, enchanted, craftable, quest, debug, and unsuitable records. It would also have exposed clothing components as a long list of nearly identical rows instead of products a player can understand and order.

The product owner requested a curated sales catalogue focused on unenchanted, non-quest clothing, armor, weapons, alchemy ingredients, food, and drinks. Forsworn, Vampire, Dawnguard, and Stormcloak merchandise, silver weapons, ores, pelts and hides, Dwemer salvage, quest-only reagents, vampire-specific provisions, and skooma were explicitly excluded from this import.

## Decision

- Clothing is presented and inventoried as complete outfit products. Visual alternatives are selectable styles of that product, not duplicate public rows.
- Outfit component and spawn references are stored in restricted internal fulfilment notes. They are not public authority, prices, or inventory balances.
- Armor pieces, weapons, ammunition, ingredients, foods, and drinks are separate products sold in individual units.
- All imported products receive short public sales descriptions and plain ordering language.
- No price is inferred from source-game value or third-party data. Staff set sale prices later through the existing effective-dated price command.
- Outfit, armor, and most weapon products are made to order. Consumables, ingredients, and ammunition use ordinary warehouse stock and may remain orderable while awaiting stock.
- A small reusable specialist control profile requires staff review for sensitive ceremonial, faction-associated, recovered, or bodily merchandise. The decision is configuration attached to products, not item-name logic.
- Source FormIDs are provenance and fulfilment aids only. DLC references retain the `xx` load-order placeholder rather than pretending a deployment-specific prefix is universal.
- The imported catalogue is limited to the base game and its three original add-ons. Anniversary Edition and Creation Club inventory remains a separate future curation decision.

## Consequences

The public catalogue gains 295 understandable products without becoming a raw console-command dump. Customers browse recognizable merchandise, clothing orders use one complete-set line, and staff retain the exact fulfilment reference without exposing it publicly. Inventory and prices remain authoritative database records, and adding the seed does not create stock, money, or a price.

The source review used the [Skyrim Commands item list](https://skyrimcommands.com/items) and the Elder Scrolls item tables for clothing, armor, weapons, ingredients, food, and beverages. Those sources provide identification data only; EEC publication, control, availability, stock, and price remain independently configured in Supabase.
