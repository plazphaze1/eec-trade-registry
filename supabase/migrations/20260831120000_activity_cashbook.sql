-- Simple stock activity journal and operational purchase cashbook.
-- Staff record what happened; PostgreSQL derives stock and known spend.

alter table public.inventory_transactions
  drop constraint inventory_transactions_transaction_type_check;
alter table public.inventory_transactions
  drop constraint inventory_transactions_reversal_shape_check;
alter table public.inventory_transactions
  add constraint inventory_transactions_transaction_type_check
  check (transaction_type in (
    'receipt', 'issue', 'transfer_dispatch', 'transfer_receipt',
    'consignment_issue', 'consignment_settlement', 'reconciliation', 'reversal'
  ));
alter table public.inventory_transactions
  add constraint inventory_transactions_reversal_shape_check
  check (
    (
      transaction_type in (
        'receipt', 'issue', 'transfer_dispatch', 'transfer_receipt',
        'consignment_issue', 'consignment_settlement', 'reconciliation'
      )
      and reversal_of_id is null
    )
    or (transaction_type = 'reversal' and reversal_of_id is not null)
  );

insert into public.permission_scopes (code, display_name, description)
values
  (
    'finance.cashbook.read',
    'Read operational money summary',
    'View known procurement spending, unpaid procurement obligations, and unpriced purchases.'
  ),
  (
    'inventory.count.reconcile',
    'Reconcile counted stock',
    'Post an audited ledger difference so counted ordinary stock matches a recorded total.'
  )
on conflict (code) do update
set display_name = excluded.display_name,
    description = excluded.description,
    active = true;

insert into public.staff_role_permissions (staff_role_id, permission_scope_id)
select role.id, permission.id
from public.staff_roles as role
cross join public.permission_scopes as permission
where role.code in ('owner', 'agent')
  and permission.code = 'finance.cashbook.read'
on conflict (staff_role_id, permission_scope_id) do nothing;

insert into public.staff_role_permissions (staff_role_id, permission_scope_id)
select role.id, permission.id
from public.staff_roles as role
cross join public.permission_scopes as permission
where role.code = 'owner'
  and permission.code = 'inventory.count.reconcile'
on conflict (staff_role_id, permission_scope_id) do nothing;

create table public.stock_activity_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  public_reference text not null unique,
  activity_type text not null
    check (activity_type in ('anonymous_purchase', 'count_reconciliation')),
  item_id uuid not null references public.items(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  stock_location_id uuid not null references public.stock_locations(id) on delete restrict,
  inventory_transaction_id uuid not null unique
    references public.inventory_transactions(id) on delete restrict,
  recorded_quantity numeric(18, 3) not null check (recorded_quantity >= 0),
  quantity_delta numeric(18, 3) not null check (quantity_delta <> 0),
  previous_quantity numeric(18, 3) not null check (previous_quantity >= 0),
  resulting_quantity numeric(18, 3) not null check (resulting_quantity >= 0),
  occurred_on date not null,
  procurement_offer_id uuid references public.procurement_offers(id) on delete restrict,
  amount_minor_per_unit bigint check (amount_minor_per_unit is null or amount_minor_per_unit > 0),
  total_amount_minor bigint check (total_amount_minor is null or total_amount_minor > 0),
  currency_code text check (currency_code is null or currency_code ~ '^[A-Z0-9_]{2,12}$'),
  financial_status text not null
    check (financial_status in ('paid', 'unpriced', 'not_applicable')),
  note text not null default '' check (char_length(note) <= 500),
  recorded_by_actor_id uuid not null references public.actor_profiles(id) on delete restrict,
  source_request_id uuid not null unique,
  created_at timestamptz not null default now(),
  check (
    (
      activity_type = 'anonymous_purchase'
      and recorded_quantity > 0
      and quantity_delta = recorded_quantity
      and resulting_quantity = previous_quantity + recorded_quantity
      and financial_status in ('paid', 'unpriced')
    )
    or (
      activity_type = 'count_reconciliation'
      and quantity_delta = recorded_quantity - previous_quantity
      and resulting_quantity = recorded_quantity
      and procurement_offer_id is null
      and amount_minor_per_unit is null
      and total_amount_minor is null
      and currency_code is null
      and financial_status = 'not_applicable'
    )
  ),
  check (
    (
      financial_status = 'paid'
      and procurement_offer_id is not null
      and amount_minor_per_unit is not null
      and total_amount_minor = round(recorded_quantity * amount_minor_per_unit)::bigint
      and currency_code is not null
    )
    or (
      financial_status = 'unpriced'
      and procurement_offer_id is null
      and amount_minor_per_unit is null
      and total_amount_minor is null
      and currency_code is null
    )
    or financial_status = 'not_applicable'
  ),
  check (public_reference = private.normalize_registry_reference(public_reference))
);

comment on table public.stock_activity_entries is
  'Immutable staff activity journal for anonymous aggregate material purchases and counted-total reconciliations. Stock remains derived from linked ledger entries.';
comment on column public.stock_activity_entries.financial_status is
  'A priced anonymous purchase is treated as paid at intake. Unpriced preserves stock evidence without inventing a monetary value.';
comment on column public.stock_activity_entries.occurred_on is
  'Business occurrence date supplied by staff. created_at and audit_log retain the exact recording time.';

create index stock_activity_entries_item_date_idx
  on public.stock_activity_entries(item_id, occurred_on desc, created_at desc);
create index stock_activity_entries_financial_idx
  on public.stock_activity_entries(financial_status, occurred_on desc)
  where activity_type = 'anonymous_purchase';

create trigger stock_activity_entries_audit
after insert on public.stock_activity_entries
for each row execute function private.capture_audit_row();
create trigger stock_activity_entries_immutable
before update or delete on public.stock_activity_entries
for each row execute function private.reject_immutable_inventory_change();

alter table public.stock_activity_entries enable row level security;

insert into public.reference_sequences (document_type, prefix, next_value, padding)
values ('stock_activity', 'EEC-ACT', 1001, 4)
on conflict (document_type) do nothing;

create function private.allocate_stock_activity_reference()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sequence_record record;
  allocated_reference text;
begin
  select reference.prefix, reference.next_value, reference.padding
  into strict sequence_record
  from public.reference_sequences as reference
  where reference.document_type = 'stock_activity'
    and reference.active
  for update;

  allocated_reference := sequence_record.prefix || '-'
    || lpad(sequence_record.next_value::text, sequence_record.padding, '0');
  update public.reference_sequences as reference
  set next_value = reference.next_value + 1
  where reference.document_type = 'stock_activity';
  return allocated_reference;
exception when no_data_found then
  raise exception using errcode = '55000', message = 'stock_activity_reference_unavailable';
end;
$$;

create function public.staff_record_anonymous_purchase(
  p_item_id uuid,
  p_quantity numeric,
  p_occurred_on date,
  p_note text,
  p_request_id uuid
)
returns table (
  activity_id uuid,
  public_reference text,
  resulting_quantity numeric,
  total_amount_minor bigint,
  currency_code text,
  financial_status text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  item_record record;
  location_record record;
  offer_record record;
  existing_activity public.stock_activity_entries%rowtype;
  physical_account_id uuid;
  external_account_id uuid;
  created_transaction_id uuid;
  created_activity_id uuid;
  created_reference text;
  previous_total numeric(18, 3);
  computed_total bigint;
  occurrence_timestamp timestamptz;
  normalized_note text;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception using errcode = '22023', message = 'activity_quantity_invalid';
  end if;
  if p_occurred_on is null or p_occurred_on > current_date then
    raise exception using errcode = '22023', message = 'activity_date_invalid';
  end if;
  normalized_note := btrim(coalesce(p_note, ''));
  if char_length(normalized_note) > 500 then
    raise exception using errcode = '22023', message = 'activity_note_invalid';
  end if;
  occurrence_timestamp := case
    when p_occurred_on = current_date then statement_timestamp()
    else (p_occurred_on::timestamp + time '12:00') at time zone 'UTC'
  end;

  select item.id, item.inventory_mode, policy.procurement_enabled
  into item_record
  from public.items as item
  join public.item_supply_policies as policy on policy.item_id = item.id
  where item.id = p_item_id
    and item.status = 'active';
  if not found then
    raise exception using errcode = 'P0002', message = 'activity_item_not_found';
  end if;
  if item_record.inventory_mode <> 'fungible' or not item_record.procurement_enabled then
    raise exception using errcode = '22023', message = 'activity_purchase_not_allowed';
  end if;

  select location.id, location.warehouse_id, warehouse.operating_party_id
  into location_record
  from public.stock_locations as location
  join public.warehouses as warehouse
    on warehouse.id = location.warehouse_id
    and warehouse.status = 'active'
  where location.active
    and location.location_type = 'available'
    and exists (
      select 1
      from private.current_staff_warehouse_assignments(
        'procurement.delivery.receive', warehouse.id
      )
    )
  order by warehouse.display_name, location.display_name
  limit 1;
  if not found then
    raise exception using errcode = '42501', message = 'staff_warehouse_permission_denied';
  end if;

  actor_id := private.set_warehouse_audit_context(
    'procurement.delivery.receive',
    location_record.warehouse_id,
    coalesce(nullif(normalized_note, ''), 'Anonymous aggregate material purchase recorded.'),
    p_request_id
  );

  select *
  into existing_activity
  from public.stock_activity_entries
  where source_request_id = p_request_id;
  if found then
    if existing_activity.activity_type <> 'anonymous_purchase' then
      raise exception using errcode = '22023', message = 'request_id_reused';
    end if;
    activity_id := existing_activity.id;
    public_reference := existing_activity.public_reference;
    resulting_quantity := existing_activity.resulting_quantity;
    total_amount_minor := existing_activity.total_amount_minor;
    currency_code := existing_activity.currency_code;
    financial_status := existing_activity.financial_status;
    return next;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_item_id::text || ':' || location_record.warehouse_id::text,
      0
    )
  );

  insert into public.inventory_accounts (
    item_id, account_kind, owner_party_id, custodian_party_id,
    warehouse_id, stock_location_id, stock_state
  ) values (
    p_item_id, 'physical', location_record.operating_party_id,
    location_record.operating_party_id, location_record.warehouse_id,
    location_record.id, 'available'
  ) on conflict (
    item_id, owner_party_id, custodian_party_id,
    warehouse_id, stock_location_id, stock_state
  ) where account_kind = 'physical' do nothing;

  select account.id
  into strict physical_account_id
  from public.inventory_accounts as account
  where account.item_id = p_item_id
    and account.account_kind = 'physical'
    and account.owner_party_id = location_record.operating_party_id
    and account.custodian_party_id = location_record.operating_party_id
    and account.warehouse_id = location_record.warehouse_id
    and account.stock_location_id = location_record.id
    and account.stock_state = 'available';

  insert into public.inventory_accounts (item_id, account_kind, stock_state)
  values (p_item_id, 'external', 'external_source')
  on conflict (item_id) where account_kind = 'external' do nothing;
  select account.id
  into strict external_account_id
  from public.inventory_accounts as account
  where account.item_id = p_item_id
    and account.account_kind = 'external';

  perform 1
  from public.inventory_accounts as account
  where account.id in (physical_account_id, external_account_id)
  order by account.id
  for update;

  select coalesce(sum(entry.quantity_delta), 0)
  into previous_total
  from public.inventory_accounts as account
  left join public.inventory_ledger_entries as entry
    on entry.inventory_account_id = account.id
  where account.item_id = p_item_id
    and account.account_kind = 'physical'
    and account.warehouse_id = location_record.warehouse_id
    and account.stock_state = 'available';

  select offer.id, offer.amount_minor, currency.code
  into offer_record
  from public.procurement_offers as offer
  join public.currencies as currency
    on currency.id = offer.currency_id
    and currency.active
  where offer.item_id = p_item_id
    and offer.status = 'active'
    and offer.effective_from <= occurrence_timestamp
    and (offer.effective_until is null or offer.effective_until > occurrence_timestamp)
  order by offer.effective_from desc, currency.code
  limit 1;

  created_reference := private.allocate_stock_activity_reference();
  insert into public.inventory_transactions (
    transaction_type, occurred_at, posted_by_actor_id, permission_code,
    source_reference, reason, request_id
  ) values (
    'receipt', occurrence_timestamp, actor_id, 'procurement.delivery.receive',
    created_reference,
    coalesce(nullif(normalized_note, ''), 'Anonymous aggregate material purchase recorded.'),
    p_request_id
  ) returning id into created_transaction_id;

  insert into public.inventory_ledger_entries (
    inventory_transaction_id, line_number, inventory_account_id, item_id, quantity_delta
  ) values
    (created_transaction_id, 1, external_account_id, p_item_id, -p_quantity),
    (created_transaction_id, 2, physical_account_id, p_item_id, p_quantity);

  computed_total := case when offer_record.id is null then null
    else round(p_quantity * offer_record.amount_minor)::bigint end;
  insert into public.stock_activity_entries (
    public_reference, activity_type, item_id, warehouse_id, stock_location_id,
    inventory_transaction_id, recorded_quantity, quantity_delta,
    previous_quantity, resulting_quantity, occurred_on, procurement_offer_id,
    amount_minor_per_unit, total_amount_minor, currency_code, financial_status,
    note, recorded_by_actor_id, source_request_id
  ) values (
    created_reference, 'anonymous_purchase', p_item_id, location_record.warehouse_id,
    location_record.id, created_transaction_id, p_quantity, p_quantity,
    previous_total, previous_total + p_quantity, p_occurred_on, offer_record.id,
    offer_record.amount_minor, computed_total, offer_record.code,
    case when offer_record.id is null then 'unpriced' else 'paid' end,
    normalized_note, actor_id, p_request_id
  ) returning id into created_activity_id;

  insert into public.outbox_events (
    event_type, aggregate_type, aggregate_id, payload, deduplication_key
  ) values (
    'stock_activity.purchase_recorded', 'stock_activity', created_activity_id,
    jsonb_build_object(
      'activity_id', created_activity_id,
      'public_reference', created_reference,
      'item_id', p_item_id,
      'quantity', p_quantity,
      'occurred_on', p_occurred_on,
      'financial_status', case when offer_record.id is null then 'unpriced' else 'paid' end,
      'total_amount_minor', computed_total,
      'currency_code', offer_record.code
    ),
    'stock_activity.purchase_recorded:' || p_request_id::text
  );

  activity_id := created_activity_id;
  public_reference := created_reference;
  resulting_quantity := previous_total + p_quantity;
  total_amount_minor := computed_total;
  currency_code := offer_record.code;
  financial_status := case when offer_record.id is null then 'unpriced' else 'paid' end;
  return next;
end;
$$;

create function public.staff_set_counted_stock_total(
  p_item_id uuid,
  p_target_quantity numeric,
  p_occurred_on date,
  p_reason text,
  p_request_id uuid
)
returns table (
  activity_id uuid,
  public_reference text,
  previous_quantity numeric,
  resulting_quantity numeric,
  quantity_delta numeric
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  item_record record;
  location_record record;
  existing_activity public.stock_activity_entries%rowtype;
  account_record record;
  physical_account_id uuid;
  external_account_id uuid;
  created_transaction_id uuid;
  created_activity_id uuid;
  created_reference text;
  current_total numeric(18, 3);
  reserved_total numeric(18, 3);
  adjustment numeric(18, 3);
  remaining numeric(18, 3);
  amount_to_remove numeric(18, 3);
  entry_number smallint := 2;
  occurrence_timestamp timestamptz;
begin
  if p_target_quantity is null or p_target_quantity < 0 then
    raise exception using errcode = '22023', message = 'counted_total_invalid';
  end if;
  if p_occurred_on is null or p_occurred_on > current_date then
    raise exception using errcode = '22023', message = 'activity_date_invalid';
  end if;
  occurrence_timestamp := case
    when p_occurred_on = current_date then statement_timestamp()
    else (p_occurred_on::timestamp + time '12:00') at time zone 'UTC'
  end;

  select item.id, item.inventory_mode, policy.admin_receipt_allowed,
    policy.player_sourced_only
  into item_record
  from public.items as item
  left join public.item_supply_policies as policy on policy.item_id = item.id
  where item.id = p_item_id
    and item.status = 'active';
  if not found then
    raise exception using errcode = 'P0002', message = 'activity_item_not_found';
  end if;
  if item_record.inventory_mode <> 'fungible'
    or coalesce(item_record.player_sourced_only, false)
    or not coalesce(item_record.admin_receipt_allowed, true) then
    raise exception using errcode = '22023', message = 'counted_total_not_allowed';
  end if;

  select location.id, location.warehouse_id, warehouse.operating_party_id
  into location_record
  from public.stock_locations as location
  join public.warehouses as warehouse
    on warehouse.id = location.warehouse_id
    and warehouse.status = 'active'
  where location.active
    and location.location_type = 'available'
    and exists (
      select 1
      from private.current_staff_warehouse_assignments(
        'inventory.count.reconcile', warehouse.id
      )
    )
  order by warehouse.display_name, location.display_name
  limit 1;
  if not found then
    raise exception using errcode = '42501', message = 'staff_warehouse_permission_denied';
  end if;

  actor_id := private.set_warehouse_audit_context(
    'inventory.count.reconcile', location_record.warehouse_id, p_reason, p_request_id
  );

  select * into existing_activity
  from public.stock_activity_entries
  where source_request_id = p_request_id;
  if found then
    if existing_activity.activity_type <> 'count_reconciliation' then
      raise exception using errcode = '22023', message = 'request_id_reused';
    end if;
    activity_id := existing_activity.id;
    public_reference := existing_activity.public_reference;
    previous_quantity := existing_activity.previous_quantity;
    resulting_quantity := existing_activity.resulting_quantity;
    quantity_delta := existing_activity.quantity_delta;
    return next;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_item_id::text || ':' || location_record.warehouse_id::text,
      0
    )
  );

  insert into public.inventory_accounts (
    item_id, account_kind, owner_party_id, custodian_party_id,
    warehouse_id, stock_location_id, stock_state
  ) values (
    p_item_id, 'physical', location_record.operating_party_id,
    location_record.operating_party_id, location_record.warehouse_id,
    location_record.id, 'available'
  ) on conflict (
    item_id, owner_party_id, custodian_party_id,
    warehouse_id, stock_location_id, stock_state
  ) where account_kind = 'physical' do nothing;
  select account.id into strict physical_account_id
  from public.inventory_accounts as account
  where account.item_id = p_item_id
    and account.account_kind = 'physical'
    and account.owner_party_id = location_record.operating_party_id
    and account.custodian_party_id = location_record.operating_party_id
    and account.warehouse_id = location_record.warehouse_id
    and account.stock_location_id = location_record.id
    and account.stock_state = 'available';

  insert into public.inventory_accounts (item_id, account_kind, stock_state)
  values (p_item_id, 'external', 'external_source')
  on conflict (item_id) where account_kind = 'external' do nothing;
  select account.id into strict external_account_id
  from public.inventory_accounts as account
  where account.item_id = p_item_id
    and account.account_kind = 'external';

  perform 1
  from public.inventory_accounts as account
  where account.item_id = p_item_id
    and (
      account.id = external_account_id
      or (
        account.account_kind = 'physical'
        and account.warehouse_id = location_record.warehouse_id
        and account.stock_state = 'available'
      )
    )
  order by account.id
  for update;

  select coalesce(sum(entry.quantity_delta), 0)
  into current_total
  from public.inventory_accounts as account
  left join public.inventory_ledger_entries as entry
    on entry.inventory_account_id = account.id
  where account.item_id = p_item_id
    and account.account_kind = 'physical'
    and account.warehouse_id = location_record.warehouse_id
    and account.stock_state = 'available';

  select coalesce(sum(reservation.quantity), 0)
  into reserved_total
  from public.reservations as reservation
  join public.inventory_accounts as account
    on account.id = reservation.inventory_account_id
  where account.item_id = p_item_id
    and account.warehouse_id = location_record.warehouse_id
    and account.stock_state = 'available'
    and reservation.status = 'active'
    and reservation.expires_at > statement_timestamp();

  if p_target_quantity < reserved_total then
    raise exception using errcode = '23514', message = 'counted_total_below_reserved';
  end if;
  adjustment := p_target_quantity - current_total;
  if adjustment = 0 then
    raise exception using errcode = '22023', message = 'counted_total_unchanged';
  end if;

  created_reference := private.allocate_stock_activity_reference();
  insert into public.inventory_transactions (
    transaction_type, occurred_at, posted_by_actor_id, permission_code,
    source_reference, reason, request_id
  ) values (
    'reconciliation', occurrence_timestamp, actor_id, 'inventory.count.reconcile',
    created_reference, btrim(p_reason), p_request_id
  ) returning id into created_transaction_id;

  -- A downward reconciliation can span more than one physical account. Delay
  -- the row-level balance assertion until every matching line has been posted.
  set constraints public.inventory_ledger_state_check deferred;

  insert into public.inventory_ledger_entries (
    inventory_transaction_id, line_number, inventory_account_id, item_id, quantity_delta
  ) values (
    created_transaction_id, 1, external_account_id, p_item_id, -adjustment
  );

  if adjustment > 0 then
    insert into public.inventory_ledger_entries (
      inventory_transaction_id, line_number, inventory_account_id, item_id, quantity_delta
    ) values (
      created_transaction_id, 2, physical_account_id, p_item_id, adjustment
    );
  else
    remaining := -adjustment;
    for account_record in
      select account.id, coalesce(sum(entry.quantity_delta), 0) as on_hand
      from public.inventory_accounts as account
      left join public.inventory_ledger_entries as entry
        on entry.inventory_account_id = account.id
      where account.item_id = p_item_id
        and account.account_kind = 'physical'
        and account.warehouse_id = location_record.warehouse_id
        and account.stock_state = 'available'
      group by account.id, account.stock_location_id
      having coalesce(sum(entry.quantity_delta), 0) > 0
      order by (account.stock_location_id = location_record.id) desc, account.id
    loop
      exit when remaining <= 0;
      amount_to_remove := least(account_record.on_hand, remaining);
      insert into public.inventory_ledger_entries (
        inventory_transaction_id, line_number, inventory_account_id, item_id, quantity_delta
      ) values (
        created_transaction_id, entry_number, account_record.id, p_item_id, -amount_to_remove
      );
      entry_number := entry_number + 1;
      remaining := remaining - amount_to_remove;
    end loop;
    if remaining > 0 then
      raise exception using errcode = '23514', message = 'counted_total_reduction_invalid';
    end if;
  end if;

  set constraints public.inventory_ledger_state_check immediate;

  insert into public.stock_activity_entries (
    public_reference, activity_type, item_id, warehouse_id, stock_location_id,
    inventory_transaction_id, recorded_quantity, quantity_delta,
    previous_quantity, resulting_quantity, occurred_on, financial_status,
    note, recorded_by_actor_id, source_request_id
  ) values (
    created_reference, 'count_reconciliation', p_item_id,
    location_record.warehouse_id, location_record.id, created_transaction_id,
    p_target_quantity, adjustment, current_total, p_target_quantity,
    p_occurred_on, 'not_applicable', btrim(p_reason), actor_id, p_request_id
  ) returning id into created_activity_id;

  insert into public.outbox_events (
    event_type, aggregate_type, aggregate_id, payload, deduplication_key
  ) values (
    'stock_activity.count_reconciled', 'stock_activity', created_activity_id,
    jsonb_build_object(
      'activity_id', created_activity_id,
      'public_reference', created_reference,
      'item_id', p_item_id,
      'previous_quantity', current_total,
      'resulting_quantity', p_target_quantity,
      'quantity_delta', adjustment,
      'occurred_on', p_occurred_on
    ),
    'stock_activity.count_reconciled:' || p_request_id::text
  );

  activity_id := created_activity_id;
  public_reference := created_reference;
  previous_quantity := current_total;
  resulting_quantity := p_target_quantity;
  quantity_delta := adjustment;
  return next;
end;
$$;

create function public.get_staff_stock_activity_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform 1 from private.require_staff_permission('inventory.position.read');
  return jsonb_build_object(
    'generated_at', statement_timestamp(),
    'capabilities', jsonb_build_object(
      'can_record_purchase', private.current_staff_has_permission('procurement.delivery.receive'),
      'can_reconcile_count', private.current_staff_has_permission('inventory.count.reconcile')
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item.id,
        'item_code', item.item_code,
        'item_name', item.display_name,
        'unit_code', unit.code,
        'can_purchase', coalesce(policy.procurement_enabled, false),
        'can_set_total', item.inventory_mode = 'fungible'
          and coalesce(policy.admin_receipt_allowed, true)
          and not coalesce(policy.player_sourced_only, false),
        'current_quantity', coalesce(stock.quantity, 0),
        'buying_price_minor', offer.amount_minor,
        'buying_currency_code', offer.currency_code
      ) order by item.display_name)
      from public.items as item
      join public.units_of_measure as unit on unit.id = item.unit_id
      left join public.item_supply_policies as policy on policy.item_id = item.id
      left join lateral (
        select coalesce(sum(entry.quantity_delta), 0) as quantity
        from public.inventory_accounts as account
        left join public.inventory_ledger_entries as entry
          on entry.inventory_account_id = account.id
        where account.item_id = item.id
          and account.account_kind = 'physical'
          and account.stock_state = 'available'
          and exists (
            select 1 from private.current_staff_warehouse_assignments(
              'inventory.position.read', account.warehouse_id
            )
          )
      ) as stock on true
      left join lateral (
        select current_offer.amount_minor, currency.code as currency_code
        from public.procurement_offers as current_offer
        join public.currencies as currency
          on currency.id = current_offer.currency_id and currency.active
        where current_offer.item_id = item.id
          and current_offer.status = 'active'
          and current_offer.effective_from <= statement_timestamp()
          and (current_offer.effective_until is null
            or current_offer.effective_until > statement_timestamp())
        order by current_offer.effective_from desc, currency.code
        limit 1
      ) as offer on true
      where item.status = 'active'
        and item.inventory_mode = 'fungible'
        and (
          coalesce(policy.procurement_enabled, false)
          or (
            coalesce(policy.admin_receipt_allowed, true)
            and not coalesce(policy.player_sourced_only, false)
          )
        )
    ), '[]'::jsonb),
    'recent_activity', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', activity.id,
        'public_reference', activity.public_reference,
        'activity_type', activity.activity_type,
        'item_name', item.display_name,
        'unit_code', unit.code,
        'recorded_quantity', activity.recorded_quantity,
        'quantity_delta', activity.quantity_delta,
        'resulting_quantity', activity.resulting_quantity,
        'occurred_on', activity.occurred_on,
        'financial_status', activity.financial_status,
        'total_amount_minor', activity.total_amount_minor,
        'currency_code', activity.currency_code,
        'note', activity.note,
        'recorded_by', actor.display_name,
        'created_at', activity.created_at,
        'is_reversed', reversal.id is not null
      ) order by activity.occurred_on desc, activity.created_at desc)
      from (
        select * from public.stock_activity_entries
        order by occurred_on desc, created_at desc
        limit 50
      ) as activity
      join public.items as item on item.id = activity.item_id
      join public.units_of_measure as unit on unit.id = item.unit_id
      join public.actor_profiles as actor on actor.id = activity.recorded_by_actor_id
      left join public.inventory_transactions as reversal
        on reversal.reversal_of_id = activity.inventory_transaction_id
      where exists (
        select 1 from private.current_staff_warehouse_assignments(
          'inventory.position.read', activity.warehouse_id
        )
      )
    ), '[]'::jsonb)
  );
end;
$$;

create function public.get_staff_money_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform 1 from private.require_staff_permission('finance.cashbook.read');
  return jsonb_build_object(
    'generated_at', statement_timestamp(),
    'summaries', coalesce((
      with money_rows as (
        select activity.currency_code,
          activity.total_amount_minor as paid_amount,
          0::bigint as outstanding_amount,
          activity.occurred_on,
          activity.financial_status = 'unpriced' as is_unpriced
        from public.stock_activity_entries as activity
        left join public.inventory_transactions as reversal
          on reversal.reversal_of_id = activity.inventory_transaction_id
        where activity.activity_type = 'anonymous_purchase'
          and reversal.id is null
        union all
        select delivery.currency_code,
          case when delivery.settlement_status = 'paid' then delivery.total_amount_minor else 0 end,
          case when delivery.settlement_status = 'pending' then delivery.total_amount_minor else 0 end,
          delivery.received_at::date,
          false
        from public.procurement_deliveries as delivery
        left join public.inventory_transactions as reversal
          on reversal.reversal_of_id = delivery.inventory_transaction_id
        where reversal.id is null
      )
      select jsonb_agg(jsonb_build_object(
        'currency_code', grouped.currency_code,
        'paid_total_minor', grouped.paid_total_minor,
        'paid_30d_minor', grouped.paid_30d_minor,
        'outstanding_total_minor', grouped.outstanding_total_minor
      ) order by grouped.currency_code)
      from (
        select currency.code as currency_code,
          coalesce(sum(money_entry.paid_amount), 0)::bigint as paid_total_minor,
          coalesce(sum(money_entry.paid_amount) filter (
            where money_entry.occurred_on >= current_date - 29
          ), 0)::bigint as paid_30d_minor,
          coalesce(sum(money_entry.outstanding_amount), 0)::bigint as outstanding_total_minor
        from public.currencies as currency
        left join money_rows as money_entry on money_entry.currency_code = currency.code
        where currency.active
        group by currency.code
        having coalesce(sum(money_entry.paid_amount), 0) <> 0
          or coalesce(sum(money_entry.outstanding_amount), 0) <> 0
          or exists (
            select 1 from money_rows as unpriced where unpriced.is_unpriced
          )
      ) as grouped
    ), '[]'::jsonb),
    'unpriced_purchase_count', (
      select count(*)
      from public.stock_activity_entries as activity
      left join public.inventory_transactions as reversal
        on reversal.reversal_of_id = activity.inventory_transaction_id
      where activity.activity_type = 'anonymous_purchase'
        and activity.financial_status = 'unpriced'
        and reversal.id is null
    ),
    'recent_purchases', coalesce((
      select jsonb_agg(row_data order by occurred_on desc, created_at desc)
      from (
        select jsonb_build_object(
          'id', activity.id,
          'public_reference', activity.public_reference,
          'source_type', 'anonymous_purchase',
          'seller_label', 'Anonymous purchase',
          'item_name', item.display_name,
          'unit_code', unit.code,
          'quantity', activity.recorded_quantity,
          'unit_price_minor', activity.amount_minor_per_unit,
          'total_amount_minor', activity.total_amount_minor,
          'currency_code', activity.currency_code,
          'status', activity.financial_status,
          'occurred_on', activity.occurred_on,
          'created_at', activity.created_at
        ) as row_data,
        activity.occurred_on,
        activity.created_at
        from public.stock_activity_entries as activity
        join public.items as item on item.id = activity.item_id
        join public.units_of_measure as unit on unit.id = item.unit_id
        left join public.inventory_transactions as reversal
          on reversal.reversal_of_id = activity.inventory_transaction_id
        where activity.activity_type = 'anonymous_purchase'
          and reversal.id is null
        union all
        select jsonb_build_object(
          'id', delivery.id,
          'public_reference', delivery.public_reference,
          'source_type', 'named_delivery',
          'seller_label', party.display_name,
          'item_name', item.display_name,
          'unit_code', unit.code,
          'quantity', delivery.quantity,
          'unit_price_minor', delivery.amount_minor_per_unit,
          'total_amount_minor', delivery.total_amount_minor,
          'currency_code', delivery.currency_code,
          'status', delivery.settlement_status,
          'occurred_on', delivery.received_at::date,
          'created_at', delivery.created_at
        ) as row_data,
        delivery.received_at::date as occurred_on,
        delivery.created_at
        from public.procurement_deliveries as delivery
        join public.procurement_suppliers as supplier on supplier.id = delivery.supplier_id
        join public.parties as party on party.id = supplier.party_id
        join public.items as item on item.id = delivery.item_id
        join public.units_of_measure as unit on unit.id = item.unit_id
        left join public.inventory_transactions as reversal
          on reversal.reversal_of_id = delivery.inventory_transaction_id
        where reversal.id is null
      ) as purchases
      limit 100
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on table public.stock_activity_entries from public, anon, authenticated;
revoke all on function private.allocate_stock_activity_reference()
  from public, anon, authenticated;
revoke all on function public.staff_record_anonymous_purchase(uuid, numeric, date, text, uuid)
  from public, anon;
revoke all on function public.staff_set_counted_stock_total(uuid, numeric, date, text, uuid)
  from public, anon;
revoke all on function public.get_staff_stock_activity_workspace()
  from public, anon;
revoke all on function public.get_staff_money_workspace()
  from public, anon;

grant execute on function public.staff_record_anonymous_purchase(uuid, numeric, date, text, uuid)
  to authenticated;
grant execute on function public.staff_set_counted_stock_total(uuid, numeric, date, text, uuid)
  to authenticated;
grant execute on function public.get_staff_stock_activity_workspace()
  to authenticated;
grant execute on function public.get_staff_money_workspace()
  to authenticated;

comment on function public.staff_record_anonymous_purchase(uuid, numeric, date, text, uuid) is
  'Records an aggregate player-material purchase without a supplier identity. A rate active on the occurrence date is snapshotted when present; otherwise the purchase remains explicitly unpriced.';
comment on function public.staff_set_counted_stock_total(uuid, numeric, date, text, uuid) is
  'Owner-only counted-total reconciliation for ordinary fungible goods. It posts the difference to the immutable balanced inventory ledger and never overwrites a balance.';
comment on function public.get_staff_money_workspace() is
  'Operational procurement cashbook projection. It reports known paid purchases, outstanding named-supplier obligations, and unpriced anonymous purchases; it is not a treasury or full accounting ledger.';
