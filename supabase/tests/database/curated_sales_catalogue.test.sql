begin;

select plan(16);

select is(
  (select count(*)::integer from public.items where item_code ~ '^(CL|AR|WP|AI|FD|DR)-'),
  295,
  'the approved curated merchandise contains 295 canonical products'
);

select is((select count(*)::integer from public.items where item_code like 'CL-%'), 28, 'twenty-eight complete outfit products are configured');
select is((select count(*)::integer from public.items where item_code like 'AR-%'), 31, 'thirty-one armor pieces are configured');
select is((select count(*)::integer from public.items where item_code like 'WP-%'), 31, 'thirty-one weapons and ammunition products are configured');
select is((select count(*)::integer from public.items where item_code like 'AI-%'), 105, 'one hundred five alchemy ingredients are configured');
select is((select count(*)::integer from public.items where item_code like 'FD-%'), 81, 'eighty-one food products are configured');
select is((select count(*)::integer from public.items where item_code like 'DR-%'), 19, 'nineteen drink products are configured');

select is(
  (select count(*)::integer
   from public.items item
   join public.units_of_measure unit_of_measure on unit_of_measure.id = item.unit_id
   where item.item_code like 'CL-%' and unit_of_measure.code = 'set'),
  28,
  'every clothing product is sold as a complete set'
);

select is(
  (select count(*)::integer
   from public.items item
   join public.units_of_measure unit_of_measure on unit_of_measure.id = item.unit_id
   where item.item_code ~ '^(AR|WP|AI|FD|DR)-' and unit_of_measure.code = 'set'),
  0,
  'armor, weapons, ingredients, food, and drinks are not bundled as sets'
);

select is(
  (select count(*)::integer
   from public.item_publications publication
   join public.items item on item.id = publication.item_id
   where item.item_code ~ '^(CL|AR|WP|AI|FD|DR)-'
     and publication.audience_code = 'public'
     and publication.publication_status = 'published'
     and publication.effective_until is null),
  295,
  'every curated product has one current public sales listing'
);

select is(
  (select count(*)::integer
   from public.price_rules price_rule
   join public.items item on item.id = price_rule.item_id
   where item.item_code ~ '^(CL|AR|WP|AI|FD|DR)-'),
  0,
  'curated products intentionally have no invented prices'
);

select is(
  (select count(*)::integer
   from public.item_supply_policies policy
   join public.items item on item.id = policy.item_id
   where item.item_code ~ '^(CL|AR|WP|AI|FD|DR)-'
     and policy.direct_individual_allowed
     and policy.admin_receipt_allowed),
  295,
  'every curated product supports direct ordering and ordinary stock intake'
);

select is(
  (select count(*)::integer
   from public.items item
   where item.item_code ~ '^(CL|AR|WP|AI|FD|DR)-'
     and (btrim(item.description) = '' or btrim(item.internal_notes) = '')),
  0,
  'every curated product has sales copy and restricted fulfilment notes'
);

select is(
  (select count(*)::integer
   from public.items item
   where item.item_code ~ '^(CL|AR|WP)-'
     and item.display_name ~* '(forsworn|vampire|dawnguard|stormcloak|silver sword|silver greatsword)'),
  0,
  'the rejected faction gear and silver weapons are absent'
);

select is(
  (select count(*)::integer
   from public.items item
   where item.item_code like 'AI-%'
     and item.display_name in (
       'Berit''s Ashes', 'Charred Skeever Hide', 'Crimson Nirnroot',
       'Dwarven Oil', 'Fine-Cut Void Salts', 'Jarrin Root', 'Vampire Dust'
     )),
  0,
  'quest reagents, hide, Dwarven oil, and Vampire Dust are absent'
);

select is(
  (select count(*)::integer
   from public.items item
   where item.item_code like 'DR-%'
     and item.display_name ~* 'skooma'),
  0,
  'skooma products are not silently added to the ordinary drinks catalogue'
);

select * from finish();
rollback;
