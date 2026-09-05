-- Curated public merchandise approved by the product owner on 2026-09-05.
-- Clothing is sold as complete outfits. Armor, weapons, ingredients, food,
-- and drinks are distinct stock items. Prices intentionally remain unset.

insert into public.units_of_measure (code, display_name, symbol, quantity_scale)
values
  ('set', 'Set', 'set', 0),
  ('piece', 'Piece', 'piece', 0),
  ('serving', 'Serving', 'serving', 0),
  ('bottle', 'Bottle', 'bottle', 0),
  ('ingredient', 'Ingredient', 'ingredient', 0)
on conflict (code) do update set
  display_name = excluded.display_name,
  symbol = excluded.symbol,
  quantity_scale = excluded.quantity_scale,
  active = true;

insert into public.item_categories (code, display_name, description, sort_order)
values
  ('outfit-sets', 'Outfit sets', 'Complete civilian, professional, regional, and ceremonial outfits.', 60),
  ('armor', 'Armor', 'Individual pieces of non-standard armor and protective equipment.', 70),
  ('weapons', 'Weapons', 'Individual non-standard weapons and ammunition.', 80),
  ('alchemy-ingredients', 'Alchemy ingredients', 'Ingredients for apothecaries, alchemists, and specialist research.', 90),
  ('food', 'Food', 'Prepared meals, baked goods, raw produce, and kitchen provisions.', 100),
  ('drinks', 'Drinks', 'Ales, wines, meads, spirits, and regional bottled specialties.', 110)
on conflict (code) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  active = true;

insert into public.control_profiles (
  code, display_name, public_description,
  requires_staff_review, requires_transaction_approval, requires_serial_tracking
)
values (
  'regulated-alchemical', 'Specialist item',
  'This specialist item requires staff confirmation before an order can be approved.',
  true, false, false
)
on conflict (code) do update set
  display_name = excluded.display_name,
  public_description = excluded.public_description,
  requires_staff_review = excluded.requires_staff_review,
  requires_transaction_approval = excluded.requires_transaction_approval,
  requires_serial_tracking = excluded.requires_serial_tracking,
  active = true;

drop table if exists pg_temp.curated_catalogue_products;

create temporary table curated_catalogue_products (
  item_code text primary key,
  slug text not null unique,
  display_name text not null,
  description text not null,
  category_code text not null,
  unit_code text not null,
  supply_mode text not null,
  availability_code text not null,
  control_code text not null default 'ordinary-economic',
  requirement_summary text not null,
  internal_notes text not null
) on commit drop;

-- Complete outfits. Visual alternatives are choices within one product rather
-- than duplicate public catalogue rows.
insert into curated_catalogue_products values
  ('CL-BELTED-TUNIC-SET', 'belted-tunic-outfit', 'Belted Tunic Outfit', 'A practical everyday tunic and boots for work, travel, or ordinary town wear.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit. Note any preferred style when ordering.', 'Fulfilment FormIDs: Belted Tunic 0001BE1A; Boots 0001BE1B.'),
  ('CL-BLACKSMITH-SET', 'blacksmith-outfit', 'Blacksmith Outfit', 'A durable workshop outfit with a choice of red or pale smithing apron and sturdy footwear.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit. Choose the apron colour when ordering.', 'Fulfilment FormIDs: Blacksmith Aprons 0005B69F or 0006FF37; Shoes 0005B69E or 0005B6A0.'),
  ('CL-CHEF-SET', 'chef-outfit', 'Chef Outfit', 'A clean kitchen uniform with chef tunic, cap, and simple working shoes.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit.', 'Fulfilment FormIDs: Chef Tunic 0001BC82; Chef Hat 0001BCA7; Shoes 00018801.'),
  ('CL-COMMON-CLOTHES-SET', 'common-clothes-outfit', 'Common Clothes Outfit', 'Dependable daily clothing offered in a broad selection of cuts, colours, boots, and shoes.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit. Choose a preferred style when ordering.', 'Clothes FormIDs: 000F1229, 000209A6, 0006C1DA, 00017695, 0006C1D9, 0006C1D8, 0003452E, 000261C0, 0005B6A1, 0006FF38, 0004223C, 0006FF45. Common footwear may be matched by staff.'),
  ('CL-FINE-CLOTHES-SET', 'fine-clothes-outfit', 'Fine Clothes Outfit', 'Well-cut formal clothing for merchants, officials, receptions, and prosperous households.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit. Choose a preferred style when ordering.', 'Fulfilment FormIDs: Fine Clothes 000CEE80, 00086991, 000F8713, or 000F8715; Fine Boots 00086993 or 000CEE82; Fine Hat 000CEE84.'),
  ('CL-FINE-RAIMENT-SET', 'fine-raiment-outfit', 'Fine Raiment Outfit', 'A polished courtly ensemble suited to ceremonies, formal meetings, and high-status trade.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit.', 'Fulfilment FormIDs: Fine Raiment 000CEE76; Cuffed Boots 000CEE78.'),
  ('CL-FUR-TRIMMED-SET', 'fur-trimmed-formal-outfit', 'Fur-Trimmed Formal Outfit', 'A warm, imposing formal cloak with refined footwear and armguards for northern occasions.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit.', 'Fulfilment FormIDs: Fur-Trimmed Cloak 0008698C; Pleated Shoes 0008698E; Fine Armguards 00086990.'),
  ('CL-HAMMERFELL-SET', 'hammerfell-traveller-outfit', 'Hammerfell Traveller Outfit', 'A light desert travelling ensemble with garb, hood, and boots in the Hammerfell style.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit.', 'Fulfilment FormIDs: Hammerfell Garb 0007BC19; Alik''r Hood 0007BC1A; Redguard Boots 0007BC15.'),
  ('CL-MINER-SET', 'miner-outfit', 'Miner Outfit', 'Hard-wearing clothes and boots prepared for quarry, mine, and hauling work.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete work outfit.', 'Fulfilment FormIDs: Miner''s Clothes 00080697; Boots 00080699.'),
  ('CL-MOURNER-SET', 'mourner-outfit', 'Mourner Outfit', 'Restrained dark clothing and hat suitable for funerals, memorials, and formal mourning.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit.', 'Fulfilment FormIDs: Mourner''s Clothes 000646A7; Mourner''s Hat 000646AB; dark footwear matched by staff.'),
  ('CL-NOBLE-SET', 'noble-outfit', 'Noble Outfit', 'A richly appointed outfit for court appearances, diplomatic visits, and grand occasions.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit.', 'Fulfilment FormIDs: Noble Clothes 0005DB7B; Fur-Lined Boots 0005DB7E.'),
  ('CL-RADIANT-RAIMENT-SET', 'radiant-raiment-outfit', 'Radiant Raiment Outfit', 'A fashionable Solitude ensemble selected for buyers who want a distinctly refined finish.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit.', 'Fulfilment FormIDs: Radiant Raiment Fine Clothes 000E9EB5; Fine Boots 000CEE82.'),
  ('CL-RAGGED-SET', 'ragged-clothes-outfit', 'Ragged Clothes Outfit', 'A deliberately weathered collection of robes, trousers, cap, and worn footwear.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit.', 'Fulfilment FormIDs: Ragged Robes 00013105; Ragged Trousers 0008F19A; Ragged Cap 00013104; Ragged Boots 00013106; optional Footwraps 0003CA00.'),
  ('CL-ROUGHSPUN-SET', 'roughspun-outfit', 'Roughspun Outfit', 'A plain roughspun tunic and footwraps for labour, travel, or modest everyday dress.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit.', 'Fulfilment FormIDs: Roughspun Tunic 0003C9FE; Footwraps 0003CA00.'),
  ('CL-TAVERN-SET', 'tavern-outfit', 'Tavern Outfit', 'A recognizable tavern ensemble suited to hosts, servers, performers, and festive gatherings.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit.', 'Fulfilment FormIDs: Tavern Clothes 000D191F; Boots 000D1921.'),
  ('CL-COMMON-ROBES-SET', 'common-robes-outfit', 'Common Robes Outfit', 'Simple unenchanted robes available in black, blue, green, or red with matched footwear.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit. Choose a robe colour when ordering.', 'Fulfilment FormIDs: Black Robes 00106661; Blue Robes 000A199B; Green Robes 0010CFF0; Red Robes 0010CFF2; footwear matched by staff.'),
  ('CL-COLLEGE-ROBES-SET', 'college-robes-outfit', 'College Robes Outfit', 'Unenchanted academic robes with boots and a choice of plain mage hood.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit. Choose a hood style when ordering.', 'Fulfilment FormIDs: College Robes 000D3DEA; College Boots 0010E2CE or 0010E2DC; Mage Hoods 000D3DE8, 0010D6A6, or 0010D6A7.'),
  ('CL-MAGE-ROBES-SET', 'mage-robes-outfit', 'Mage Robes Outfit', 'Plain unenchanted robes, hood, and boots ready for a practitioner''s own use or enchantment.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit. These robes carry no enchantment.', 'Fulfilment FormIDs: Mage Robes 0006B46B; Boots 0006B46C; Mage Hoods 000D3DE8, 0010D6A6, or 0010D6A7.'),
  ('CL-MONK-ROBES-SET', 'monk-robes-outfit', 'Monk Robes Outfit', 'Modest unenchanted robes and footwear for religious, scholarly, or contemplative service.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit.', 'Fulfilment FormIDs: Monk Robes 000BACF3; Boots 000BACD7.'),
  ('CL-HOODED-BLACK-SET', 'hooded-black-robes-outfit', 'Hooded Black Robes Outfit', 'A complete set of plain black hooded robes with no magical enchantment.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit. These robes carry no enchantment.', 'Fulfilment FormID: Hooded Black Robes 00107108; dark footwear matched by staff.'),
  ('CL-HOODED-MONK-SET', 'hooded-monk-robes-outfit', 'Hooded Monk Robes Outfit', 'A complete hooded monastic outfit intended for travel, service, or quiet study.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit.', 'Fulfilment FormID: Hooded Monk Robes 00107106; footwear matched by staff.'),
  ('CL-VAERMINA-SET', 'vaermina-robes-outfit', 'Vaermina Robes Outfit', 'Distinctive dark ceremonial robes offered without an enchantment.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold as one complete specialist outfit; staff approval is required.', 'Fulfilment FormID: Vaermina Robes 000E739B; dark footwear matched by staff.'),
  ('CL-REDGUARD-SET', 'redguard-formal-outfit', 'Redguard Formal Outfit', 'A richly coloured Redguard ensemble with matching hood and boots.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit.', 'Fulfilment FormIDs: Redguard Clothes 000E0DD0; Redguard Hood 000E0DD2; Boots 000E0DD4.'),
  ('CL-DUNMER-SET', 'dunmer-outfit', 'Dunmer Outfit', 'A complete Solstheim outfit offered in six regional styles with matching shoes.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit. Choose a preferred style when ordering.', 'Dragonborn FormIDs: Outfits xx03706A, xx01CDAA, xx037065, xx037066, xx03706B, or xx03706C; Dunmer Shoes xx03705A.'),
  ('CL-CULTIST-SET', 'cultist-outfit', 'Cultist Outfit', 'A complete masked ceremonial outfit with robes, gloves, and boots, supplied without enchantment.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold as one complete specialist outfit; staff approval is required.', 'Dragonborn FormIDs: Robes xx01CDA6 or xx037B8A; Mask xx037B88; Boots xx037B8E; Gloves xx037B8C.'),
  ('CL-SKAAL-SET', 'skaal-outfit', 'Skaal Outfit', 'A warm northern outfit with coat, hat, gloves, and boots for severe weather and long travel.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit. The villager style may be requested.', 'Dragonborn FormIDs: Coat xx03910E; Hat xx039114; Gloves xx039110; Boots xx039112; Villager Outfit xx01CDA9.'),
  ('CL-TEMPLE-PRIEST-SET', 'temple-priest-outfit', 'Temple Priest Outfit', 'A complete ceremonial priestly ensemble with robes, hood, and boots.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold as one complete outfit.', 'Dragonborn FormIDs: Robes xx01CDAB; Hood xx03B04E; Boots xx03B04B.'),
  ('CL-EXECUTIONER-SET', 'executioner-outfit', 'Executioner Outfit', 'A severe hooded uniform with robes, gloves, and boots for official ceremonial use.', 'outfit-sets', 'set', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold as one complete specialist outfit; staff approval is required.', 'Fulfilment FormIDs: Executioner''s Hood 000CF8B2; Robes 000CF8B3; Gloves 000CF8B1; Boots 000CF8B0.');

-- Armor pieces are individually purchasable. Variant FormIDs remain choices
-- within a single product where the game uses the same display name.
insert into curated_catalogue_products values
  ('AR-FUR-ARMOR', 'fur-armor', 'Fur Armor', 'Light wilderness armor offered in four cuts for scouts, hunters, and cold-weather travel.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold individually. Choose a preferred cut when ordering.', 'Fulfilment FormIDs: 0006F393, 0010594B, 0010594D, 0010594F.'),
  ('AR-FUR-BOOTS', 'fur-armor-boots', 'Fur Boots', 'Warm, flexible boots suited to light armor and rough northern ground.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold individually.', 'Fulfilment FormID: 000A6D7F.'),
  ('AR-FUR-BRACERS', 'fur-bracers', 'Fur Bracers', 'Simple protective bracers for a lightweight wilderness kit.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold individually.', 'Fulfilment FormID: 0006F39B.'),
  ('AR-FUR-GAUNTLETS', 'fur-gauntlets', 'Fur Gauntlets', 'Insulated light gauntlets for cold-weather work and combat.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold individually.', 'Fulfilment FormID: 000A6D7D.'),
  ('AR-FUR-HELMET', 'fur-helmet', 'Fur Helmet', 'A warm light helmet for hunters, travellers, and northern patrols.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold individually.', 'Fulfilment FormID: 0006F39E.'),
  ('AR-FALMER-ARMOR', 'falmer-armor', 'Falmer Armor', 'Unusual chitinous body armor recovered in serviceable condition for specialist buyers.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 000B83CB.'),
  ('AR-FALMER-BOOTS', 'falmer-boots', 'Falmer Boots', 'Chitinous Falmer footwear prepared as an individual armor piece.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 000B83CD.'),
  ('AR-FALMER-GAUNTLETS', 'falmer-gauntlets', 'Falmer Gauntlets', 'Unusual Falmer hand protection for collectors and specialist armorers.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 000B83CF.'),
  ('AR-FALMER-HELMET', 'falmer-helmet', 'Falmer Helmet', 'A distinctive enclosed Falmer helm supplied as an individual piece.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0004C3CB.'),
  ('AR-FALMER-SHIELD', 'falmer-shield', 'Falmer Shield', 'A broad chitinous shield intended for specialist martial use or display.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0005C06C.'),
  ('AR-FALMER-HARDENED-ARMOR', 'falmer-hardened-armor', 'Falmer Hardened Armor', 'Reinforced Falmer body armor offering a heavier specialist defensive option.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Dawnguard-content FormID: xx00E8DE.'),
  ('AR-FALMER-HARDENED-BOOTS', 'falmer-hardened-boots', 'Falmer Hardened Boots', 'Reinforced Falmer boots matched to hardened body armor.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Dawnguard-content FormID: xx00E8DD.'),
  ('AR-FALMER-HARDENED-GAUNTLETS', 'falmer-hardened-gauntlets', 'Falmer Hardened Gauntlets', 'Reinforced Falmer gauntlets for a hardened armor configuration.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Dawnguard-content FormID: xx00E8DF.'),
  ('AR-FALMER-HARDENED-HELM', 'falmer-hardened-helm', 'Falmer Hardened Helm', 'A reinforced Falmer helm for specialist heavy protection.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Dawnguard-content FormID: xx00E8E0.'),
  ('AR-FALMER-HEAVY-ARMOR', 'falmer-heavy-armor', 'Falmer Heavy Armor', 'Massive chitinous body armor built for maximum protection and an unmistakable profile.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Dawnguard-content FormID: xx0023E9.'),
  ('AR-FALMER-HEAVY-BOOTS', 'falmer-heavy-boots', 'Falmer Heavy Boots', 'Heavy Falmer boots prepared for a full specialist armor kit.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Dawnguard-content FormID: xx0023EF.'),
  ('AR-FALMER-HEAVY-GAUNTLETS', 'falmer-heavy-gauntlets', 'Falmer Heavy Gauntlets', 'Heavy chitinous gauntlets offering substantial hand and forearm protection.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Dawnguard-content FormID: xx0023ED.'),
  ('AR-FALMER-HEAVY-HELM', 'falmer-heavy-helm', 'Falmer Heavy Helm', 'An imposing heavy Falmer helm for specialist martial buyers.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Dawnguard-content FormID: xx0023EB.'),
  ('AR-MORAG-TONG-ARMOR', 'morag-tong-armor', 'Morag Tong Armor', 'Distinctive light body armor from Solstheim, suited to discreet and mobile work.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Dragonborn FormID: xx0292AC.'),
  ('AR-MORAG-TONG-BOOTS', 'morag-tong-boots', 'Morag Tong Boots', 'Light Solstheim boots matched to Morag Tong armor.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Dragonborn FormID: xx0292AB.'),
  ('AR-MORAG-TONG-BRACERS', 'morag-tong-bracers', 'Morag Tong Bracers', 'Low-profile bracers designed for a mobile Solstheim armor kit.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Dragonborn FormID: xx0292AD.'),
  ('AR-MORAG-TONG-HOOD', 'morag-tong-hood', 'Morag Tong Hood', 'A close-fitting hood completing the Morag Tong armor profile.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Dragonborn FormID: xx0292AE.'),
  ('AR-PENITUS-ARMOR', 'penitus-oculatus-armor', 'Penitus Oculatus Armor', 'A disciplined Imperial light cuirass with a formal military finish.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 000D3EA0.'),
  ('AR-PENITUS-BOOTS', 'penitus-oculatus-boots', 'Penitus Oculatus Boots', 'Military light boots matched to the Penitus Oculatus uniform.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 000D3EA7.'),
  ('AR-PENITUS-BRACERS', 'penitus-oculatus-bracers', 'Penitus Oculatus Bracers', 'Compact Imperial bracers for a complete Penitus Oculatus kit.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 000D3EAB.'),
  ('AR-PENITUS-HELMET', 'penitus-oculatus-helmet', 'Penitus Oculatus Helmet', 'A crested Imperial helmet associated with elite protective service.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 000D3EAA.'),
  ('AR-BLADES-ARMOR', 'blades-armor', 'Blades Armor', 'Lamellar-style heavy body armor with an Akaviri martial character.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0004B28B.'),
  ('AR-BLADES-BOOTS', 'blades-boots', 'Blades Boots', 'Heavy boots matched to Blades lamellar armor.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0004B288.'),
  ('AR-BLADES-GAUNTLETS', 'blades-gauntlets', 'Blades Gauntlets', 'Heavy segmented gauntlets completing a Blades armor kit.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0004B28D.'),
  ('AR-BLADES-HELMET', 'blades-helmet', 'Blades Helmet', 'A distinctive heavy helmet with an Akaviri-inspired silhouette.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0004B28F.'),
  ('AR-BLADES-SHIELD', 'blades-shield', 'Blades Shield', 'A strong round shield designed to accompany Blades armor and sword work.', 'armor', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0004F912.');

-- Individual weapons and ammunition.
insert into curated_catalogue_products values
  ('WP-LONG-BOW', 'long-bow', 'Long Bow', 'A straightforward light bow for hunting, training, and inexpensive field use.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold individually.', 'Fulfilment FormID: 0003B562.'),
  ('WP-HUNTING-BOW', 'hunting-bow', 'Hunting Bow', 'A reliable hunting bow with balanced draw weight for game and general defence.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold individually.', 'Preferred generic FormID: 00013985.'),
  ('WP-IMPERIAL-BOW', 'imperial-bow', 'Imperial Bow', 'A disciplined military-pattern bow suited to guards, patrols, and trained archers.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold individually.', 'Fulfilment FormID: 00013841.'),
  ('WP-IMPERIAL-SWORD', 'imperial-sword', 'Imperial Sword', 'A practical leaf-bladed military sword intended for dependable close combat.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold individually.', 'Fulfilment FormID: 000135B8.'),
  ('WP-SCIMITAR', 'scimitar', 'Scimitar', 'A fast, curved Redguard blade with an elegant profile and excellent handling.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold individually.', 'Fulfilment FormID: 0007A91A.'),
  ('WP-DRAGON-PRIEST-DAGGER', 'dragon-priest-dagger', 'Dragon Priest Dagger', 'An ancient ceremonial dagger offered unenchanted for collectors and specialist fighters.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0001C1FE.'),
  ('WP-ANCIENT-NORD-BATTLEAXE', 'ancient-nord-battleaxe', 'Ancient Nord Battle Axe', 'A recovered two-handed Nordic axe with a severe draugr-era design.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0001CB64.'),
  ('WP-ANCIENT-NORD-BOW', 'ancient-nord-bow', 'Ancient Nord Bow', 'A recovered Nordic bow preserving the rugged form of an earlier age.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 000302CA.'),
  ('WP-ANCIENT-NORD-GREATSWORD', 'ancient-nord-greatsword', 'Ancient Nord Greatsword', 'A broad two-handed Nordic blade recovered and prepared for renewed service.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 000236A5.'),
  ('WP-ANCIENT-NORD-SWORD', 'ancient-nord-sword', 'Ancient Nord Sword', 'A one-handed Nordic sword with an unmistakable ancient profile.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0002C66F.'),
  ('WP-ANCIENT-NORD-WAR-AXE', 'ancient-nord-war-axe', 'Ancient Nord War Axe', 'A compact recovered Nordic axe suited to one-handed use.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0002C672.'),
  ('WP-HONED-ANCIENT-BATTLEAXE', 'honed-ancient-nord-battleaxe', 'Honed Ancient Nord Battle Axe', 'A better-preserved and sharper example of the ancient Nordic battle axe.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0005BF12.'),
  ('WP-HONED-ANCIENT-GREATSWORD', 'honed-ancient-nord-greatsword', 'Honed Ancient Nord Greatsword', 'A better-preserved ancient Nordic greatsword prepared for serious field use.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0005BF13.'),
  ('WP-HONED-ANCIENT-SWORD', 'honed-ancient-nord-sword', 'Honed Ancient Nord Sword', 'A sharpened and well-preserved ancient Nordic one-handed blade.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0005BF14.'),
  ('WP-SUPPLE-ANCIENT-BOW', 'supple-ancient-nord-bow', 'Supple Ancient Nord Bow', 'A rare, better-preserved ancient bow with a stronger and smoother draw.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0005D179.'),
  ('WP-ANCIENT-NORD-ARROW', 'ancient-nord-arrow', 'Ancient Nord Arrow', 'A single recovered Nordic arrow for collectors or compatible field use.', 'weapons', 'piece', 'warehouse_stocked', 'reserve-dependent', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 00034182.'),
  ('WP-FALMER-BOW', 'falmer-bow', 'Falmer Bow', 'A chitinous underground bow with a distinctive construction and handling style.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 00038340.'),
  ('WP-FALMER-SUPPLE-BOW', 'falmer-supple-bow', 'Falmer Supple Bow', 'A stronger, better-preserved Falmer bow for experienced specialist archers.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 00083167.'),
  ('WP-FALMER-SWORD', 'falmer-sword', 'Falmer Sword', 'A curved chitinous blade recovered for specialist martial use.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0002E6D1.'),
  ('WP-HONED-FALMER-SWORD', 'honed-falmer-sword', 'Honed Falmer Sword', 'A sharper and better-preserved Falmer sword with improved field quality.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0006F6FF.'),
  ('WP-FALMER-WAR-AXE', 'falmer-war-axe', 'Falmer War Axe', 'A hooked chitinous axe built for close and aggressive fighting.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 000302CD.'),
  ('WP-HONED-FALMER-WAR-AXE', 'honed-falmer-war-axe', 'Honed Falmer War Axe', 'A better-preserved Falmer axe prepared for demanding specialist use.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0006F700.'),
  ('WP-FALMER-ARROW', 'falmer-arrow', 'Falmer Arrow', 'A single chitin-tipped Falmer arrow for compatible bows and specialist collections.', 'weapons', 'piece', 'warehouse_stocked', 'reserve-dependent', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 00038341.'),
  ('WP-SKYFORGE-DAGGER', 'skyforge-steel-dagger', 'Skyforge Steel Dagger', 'A compact Skyforge steel blade valued for superior workmanship and balance.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold individually.', 'Fulfilment FormID: 0009F25D.'),
  ('WP-SKYFORGE-SWORD', 'skyforge-steel-sword', 'Skyforge Steel Sword', 'A finely worked Skyforge steel sword offering reliable strength without excessive weight.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold individually.', 'Fulfilment FormID: 0009F25C.'),
  ('WP-SKYFORGE-WAR-AXE', 'skyforge-steel-war-axe', 'Skyforge Steel War Axe', 'A balanced one-handed Skyforge axe made for dependable martial service.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold individually.', 'Fulfilment FormID: 0009F260.'),
  ('WP-SKYFORGE-GREATSWORD', 'skyforge-steel-greatsword', 'Skyforge Steel Greatsword', 'A long two-handed Skyforge blade combining reach, balance, and excellent steelwork.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold individually.', 'Fulfilment FormID: 0009F25E.'),
  ('WP-SKYFORGE-BATTLEAXE', 'skyforge-steel-battleaxe', 'Skyforge Steel Battleaxe', 'A powerful two-handed Skyforge axe for buyers who value reach and decisive force.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'ordinary-economic', 'Sold individually.', 'Fulfilment FormID: 0009F25F.'),
  ('WP-BLADES-SWORD', 'blades-sword', 'Blades Sword', 'An elegant Akaviri-style katana supplied without enchantment for approved martial buyers.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 0003AEB9.'),
  ('WP-HEADSMANS-AXE', 'headsmans-axe', 'Headsman''s Axe', 'A massive long-handled execution axe offered as a specialist ceremonial weapon.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 000BE25E.'),
  ('WP-SHIV', 'shiv', 'Shiv', 'A crude improvised blade sold as a curiosity rather than standard fighting equipment.', 'weapons', 'piece', 'made_to_order', 'made-to-order', 'regulated-alchemical', 'Sold individually; staff approval is required.', 'Fulfilment FormID: 000426C8.');

-- Alchemy ingredients. Explicit quest objects, Dwarven salvage, hides/pelts,
-- and Vampire Dust are intentionally absent from this approved list.
with ingredient_data(item_code, slug, display_name, form_reference, regulated) as (
  values
    ('AI-00106E1B', 'abecean-longfin', 'Abecean Longfin', '00106E1B', false),
    ('AI-0006BC02', 'bear-claws', 'Bear Claws', '0006BC02', false),
    ('AI-000A9195', 'bee', 'Bee', '000A9195', false),
    ('AI-000A9191', 'beehive-husk', 'Beehive Husk', '000A9191', false),
    ('AI-0004DA20', 'bleeding-crown', 'Bleeding Crown', '0004DA20', false),
    ('AI-0004DA25', 'blisterwort', 'Blisterwort', '0004DA25', false),
    ('AI-000727DE', 'blue-butterfly-wing', 'Blue Butterfly Wing', '000727DE', false),
    ('AI-000E4F0C', 'blue-dartwing', 'Blue Dartwing', '000E4F0C', false),
    ('AI-00077E1C', 'blue-mountain-flower', 'Blue Mountain Flower', '00077E1C', false),
    ('AI-00034CDD', 'bone-meal', 'Bone Meal', '00034CDD', false),
    ('AI-0003AD61', 'briar-heart', 'Briar Heart', '0003AD61', true),
    ('AI-000727E0', 'butterfly-wing', 'Butterfly Wing', '000727E0', false),
    ('AI-0006ABCB', 'canis-root', 'Canis Root', '0006ABCB', false),
    ('AI-0003AD56', 'chaurus-eggs', 'Chaurus Eggs', '0003AD56', false),
    ('AI-00023D77', 'chickens-egg', 'Chicken''s Egg', '00023D77', false),
    ('AI-000B2183', 'creep-cluster', 'Creep Cluster', '000B2183', false),
    ('AI-00106E19', 'cyrodilic-spadetail', 'Cyrodilic Spadetail', '00106E19', false),
    ('AI-0003AD5B', 'daedra-heart', 'Daedra Heart', '0003AD5B', true),
    ('AI-000516C8', 'deathbell', 'Deathbell', '000516C8', false),
    ('AI-000889A2', 'dragons-tongue', 'Dragon''s Tongue', '000889A2', false),
    ('AI-0003AD63', 'ectoplasm', 'Ectoplasm', '0003AD63', false),
    ('AI-00034D31', 'elves-ear', 'Elves Ear', '00034D31', false),
    ('AI-0006BC07', 'eye-of-sabre-cat', 'Eye of Sabre Cat', '0006BC07', false),
    ('AI-0003AD5D', 'falmer-ear', 'Falmer Ear', '0003AD5D', true),
    ('AI-0003AD5E', 'fire-salts', 'Fire Salts', '0003AD5E', false),
    ('AI-0004DA00', 'fly-amanita', 'Fly Amanita', '0004DA00', false),
    ('AI-00034D32', 'frost-mirriam', 'Frost Mirriam', '00034D32', false),
    ('AI-0003AD5F', 'frost-salts', 'Frost Salts', '0003AD5F', false),
    ('AI-00034D22', 'garlic', 'Garlic', '00034D22', false),
    ('AI-0007E8C1', 'giant-lichen', 'Giant Lichen', '0007E8C1', false),
    ('AI-0003AD64', 'giants-toe', 'Giant''s Toe', '0003AD64', true),
    ('AI-0003AD73', 'glow-dust', 'Glow Dust', '0003AD73', false),
    ('AI-0007EE01', 'glowing-mushroom', 'Glowing Mushroom', '0007EE01', false),
    ('AI-00083E64', 'grass-pod', 'Grass Pod', '00083E64', false),
    ('AI-0006B689', 'hagraven-claw', 'Hagraven Claw', '0006B689', true),
    ('AI-0003AD66', 'hagraven-feathers', 'Hagraven Feathers', '0003AD66', true),
    ('AI-00057F91', 'hanging-moss', 'Hanging Moss', '00057F91', false),
    ('AI-000E7EBC', 'hawk-beak', 'Hawk Beak', '000E7EBC', false),
    ('AI-000E7ED0', 'hawk-feathers', 'Hawk Feathers', '000E7ED0', false),
    ('AI-00106E18', 'histcarp', 'Histcarp', '00106E18', false),
    ('AI-000B08C5', 'honeycomb', 'Honeycomb', '000B08C5', false),
    ('AI-001016B3', 'human-flesh', 'Human Flesh', '001016B3', true),
    ('AI-000B18CD', 'human-heart', 'Human Heart', '000B18CD', true),
    ('AI-0003AD6A', 'ice-wraith-teeth', 'Ice Wraith Teeth', '0003AD6A', false),
    ('AI-0004DA23', 'imp-stool', 'Imp Stool', '0004DA23', false),
    ('AI-0006AC4A', 'jazbay-grapes', 'Jazbay Grapes', '0006AC4A', false),
    ('AI-0005076E', 'juniper-berries', 'Juniper Berries', '0005076E', false),
    ('AI-0006BC0A', 'large-antlers', 'Large Antlers', '0006BC0A', false),
    ('AI-00045C28', 'lavender', 'Lavender', '00045C28', false),
    ('AI-000727DF', 'luna-moth-wing', 'Luna Moth Wing', '000727DF', false),
    ('AI-000D8E3F', 'moon-sugar', 'Moon Sugar', '000D8E3F', true),
    ('AI-000EC870', 'mora-tapinella', 'Mora Tapinella', '000EC870', false),
    ('AI-0006BC00', 'mudcrab-chitin', 'Mudcrab Chitin', '0006BC00', false),
    ('AI-0004DA24', 'namiras-rot', 'Namira''s Rot', '0004DA24', false),
    ('AI-0002F44C', 'nightshade', 'Nightshade', '0002F44C', false),
    ('AI-00059B86', 'nirnroot', 'Nirnroot', '00059B86', false),
    ('AI-0007EDF5', 'nordic-barnacle', 'Nordic Barnacle', '0007EDF5', false),
    ('AI-000BB956', 'orange-dartwing', 'Orange Dartwing', '000BB956', false),
    ('AI-000854FE', 'pearl', 'Pearl', '000854FE', false),
    ('AI-00023D6F', 'pine-thrush-egg', 'Pine Thrush Egg', '00023D6F', false),
    ('AI-0006BC10', 'powdered-mammoth-tusk', 'Powdered Mammoth Tusk', '0006BC10', false),
    ('AI-00077E1E', 'purple-mountain-flower', 'Purple Mountain Flower', '00077E1E', false),
    ('AI-00077E1D', 'red-mountain-flower', 'Red Mountain Flower', '00077E1D', false),
    ('AI-00106E1A', 'river-betty', 'River Betty', '00106E1A', false),
    ('AI-0007E8C8', 'rock-warbler-egg', 'Rock Warbler Egg', '0007E8C8', false),
    ('AI-0006BC04', 'sabre-cat-tooth', 'Sabre Cat Tooth', '0006BC04', false),
    ('AI-00034CDF', 'salt-pile', 'Salt Pile', '00034CDF', false),
    ('AI-0006F950', 'scaly-pholiota', 'Scaly Pholiota', '0006F950', false),
    ('AI-00106E1C', 'silverside-perch', 'Silverside Perch', '00106E1C', false),
    ('AI-0003AD6F', 'skeever-tail', 'Skeever Tail', '0003AD6F', false),
    ('AI-0007E8C5', 'slaughterfish-egg', 'Slaughterfish Egg', '0007E8C5', false),
    ('AI-0003AD70', 'slaughterfish-scales', 'Slaughterfish Scales', '0003AD70', false),
    ('AI-0006BC0B', 'small-antlers', 'Small Antlers', '0006BC0B', false),
    ('AI-00085500', 'small-pearl', 'Small Pearl', '00085500', false),
    ('AI-0001B3BD', 'snowberries', 'Snowberries', '0001B3BD', false),
    ('AI-0009151B', 'spider-egg', 'Spider Egg', '0009151B', false),
    ('AI-00063B5F', 'spriggan-sap', 'Spriggan Sap', '00063B5F', false),
    ('AI-0007E8B7', 'swamp-fungal-pod', 'Swamp Fungal Pod', '0007E8B7', false),
    ('AI-0003AD71', 'taproot', 'Taproot', '0003AD71', false),
    ('AI-000134AA', 'thistle-branch', 'Thistle Branch', '000134AA', false),
    ('AI-0004DA73', 'torchbug-thorax', 'Torchbug Thorax', '0004DA73', false),
    ('AI-0003AD72', 'troll-fat', 'Troll Fat', '0003AD72', true),
    ('AI-0003F7F8', 'tundra-cotton', 'Tundra Cotton', '0003F7F8', false),
    ('AI-0003AD60', 'void-salts', 'Void Salts', '0003AD60', false),
    ('AI-0004B0BA', 'wheat', 'Wheat', '0004B0BA', false),
    ('AI-0004DA22', 'white-cap', 'White Cap', '0004DA22', false),
    ('AI-0006BC0E', 'wisp-wrappings', 'Wisp Wrappings', '0006BC0E', false),
    ('AI-HF-00F1CC', 'hawks-egg', 'Hawk''s Egg', 'Hearthfire xx00F1CC', false),
    ('AI-HF-003545', 'salmon-roe', 'Salmon Roe', 'Hearthfire xx003545', false),
    ('AI-DG-0059BA', 'ancestor-moth-wing', 'Ancestor Moth Wing', 'Dawnguard-content xx0059BA', false),
    ('AI-DG-0183B7', 'chaurus-hunter-antennae', 'Chaurus Hunter Antennae', 'Dawnguard-content xx0183B7', false),
    ('AI-DG-00B097', 'gleamblossom', 'Gleamblossom', 'Dawnguard-content xx00B097', false),
    ('AI-DG-0185FB', 'poison-bloom', 'Poison Bloom', 'Dawnguard-content xx0185FB', false),
    ('AI-DG-002A78', 'yellow-mountain-flower', 'Yellow Mountain Flower', 'Dawnguard-content xx002A78', false),
    ('AI-DR-01CD74', 'ash-creep-cluster', 'Ash Creep Cluster', 'Dragonborn xx01CD74', false),
    ('AI-DR-01CD71', 'ash-hopper-jelly', 'Ash Hopper Jelly', 'Dragonborn xx01CD71', false),
    ('AI-DR-016E26', 'ashen-grass-pod', 'Ashen Grass Pod', 'Dragonborn xx016E26', false),
    ('AI-DR-01CD6F', 'boar-tusk', 'Boar Tusk', 'Dragonborn xx01CD6F', false),
    ('AI-DR-01CD6E', 'burnt-spriggan-wood', 'Burnt Spriggan Wood', 'Dragonborn xx01CD6E', false),
    ('AI-DR-01FF75', 'emperor-parasol-moss', 'Emperor Parasol Moss', 'Dragonborn xx01FF75', false),
    ('AI-DR-03CD8E', 'felsaad-tern-feathers', 'Felsaad Tern Feathers', 'Dragonborn xx03CD8E', false),
    ('AI-DR-01CD72', 'netch-jelly', 'Netch Jelly', 'Dragonborn xx01CD72', false),
    ('AI-DR-017E97', 'scathecraw', 'Scathecraw', 'Dragonborn xx017E97', false),
    ('AI-DR-01CD6D', 'spawn-ash', 'Spawn Ash', 'Dragonborn xx01CD6D', false),
    ('AI-DR-017008', 'trama-root', 'Trama Root', 'Dragonborn xx017008', false)
)
insert into curated_catalogue_products
select
  item_code,
  slug,
  display_name,
  'A measured supply of ' || display_name || ' for alchemical brewing, research, and professional apothecary work.',
  'alchemy-ingredients',
  'ingredient',
  'warehouse_stocked',
  'reserve-dependent',
  case when regulated then 'regulated-alchemical' else 'ordinary-economic' end,
  case when regulated
    then 'Sold individually; staff approval is required for this specialist ingredient.'
    else 'Sold individually while supplies last.'
  end,
  'Fulfilment FormID: ' || form_reference || '.'
from ingredient_data;

-- Prepared and baked foods.
with prepared_food(item_code, slug, display_name, form_reference) as (
  values
    ('FD-000EBA01', 'apple-cabbage-stew', 'Apple Cabbage Stew', '000EBA01'),
    ('FD-000F4314', 'beef-stew', 'Beef Stew', '000F4314'),
    ('FD-000F431B', 'cabbage-potato-soup', 'Cabbage Potato Soup', '000F431B'),
    ('FD-000EBA02', 'cabbage-soup', 'Cabbage Soup', '000EBA02'),
    ('FD-HF-00353E', 'clam-chowder', 'Clam Chowder', 'Hearthfire xx00353E'),
    ('FD-000721E8', 'cooked-beef', 'Cooked Beef', '000721E8'),
    ('FD-000F4320', 'elsweyr-fondue', 'Elsweyr Fondue', '000F4320'),
    ('FD-000E8947', 'grilled-chicken-breast', 'Grilled Chicken Breast', '000E8947'),
    ('FD-DR-03CD5B', 'horker-and-ash-yam-stew', 'Horker and Ash Yam Stew', 'Dragonborn xx03CD5B'),
    ('FD-0007224E', 'horker-loaf', 'Horker Loaf', '0007224E'),
    ('FD-000F4315', 'horker-stew', 'Horker Stew', '000F4315'),
    ('FD-000722B0', 'horse-haunch', 'Horse Haunch', '000722B0'),
    ('FD-0007224C', 'leg-of-goat-roast', 'Leg of Goat Roast', '0007224C'),
    ('FD-000722BB', 'mammoth-steak', 'Mammoth Steak', '000722BB'),
    ('FD-000722C7', 'pheasant-roast', 'Pheasant Roast', '000722C7'),
    ('FD-HF-00353D', 'potato-soup', 'Potato Soup', 'Hearthfire xx00353D'),
    ('FD-000722C2', 'rabbit-haunch', 'Rabbit Haunch', '000722C2'),
    ('FD-00064B3B', 'salmon-steak', 'Salmon Steak', '00064B3B'),
    ('FD-HF-00353F', 'steamed-mudcrab-legs', 'Steamed Mudcrab Legs', 'Hearthfire xx00353F'),
    ('FD-000F431C', 'tomato-soup', 'Tomato Soup', '000F431C'),
    ('FD-000F431E', 'vegetable-soup', 'Vegetable Soup', '000F431E'),
    ('FD-000722BD', 'venison-chop', 'Venison Chop', '000722BD'),
    ('FD-000F431D', 'venison-stew', 'Venison Stew', '000F431D'),
    ('FD-HF-003533', 'apple-dumpling', 'Apple Dumpling', 'Hearthfire xx003533'),
    ('FD-00064B43', 'apple-pie', 'Apple Pie', '00064B43'),
    ('FD-HF-0009DB', 'braided-bread', 'Braided Bread', 'Hearthfire xx0009DB'),
    ('FD-00065C97', 'bread', 'Bread', '00065C97'),
    ('FD-HF-0117FF', 'chicken-dumpling', 'Chicken Dumpling', 'Hearthfire xx0117FF'),
    ('FD-HF-0009DC', 'garlic-bread', 'Garlic Bread', 'Hearthfire xx0009DC'),
    ('FD-HF-00353A', 'jazbay-crostata', 'Jazbay Crostata', 'Hearthfire xx00353A'),
    ('FD-HF-003539', 'juniper-berry-crostata', 'Juniper Berry Crostata', 'Hearthfire xx003539'),
    ('FD-HF-011801', 'lavender-dumpling', 'Lavender Dumpling', 'Hearthfire xx011801'),
    ('FD-HF-003537', 'potato-bread', 'Potato Bread', 'Hearthfire xx003537'),
    ('FD-HF-00353B', 'snowberry-crostata', 'Snowberry Crostata', 'Hearthfire xx00353B'),
    ('FD-00064B3D', 'sweet-roll', 'Sweet Roll', '00064B3D'),
    ('FD-00064B3A', 'baked-potatoes', 'Baked Potatoes', '00064B3A'),
    ('FD-00064B30', 'boiled-creme-treat', 'Boiled Creme Treat', '00064B30'),
    ('FD-000E8448', 'charred-skeever-meat', 'Charred Skeever Meat', '000E8448'),
    ('FD-DR-03CF72', 'cooked-boar-meat', 'Cooked Boar Meat', 'Dragonborn xx03CF72'),
    ('FD-00064B3E', 'grilled-leeks', 'Grilled Leeks', '00064B3E'),
    ('FD-000CD614', 'homecooked-meal', 'Homecooked Meal', '000CD614'),
    ('FD-00064B38', 'honey-nut-treat', 'Honey Nut Treat', '00064B38'),
    ('FD-00064B39', 'long-taffy-treat', 'Long Taffy Treat', '00064B39'),
    ('FD-000669A3', 'mammoth-cheese-bowl', 'Mammoth Cheese Bowl', '000669A3'),
    ('FD-00064B3C', 'seared-slaughterfish', 'Seared Slaughterfish', '00064B3C'),
    ('FD-000CADFB', 'spiced-beef', 'Spiced Beef', '000CADFB')
)
insert into curated_catalogue_products
select item_code, slug, display_name,
  'A ready-to-serve portion of ' || display_name || ' for taverns, households, and travelling provisions.',
  'food', 'serving', 'warehouse_stocked', 'reserve-dependent', 'ordinary-economic',
  'Sold as one serving while supplies last.', 'Fulfilment FormID: ' || form_reference || '.'
from prepared_food;

-- Raw food and kitchen provisions. Soul Husks and vampire-specific Fresh Meat
-- are excluded from the ordinary sales catalogue.
with raw_food(item_code, slug, display_name, form_reference) as (
  values
    ('FD-DR-0206E7', 'ash-yam', 'Ash Yam', 'Dragonborn xx0206E7'),
    ('FD-HF-00353C', 'butter', 'Butter', 'Hearthfire xx00353C'),
    ('FD-000954BF', 'cabbage', 'Cabbage', '000954BF'),
    ('FD-00064B40', 'carrot', 'Carrot', '00064B40'),
    ('FD-000F2011', 'chicken-breast', 'Chicken Breast', '000F2011'),
    ('FD-000EBA03', 'clam-meat', 'Clam Meat', '000EBA03'),
    ('FD-00064B34', 'eidar-cheese-wheel', 'Eidar Cheese Wheel', '00064B34'),
    ('FD-00064B2F', 'green-apple', 'Green Apple', '00064B2F'),
    ('FD-00065C9B', 'horker-meat', 'Horker Meat', '00065C9B'),
    ('FD-00065C9C', 'horse-meat', 'Horse Meat', '00065C9C'),
    ('FD-HF-003534', 'jug-of-milk', 'Jug of Milk', 'Hearthfire xx003534'),
    ('FD-000669A5', 'leek', 'Leek', '000669A5'),
    ('FD-00065C9A', 'leg-of-goat', 'Leg of Goat', '00065C9A'),
    ('FD-000669A4', 'mammoth-snout', 'Mammoth Snout', '000669A4'),
    ('FD-HF-003540', 'mudcrab-legs', 'Mudcrab Legs', 'Hearthfire xx003540'),
    ('FD-00065C9D', 'pheasant-breast', 'Pheasant Breast', '00065C9D'),
    ('FD-00064B41', 'potato', 'Potato', '00064B41'),
    ('FD-00065C99', 'raw-beef', 'Raw Beef', '00065C99'),
    ('FD-00065C9E', 'raw-rabbit-leg', 'Raw Rabbit Leg', '00065C9E'),
    ('FD-00064B2E', 'red-apple', 'Red Apple', '00064B2E'),
    ('FD-HF-003538', 'sack-of-flour', 'Sack of Flour', 'Hearthfire xx003538'),
    ('FD-00065C9F', 'salmon-meat', 'Salmon Meat', '00065C9F'),
    ('FD-00064B42', 'tomato', 'Tomato', '00064B42'),
    ('FD-000669A2', 'venison', 'Venison', '000669A2'),
    ('FD-DR-03D125', 'ash-hopper-leg', 'Ash Hopper Leg', 'Dragonborn xx03D125'),
    ('FD-DR-03BD15', 'ash-hopper-meat', 'Ash Hopper Meat', 'Dragonborn xx03BD15'),
    ('FD-DR-03BD14', 'boar-meat', 'Boar Meat', 'Dragonborn xx03BD14'),
    ('FD-000EDB2E', 'dog-meat', 'Dog Meat', '000EDB2E'),
    ('FD-00064B32', 'eidar-cheese-wedge', 'Eidar Cheese Wedge', '00064B32'),
    ('FD-00064B31', 'goat-cheese-wedge', 'Goat Cheese Wedge', '00064B31'),
    ('FD-00064B33', 'goat-cheese-wheel', 'Goat Cheese Wheel', '00064B33'),
    ('FD-0010D666', 'gourd', 'Gourd', '0010D666'),
    ('FD-0010394D', 'honey', 'Honey', '0010394D'),
    ('FD-00064B36', 'sliced-eidar-cheese', 'Sliced Eidar Cheese', '00064B36'),
    ('FD-00064B35', 'sliced-goat-cheese', 'Sliced Goat Cheese', '00064B35')
)
insert into curated_catalogue_products
select item_code, slug, display_name,
  'A kitchen-ready supply of ' || display_name || ', sold for cooks, caterers, and household provisioners.',
  'food', 'serving', 'warehouse_stocked', 'reserve-dependent', 'ordinary-economic',
  'Sold individually while supplies last.', 'Fulfilment FormID: ' || form_reference || '.'
from raw_food;

-- Commercial beverages. Quest-only bottles and skooma products are excluded.
with drink_data(item_code, slug, display_name, form_reference) as (
  values
    ('DR-00034C5E', 'ale', 'Ale', '00034C5E'),
    ('DR-0003133B', 'alto-wine', 'Alto Wine', '0003133B'),
    ('DR-HF-003535', 'argonian-bloodwine', 'Argonian Bloodwine', 'Hearthfire xx003535'),
    ('DR-0002C35A', 'black-briar-mead', 'Black-Briar Mead', '0002C35A'),
    ('DR-000F693F', 'black-briar-reserve', 'Black-Briar Reserve', '000F693F'),
    ('DR-00065C39', 'cliff-racer', 'Cliff Racer', '00065C39'),
    ('DR-000B91D7', 'cyrodilic-brandy', 'Cyrodilic Brandy', '000B91D7'),
    ('DR-DR-0207E5', 'flin', 'Flin', 'Dragonborn xx0207E5'),
    ('DR-000508CA', 'honningbrew-mead', 'Honningbrew Mead', '000508CA'),
    ('DR-DR-0248CE', 'matze', 'Matze', 'Dragonborn xx0248CE'),
    ('DR-00107A8A', 'mead-with-juniper-berry', 'Mead with Juniper Berry', '00107A8A'),
    ('DR-00034C5D', 'nord-mead', 'Nord Mead', '00034C5D'),
    ('DR-DR-0248CC', 'shein', 'Shein', 'Dragonborn xx0248CC'),
    ('DR-00085368', 'spiced-wine', 'Spiced Wine', '00085368'),
    ('DR-DR-0207E6', 'sujamma', 'Sujamma', 'Dragonborn xx0207E6'),
    ('DR-HF-003536', 'surilie-brothers-wine', 'Surilie Brothers Wine', 'Hearthfire xx003536'),
    ('DR-00065C37', 'velvet-lechance', 'Velvet LeChance', '00065C37'),
    ('DR-00065C38', 'white-gold-tower', 'White-Gold Tower', '00065C38'),
    ('DR-000C5348', 'wine', 'Wine', '000C5348')
)
insert into curated_catalogue_products
select item_code, slug, display_name,
  'A bottled serving of ' || display_name || ' for inns, private cellars, and catered tables.',
  'drinks', 'bottle', 'warehouse_stocked', 'reserve-dependent', 'ordinary-economic',
  'Sold by the bottle while supplies last.', 'Fulfilment FormID: ' || form_reference || '.'
from drink_data;

insert into public.items (
  item_code, slug, display_name, description, category_id, unit_id,
  inventory_mode, status, internal_notes
)
select
  product.item_code,
  product.slug,
  product.display_name,
  product.description,
  category.id,
  unit_of_measure.id,
  'fungible',
  'active',
  product.internal_notes || ' Source list reviewed against Skyrim Commands and Skyrim base/DLC item records on 2026-09-05.'
from curated_catalogue_products product
join public.item_categories category on category.code = product.category_code
join public.units_of_measure unit_of_measure on unit_of_measure.code = product.unit_code
on conflict (item_code) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  category_id = excluded.category_id,
  unit_id = excluded.unit_id,
  inventory_mode = excluded.inventory_mode,
  status = 'active',
  internal_notes = excluded.internal_notes;

insert into public.item_supply_policies (
  item_id, supply_mode, procurement_enabled, player_sourced_only,
  admin_receipt_allowed, direct_individual_allowed
)
select
  item.id,
  product.supply_mode,
  false,
  false,
  true,
  true
from curated_catalogue_products product
join public.items item on item.item_code = product.item_code
on conflict (item_id) do update set
  supply_mode = excluded.supply_mode,
  procurement_enabled = excluded.procurement_enabled,
  player_sourced_only = excluded.player_sourced_only,
  admin_receipt_allowed = excluded.admin_receipt_allowed,
  direct_individual_allowed = excluded.direct_individual_allowed,
  direct_weekly_limit = null,
  business_bulk_review_threshold = null,
  version = public.item_supply_policies.version + 1;

insert into public.item_publications (
  item_id, audience_code, publication_status, public_name, public_description,
  control_profile_id, availability_profile_id, requirement_summary,
  bulk_minimum, order_increment, effective_from
)
select
  item.id,
  'public',
  'published',
  product.display_name,
  product.description,
  control_profile.id,
  availability.id,
  product.requirement_summary,
  null,
  1,
  '2026-09-05T19:00:00Z'::timestamptz
from curated_catalogue_products product
join public.items item on item.item_code = product.item_code
join public.control_profiles control_profile on control_profile.code = product.control_code
join public.availability_profiles availability on availability.code = product.availability_code
where not exists (
  select 1
  from public.item_publications current_publication
  where current_publication.item_id = item.id
    and current_publication.audience_code = 'public'
    and current_publication.publication_status = 'published'
    and current_publication.effective_until is null
);

comment on table public.items is
  'Canonical sellable item types. Outfit products may represent a configured complete set while preserving fulfilment component references in restricted internal notes.';
