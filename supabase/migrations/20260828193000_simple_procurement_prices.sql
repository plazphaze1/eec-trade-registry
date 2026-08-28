create or replace function public.staff_set_procurement_price(
  p_item_id uuid,
  p_currency_id uuid,
  p_amount_minor bigint,
  p_reason text,
  p_request_id uuid
)
returns table (offer_id uuid, version bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  existing_offer public.procurement_offers%rowtype;
begin
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'procurement_request_id_required';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception using errcode = '22023', message = 'procurement_price_invalid';
  end if;

  actor_id := private.set_staff_audit_context(
    'procurement.offer.manage',
    p_reason,
    p_request_id
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_item_id::text || ':' || p_currency_id::text, 0)
  );

  select *
  into existing_offer
  from public.procurement_offers
  where source_request_id = p_request_id;
  if found then
    offer_id := existing_offer.id;
    version := existing_offer.version;
    return next;
    return;
  end if;

  if not exists (
    select 1
    from public.item_supply_policies
    where item_id = p_item_id
      and procurement_enabled
  ) then
    raise exception using errcode = '22023', message = 'procurement_not_enabled';
  end if;
  if not exists (
    select 1
    from public.currencies
    where id = p_currency_id
      and active
  ) then
    raise exception using errcode = 'P0002', message = 'procurement_currency_not_found';
  end if;

  update public.procurement_offers
  set status = 'retired', version = procurement_offers.version + 1
  where item_id = p_item_id
    and currency_id = p_currency_id
    and status = 'active'
    and (effective_until is null or effective_until > statement_timestamp());

  insert into public.procurement_offers (
    item_id,
    currency_id,
    amount_minor,
    minimum_quantity,
    staff_review_quantity,
    effective_from,
    effective_until,
    notes,
    created_by_actor_id,
    source_request_id
  ) values (
    p_item_id,
    p_currency_id,
    p_amount_minor,
    1,
    null,
    statement_timestamp(),
    null,
    'Current guaranteed buying price.',
    actor_id,
    p_request_id
  )
  returning procurement_offers.id, procurement_offers.version
  into offer_id, version;

  return next;
end;
$$;

revoke all on function public.staff_set_procurement_price(uuid, uuid, bigint, text, uuid)
from public, anon;

grant execute on function public.staff_set_procurement_price(uuid, uuid, bigint, text, uuid)
to authenticated;

comment on function public.staff_set_procurement_price(uuid, uuid, bigint, text, uuid) is
  'Atomically replaces the current guaranteed player-material buying price while preserving retired offer history.';
