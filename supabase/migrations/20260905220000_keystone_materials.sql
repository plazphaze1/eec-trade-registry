-- Complete the ordinary player-sourced keystone-material baseline.
-- These goods are purchased from players into reserve; they are never
-- created by a generic administrative stock receipt and have no invented
-- prices or opening stock.

update public.items
set display_name = 'Leather',
    description = 'Prepared leather purchased into the Company reserve.',
    internal_notes = 'Player-sourced keystone material. The stable RM-LEATHER-ROLL code is retained for existing references; never create stock with a generic administrative receipt.'
where item_code = 'RM-LEATHER-ROLL';

update public.item_publications as publication
set public_name = 'Leather',
    public_description = 'Prepared leather purchased into the Company reserve.'
from public.items item
where item.id = publication.item_id
  and item.item_code = 'RM-LEATHER-ROLL'
  and publication.audience_code = 'public'
  and publication.publication_status in ('draft', 'published');

insert into public.items (
  id, item_code, slug, display_name, description, category_id, unit_id,
  inventory_mode, internal_notes
)
select
  product.id,
  product.item_code,
  product.slug,
  product.display_name,
  product.description,
  category.id,
  unit_of_measure.id,
  'fungible',
  product.internal_notes
from (
  values
    ('ce000000-0000-0000-0000-000000000007'::uuid, 'RM-IRON-INGOT', 'iron-ingot', 'Iron Ingot', 'Refined iron ready for smiths, builders, and everyday metalwork.', 'Fulfilment FormID: 0005ACE4.'),
    ('ce000000-0000-0000-0000-000000000008'::uuid, 'RM-CORUNDUM-ORE', 'corundum-ore', 'Corundum Ore', 'Dense red ore purchased for durable tools, fittings, and advanced smithing.', 'Fulfilment FormID: 0005ACDB.'),
    ('ce000000-0000-0000-0000-000000000009'::uuid, 'RM-CORUNDUM-INGOT', 'corundum-ingot', 'Corundum Ingot', 'Refined corundum prepared for high-quality arms, armour, and crafted fittings.', 'Fulfilment FormID: 0005AD93.'),
    ('ce000000-0000-0000-0000-00000000000a'::uuid, 'RM-STEEL-INGOT', 'steel-ingot', 'Steel Ingot', 'Reliable refined steel for tools, weapons, armour, and structural work.', 'Fulfilment FormID: 0005ACE5.'),
    ('ce000000-0000-0000-0000-00000000000b'::uuid, 'RM-LEATHER-STRIPS', 'leather-strips', 'Leather Strips', 'Cut leather bindings used by smiths, tailors, and general makers.', 'Fulfilment FormID: 000800E4.')
) as product(id, item_code, slug, display_name, description, internal_notes)
join public.item_categories category on category.code = 'raw-materials'
join public.units_of_measure unit_of_measure on unit_of_measure.code = 'material-unit'
on conflict (item_code) do update set
  display_name = excluded.display_name,
  slug = excluded.slug,
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
  'player_sourced_reserve',
  true,
  true,
  false,
  false
from public.items item
where item.item_code in (
  'RM-IRON-INGOT',
  'RM-CORUNDUM-ORE',
  'RM-CORUNDUM-INGOT',
  'RM-STEEL-INGOT',
  'RM-LEATHER-STRIPS'
)
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
  item.display_name,
  item.description,
  control_profile.id,
  availability_profile.id,
  'Published reserve availability is informational; staff confirm quantity and the current purchase or sale rate when ordering.',
  null,
  1,
  '2026-09-05T22:00:00Z'::timestamptz
from public.items item
join public.control_profiles control_profile on control_profile.code = 'ordinary-economic'
join public.availability_profiles availability_profile on availability_profile.code = 'reserve-dependent'
where item.item_code in (
  'RM-IRON-INGOT',
  'RM-CORUNDUM-ORE',
  'RM-CORUNDUM-INGOT',
  'RM-STEEL-INGOT',
  'RM-LEATHER-STRIPS'
)
and not exists (
  select 1
  from public.item_publications current_publication
  where current_publication.item_id = item.id
    and current_publication.audience_code = 'public'
    and current_publication.publication_status = 'published'
    and current_publication.effective_until is null
);

comment on table public.items is
  'Canonical sellable item types. Outfit products may represent a configured complete set while preserving fulfilment component references in restricted internal notes. Keystone materials are player-sourced reserve goods.';
