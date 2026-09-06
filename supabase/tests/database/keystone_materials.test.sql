begin;

select plan(8);

select is(
  (select count(*)::integer
   from public.item_publications publication
   where publication.audience_code = 'public'
     and publication.publication_status = 'published'
     and publication.effective_until is null
     and publication.public_name in (
       'Iron Ore', 'Firewood', 'Iron Ingot', 'Corundum Ore',
       'Corundum Ingot', 'Steel Ingot', 'Leather', 'Leather Strips'
     )),
  8,
  'the complete eight-item keystone baseline is publicly listed'
);

select is(
  (select count(*)::integer
   from public.items item
   where item.item_code like 'RM-%'
     and item.display_name in (
       'Iron Ore', 'Firewood', 'Iron Ingot', 'Corundum Ore',
       'Corundum Ingot', 'Steel Ingot', 'Leather', 'Leather Strips'
     )),
  8,
  'the canonical keystone item names are present'
);

select is(
  (select count(*)::integer
   from public.items item
   join public.item_categories category on category.id = item.category_id
   where item.display_name in (
       'Iron Ore', 'Firewood', 'Iron Ingot', 'Corundum Ore',
       'Corundum Ingot', 'Steel Ingot', 'Leather', 'Leather Strips'
     )
     and category.code = 'raw-materials'),
  8,
  'every keystone item is a raw material'
);

select is(
  (select count(*)::integer
   from public.items item
   join public.units_of_measure unit_of_measure on unit_of_measure.id = item.unit_id
   where item.display_name in (
       'Iron Ore', 'Firewood', 'Iron Ingot', 'Corundum Ore',
       'Corundum Ingot', 'Steel Ingot', 'Leather', 'Leather Strips'
     )
     and unit_of_measure.code = 'material-unit'),
  8,
  'every keystone item uses material units'
);

select is(
  (select count(*)::integer
   from public.items item
   join public.item_supply_policies policy on policy.item_id = item.id
   where item.display_name in (
       'Iron Ore', 'Firewood', 'Iron Ingot', 'Corundum Ore',
       'Corundum Ingot', 'Steel Ingot', 'Leather', 'Leather Strips'
     )
     and policy.supply_mode = 'player_sourced_reserve'
     and policy.procurement_enabled
     and policy.player_sourced_only
     and not policy.admin_receipt_allowed),
  8,
  'every keystone item is player-sourced and cannot be administratively spawned'
);

select is(
  (select count(*)::integer
   from public.price_rules price_rule
   join public.items item on item.id = price_rule.item_id
   where item.display_name in (
       'Iron Ore', 'Firewood', 'Iron Ingot', 'Corundum Ore',
       'Corundum Ingot', 'Steel Ingot', 'Leather', 'Leather Strips'
     )),
  0,
  'keystone materials have no invented prices'
);

select is(
  (select count(*)::integer
   from public.items item
   where item.display_name in (
       'Iron Ore', 'Firewood', 'Iron Ingot', 'Corundum Ore',
       'Corundum Ingot', 'Steel Ingot', 'Leather', 'Leather Strips'
     )
     and btrim(item.description) <> ''
     and btrim(item.internal_notes) <> ''),
  8,
  'every keystone item has public copy and fulfilment notes'
);

select is(
  (select count(*)::integer
   from public.item_publications publication
   where publication.public_name = 'Leather Roll'
     and publication.audience_code = 'public'
     and publication.effective_until is null),
  0,
  'the public baseline uses Leather rather than the legacy Leather Roll label'
);

select * from finish();
rollback;
