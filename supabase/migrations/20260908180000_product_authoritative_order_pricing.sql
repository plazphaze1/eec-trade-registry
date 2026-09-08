-- Normal order prices come from effective product price rules. Older pending
-- lines may resolve the current product rule at review, but staff cannot type
-- or override an ordinary order price at the order-processing boundary.

create or replace function public.get_staff_order_queue(p_search text default null)
returns table (
  id uuid,
  public_reference text,
  ordering_party_id uuid,
  ordering_party_name text,
  dealer_reference text,
  license_reference text,
  fulfillment_mode text,
  status text,
  currency_code text,
  dealer_notes text,
  submitted_at timestamptz,
  version bigint,
  lines jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform 1 from private.require_staff_permission('order.private.read');

  return query
  select
    order_record.id,
    order_record.public_reference,
    order_record.ordering_party_id,
    ordering_party.display_name,
    coalesce(
      dealer_record.public_reference,
      case
        when order_record.source_channel = 'direct_individual' then 'DIRECT INDIVIDUAL'
        else 'STAFF ASSISTED'
      end
    ),
    license_record.public_reference,
    order_record.fulfillment_mode,
    order_record.status,
    order_record.currency_code,
    order_record.dealer_notes,
    order_record.submitted_at,
    order_record.version,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', line.id,
            'line_number', line.line_number,
            'item_code', line.item_code_snapshot,
            'item_name', line.item_name_snapshot,
            'unit_code', line.unit_code_snapshot,
            'quantity_requested', line.quantity_requested,
            'quantity_approved', line.quantity_approved,
            'quantity_fulfilled', line.quantity_fulfilled,
            'status', line.status,
            'unit_price_minor', coalesce(line.unit_price_minor_snapshot, current_price.amount_minor),
            'pricing_status', case
              when coalesce(line.unit_price_minor_snapshot, current_price.amount_minor) is null then 'pending'
              else 'configured'
            end,
            'price_origin', case
              when line.unit_price_minor_snapshot is not null then 'snapshot'
              when current_price.amount_minor is not null then 'current_product'
              else null
            end,
            'control_profile_code', line.control_profile_code_snapshot,
            'requires_staff_review', line.requires_staff_review_snapshot,
            'requires_transaction_approval', line.requires_transaction_approval_snapshot,
            'requires_serial_tracking', line.requires_serial_tracking_snapshot,
            'review_reason_codes', line.review_reason_codes,
            'version', line.version
          )
          order by line.line_number
        )
        from public.order_lines as line
        left join lateral private.resolve_trade_price(
          order_record.source_channel,
          order_record.ordering_party_id,
          order_record.dealer_authorization_id,
          order_record.license_id,
          order_record.jurisdiction_id,
          line.item_id
        ) as current_price on line.unit_price_minor_snapshot is null
          and order_record.status not in ('cancelled', 'denied', 'fulfilled')
          and line.status not in ('cancelled', 'denied', 'fulfilled')
        where line.order_id = order_record.id
      ),
      '[]'::jsonb
    )
  from public.orders as order_record
  join public.parties as ordering_party on ordering_party.id = order_record.ordering_party_id
  left join public.dealer_authorizations as dealer_record
    on dealer_record.id = order_record.dealer_authorization_id
  left join public.licenses as license_record on license_record.id = order_record.license_id
  where p_search is null
    or btrim(p_search) = ''
    or order_record.public_reference ilike '%' || btrim(p_search) || '%'
    or ordering_party.display_name ilike '%' || btrim(p_search) || '%'
  order by
    case order_record.status
      when 'submitted' then 0
      when 'under_review' then 1
      when 'awaiting_stock' then 2
      else 3
    end,
    order_record.submitted_at;
end;
$$;

create or replace function public.staff_review_order_line(
  p_order_line_id uuid,
  p_expected_order_version bigint,
  p_decision text,
  p_quantity_approved numeric,
  p_unit_price_minor bigint,
  p_reason text,
  p_request_id uuid
)
returns table (order_id uuid, order_version bigint, order_status text, line_status text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  permission_code text;
  existing_event record;
  current_order public.orders%rowtype;
  current_line public.order_lines%rowtype;
  product_price record;
  effective_unit_price bigint;
  effective_currency_code text;
  effective_price_schedule_id uuid;
  effective_price_rule_id uuid;
  effective_price_source text;
  effective_base_price bigint;
  effective_multiplier integer;
  next_line_status text;
  next_order_status text;
  next_order_version bigint;
  previous_line_state jsonb;
  next_line_state jsonb;
begin
  perform 1 from private.require_staff_permission('order.private.read');

  select event.order_id, event.order_line_id into existing_event
  from public.order_line_events as event
  where event.request_id = p_request_id
    and event.event_type = 'reviewed';
  if found then
    if existing_event.order_line_id <> p_order_line_id then
      raise exception using errcode = '22023', message = 'request_id_reused';
    end if;
    return query
    select order_record.id, order_record.version, order_record.status, line.status
    from public.orders as order_record
    join public.order_lines as line on line.order_id = order_record.id
    where line.id = p_order_line_id;
    return;
  end if;

  select order_record.* into current_order
  from public.orders as order_record
  join public.order_lines as line on line.order_id = order_record.id
  where line.id = p_order_line_id
  for update of order_record;
  if not found then
    raise exception using errcode = 'P0002', message = 'order_line_not_found';
  end if;
  if current_order.version <> p_expected_order_version then
    raise exception using errcode = '40001', message = 'order_version_conflict';
  end if;
  if current_order.status in ('cancelled', 'denied', 'fulfilled') then
    raise exception using errcode = '22023', message = 'order_review_invalid';
  end if;

  select line.* into current_line
  from public.order_lines as line
  where line.id = p_order_line_id
  for update;
  previous_line_state := to_jsonb(current_line);
  if current_line.status not in (
    'review_required', 'approved', 'partially_approved',
    'awaiting_stock', 'partially_awaiting_stock'
  ) then
    raise exception using errcode = '22023', message = 'order_line_review_invalid';
  end if;

  if p_decision not in ('approve', 'awaiting_stock', 'deny') then
    raise exception using errcode = '22023', message = 'order_decision_invalid';
  end if;

  permission_code := case
    when p_decision = 'deny' then 'order.review'
    when current_line.requires_serial_tracking_snapshot then 'order.approve.unique'
    when current_line.requires_staff_review_snapshot
      or current_line.requires_transaction_approval_snapshot
      then 'order.approve.restricted'
    else 'order.approve.ordinary'
  end;
  actor_id := private.set_staff_audit_context(
    permission_code,
    p_reason,
    p_request_id,
    'staff_portal'
  );

  if p_decision = 'deny' then
    if p_quantity_approved is not null then
      raise exception using errcode = '22023', message = 'approved_quantity_invalid';
    end if;
    next_line_status := 'denied';
  else
    if p_quantity_approved is null
      or p_quantity_approved <= 0
      or p_quantity_approved > current_line.quantity_requested then
      raise exception using errcode = '22023', message = 'approved_quantity_invalid';
    end if;
    next_line_status := case
      when p_decision = 'awaiting_stock' and p_quantity_approved < current_line.quantity_requested
        then 'partially_awaiting_stock'
      when p_decision = 'awaiting_stock' then 'awaiting_stock'
      when p_quantity_approved < current_line.quantity_requested then 'partially_approved'
      else 'approved'
    end;
  end if;

  effective_unit_price := current_line.unit_price_minor_snapshot;
  effective_currency_code := current_line.currency_code_snapshot;
  effective_price_schedule_id := current_line.price_schedule_id_snapshot;
  effective_price_rule_id := current_line.price_rule_id_snapshot;
  effective_price_source := current_line.price_source_snapshot;
  effective_base_price := current_line.base_price_minor_snapshot;
  effective_multiplier := current_line.price_multiplier_basis_points_snapshot;

  if p_decision <> 'deny' and effective_unit_price is null then
    select * into product_price
    from private.resolve_trade_price(
      current_order.source_channel,
      current_order.ordering_party_id,
      current_order.dealer_authorization_id,
      current_order.license_id,
      current_order.jurisdiction_id,
      current_line.item_id
    );
    if not found then
      raise exception using errcode = '22023', message = 'product_price_unavailable';
    end if;
    effective_unit_price := product_price.amount_minor;
    effective_currency_code := product_price.currency_code;
    effective_price_schedule_id := product_price.schedule_id;
    effective_price_rule_id := product_price.rule_id;
    effective_price_source := product_price.source_label;
    effective_base_price := product_price.base_amount_minor;
    effective_multiplier := product_price.multiplier_basis_points;
  end if;

  -- p_unit_price_minor remains in the signature for backwards-compatible
  -- callers, but it is intentionally ignored. The effective product rule is
  -- authoritative and is re-read inside this transaction.
  update public.order_lines as line
  set
    quantity_approved = case when p_decision = 'deny' then null else p_quantity_approved end,
    status = next_line_status,
    unit_price_minor_snapshot = effective_unit_price,
    currency_code_snapshot = effective_currency_code,
    pricing_status = case when effective_unit_price is null then 'pending' else 'configured' end,
    price_schedule_id_snapshot = effective_price_schedule_id,
    price_rule_id_snapshot = effective_price_rule_id,
    price_source_snapshot = effective_price_source,
    base_price_minor_snapshot = effective_base_price,
    price_multiplier_basis_points_snapshot = effective_multiplier,
    version = line.version + 1
  where line.id = p_order_line_id
  returning to_jsonb(line.*) into next_line_state;

  select case
    when bool_and(line.status = 'denied') then 'denied'
    when bool_and(line.status in (
      'approved', 'partially_approved', 'awaiting_stock',
      'partially_awaiting_stock', 'denied'
    )) and bool_or(line.status in ('awaiting_stock', 'partially_awaiting_stock'))
      then 'awaiting_stock'
    when bool_and(line.status in ('approved', 'partially_approved', 'denied'))
      and bool_or(line.status in ('partially_approved', 'denied'))
      then 'partially_approved'
    when bool_and(line.status = 'approved') then 'approved'
    else 'under_review'
  end
  into next_order_status
  from public.order_lines as line
  where line.order_id = current_order.id;

  update public.orders as order_record
  set status = next_order_status, version = order_record.version + 1
  where order_record.id = current_order.id
  returning order_record.version into next_order_version;

  insert into public.order_line_events (
    order_line_id,
    order_id,
    event_type,
    previous_state,
    new_state,
    changed_by,
    reason,
    request_id
  )
  values (
    p_order_line_id,
    current_order.id,
    'reviewed',
    previous_line_state,
    next_line_state,
    actor_id,
    btrim(p_reason),
    p_request_id
  );

  if next_order_status <> current_order.status then
    insert into public.order_status_events (
      order_id,
      previous_status,
      new_status,
      event_type,
      changed_by,
      reason,
      request_id
    )
    values (
      current_order.id,
      current_order.status,
      next_order_status,
      'status_changed',
      actor_id,
      btrim(p_reason),
      p_request_id
    );
  end if;

  insert into public.outbox_events (
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    deduplication_key
  )
  values (
    'order.line_reviewed',
    'order',
    current_order.id,
    jsonb_build_object(
      'order_id', current_order.id,
      'order_line_id', p_order_line_id,
      'line_status', next_line_status,
      'order_status', next_order_status,
      'pricing_status', case when effective_unit_price is null then 'pending' else 'configured' end,
      'stock_reserved', false
    ),
    'order.line_reviewed:' || p_request_id::text
  );

  return query
  select current_order.id, next_order_version, next_order_status, next_line_status;
end;
$$;

revoke execute on function public.staff_set_order_line_price(uuid,bigint,bigint,text,uuid)
from authenticated;

comment on function public.staff_review_order_line(uuid,bigint,text,numeric,bigint,text,uuid)
is 'Reviews an order line and snapshots the applicable effective product price when needed. Caller-supplied order pricing is ignored.';

comment on function public.staff_set_order_line_price(uuid,bigint,bigint,text,uuid)
is 'Deprecated legacy order-price command. Normal prices are managed through effective product price rules and authenticated execution is revoked.';
