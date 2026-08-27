-- A licensed-business preview never loads direct-customer quota policy. The
-- original function used an anonymous record and later read one of its fields,
-- which raises SQLSTATE 55000 while the record is still structurally unassigned.
-- Initialize the nullable direct-policy shape before evaluating any order line.

create or replace function public.staff_preview_trade_order(
  p_channel text,
  p_customer_party_id uuid,
  p_customer_name text,
  p_dealer_authorization_id uuid,
  p_license_id uuid,
  p_jurisdiction_id uuid,
  p_lines jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  dealer_record record;
  license_record record;
  line jsonb;
  item_record record;
  price_record record;
  policy_record record;
  resolved_party_id uuid := p_customer_party_id;
  resolved_jurisdiction_id uuid := p_jurisdiction_id;
  local_now timestamp;
  starts_at timestamptz;
  used_quantity numeric;
  requested_quantity numeric;
  remaining_quantity numeric;
  preview_lines jsonb := '[]'::jsonb;
  warnings jsonb := '[]'::jsonb;
  total_amount numeric := 0;
  preview_valid boolean := true;
  resolved_currency text;
  source_description text;
begin
  select
    null::numeric as direct_weekly_limit,
    null::text as weekly_window_timezone
  into policy_record;

  perform 1 from private.require_staff_permission('order.assisted.create');

  if p_channel not in ('staff_assisted_business', 'direct_individual')
    or jsonb_typeof(p_lines) <> 'array'
    or jsonb_array_length(p_lines) = 0
    or jsonb_array_length(p_lines) > 50
  then
    raise exception using errcode = '22023', message = 'assisted_order_invalid';
  end if;

  if p_channel = 'staff_assisted_business' then
    select dealer.*, status.confers_authority
    into dealer_record
    from public.dealer_authorizations as dealer
    join public.dealer_status_definitions as status
      on status.id = dealer.status_definition_id
    where dealer.id = p_dealer_authorization_id
      and dealer.dealer_party_id = p_customer_party_id
      and status.confers_authority
      and dealer.effective_from <= statement_timestamp()
      and (dealer.effective_until is null or dealer.effective_until > statement_timestamp());
    if not found then
      raise exception using errcode = '22023', message = 'assisted_dealer_not_authorized';
    end if;

    select license.* into license_record
    from public.licenses as license
    join public.license_status_definitions as status
      on status.id = license.status_definition_id
      and status.confers_authority
    where license.id = p_license_id
      and license.holder_party_id = p_customer_party_id
      and license.dealer_authorization_id = p_dealer_authorization_id
      and license.effective_from <= statement_timestamp()
      and (license.expires_at is null or license.expires_at > statement_timestamp());
    if not found then
      raise exception using errcode = '22023', message = 'assisted_license_not_authorized';
    end if;
    resolved_jurisdiction_id := dealer_record.jurisdiction_id;
  else
    if not exists (
      select 1 from public.jurisdictions as jurisdiction
      where jurisdiction.id = resolved_jurisdiction_id
        and jurisdiction.status = 'active'
    ) or (resolved_party_id is null and btrim(coalesce(p_customer_name, '')) = '') then
      raise exception using errcode = '22023', message = 'direct_customer_invalid';
    end if;
  end if;

  for line in select value from jsonb_array_elements(p_lines) loop
    requested_quantity := (line ->> 'quantity')::numeric;
    if requested_quantity <= 0 then
      raise exception using errcode = '22023', message = 'order_line_quantity_invalid';
    end if;

    select item.id, item.item_code, item.display_name, unit.symbol
    into item_record
    from public.items as item
    join public.units_of_measure as unit on unit.id = item.unit_id
    where item.id = (line ->> 'item_id')::uuid
      and item.status = 'active';
    if not found then
      raise exception using errcode = '22023', message = 'order_item_invalid';
    end if;

    select * into price_record
    from private.resolve_trade_price(
      p_channel,
      resolved_party_id,
      p_dealer_authorization_id,
      p_license_id,
      resolved_jurisdiction_id,
      item_record.id
    );

    remaining_quantity := null;
    used_quantity := null;
    if p_channel = 'direct_individual' then
      if not found then
        raise exception using errcode = '22023', message = 'direct_price_unavailable';
      end if;
      select supply.*, channel.weekly_window_timezone
      into policy_record
      from public.item_supply_policies as supply
      join public.commercial_channel_policies as channel
        on channel.channel_code = 'direct_individual'
        and channel.active
      where supply.item_id = item_record.id
        and supply.direct_individual_allowed;
      if not found then
        raise exception using errcode = '22023', message = 'direct_item_not_allowed';
      end if;

      local_now := statement_timestamp() at time zone policy_record.weekly_window_timezone;
      starts_at := date_trunc('week', local_now) at time zone policy_record.weekly_window_timezone;
      if resolved_party_id is null then
        used_quantity := 0;
      else
        select coalesce(sum(quota.quantity), 0) into used_quantity
        from public.personal_quota_entries as quota
        where quota.party_id = resolved_party_id
          and quota.item_id = item_record.id
          and quota.window_start = starts_at
          and quota.status in ('held', 'consumed');
      end if;
      if policy_record.direct_weekly_limit is not null then
        remaining_quantity := greatest(policy_record.direct_weekly_limit - used_quantity, 0);
        if requested_quantity > remaining_quantity then
          preview_valid := false;
          warnings := warnings || jsonb_build_array(
            item_record.display_name || ' exceeds the current personal weekly limit.'
          );
        end if;
      end if;
    end if;

    if price_record.amount_minor is not null then
      total_amount := total_amount + price_record.amount_minor * requested_quantity;
      resolved_currency := coalesce(resolved_currency, price_record.currency_code);
    end if;
    source_description := case split_part(coalesce(price_record.source_label, ''), ':', 1)
      when 'party' then 'Dealer-specific price'
      when 'license_class' then 'License-class price'
      when 'dealer_type' then 'Dealer-type price'
      when 'jurisdiction' then 'Regional price'
      when 'channel_default' then 'Channel default price'
      when 'audience' then 'Published audience price'
      else 'Price to be confirmed by staff'
    end;

    preview_lines := preview_lines || jsonb_build_array(jsonb_build_object(
      'item_id', item_record.id,
      'item_code', item_record.item_code,
      'item_name', item_record.display_name,
      'quantity', requested_quantity,
      'unit', item_record.symbol,
      'unit_price_minor', price_record.amount_minor,
      'base_price_minor', price_record.base_amount_minor,
      'currency_code', price_record.currency_code,
      'multiplier_basis_points', price_record.multiplier_basis_points,
      'price_source', source_description,
      'weekly_limit', case when p_channel = 'direct_individual'
        then policy_record.direct_weekly_limit else null end,
      'weekly_used', used_quantity,
      'weekly_remaining', remaining_quantity
    ));
  end loop;

  return jsonb_build_object(
    'valid', preview_valid,
    'channel', p_channel,
    'channel_label', case p_channel
      when 'direct_individual' then 'Direct individual · premium pricing'
      else 'Verified business · licensed pricing'
    end,
    'lines', preview_lines,
    'total_amount_minor', case when resolved_currency is null then null else total_amount end,
    'currency_code', resolved_currency,
    'warnings', warnings,
    'reservation_message', 'Approval does not require stock. Any later reservation lasts 48 hours.'
  );
end;
$$;

revoke execute on function public.staff_preview_trade_order(
  text, uuid, text, uuid, uuid, uuid, jsonb
) from public, anon;
grant execute on function public.staff_preview_trade_order(
  text, uuid, text, uuid, uuid, uuid, jsonb
) to authenticated;
