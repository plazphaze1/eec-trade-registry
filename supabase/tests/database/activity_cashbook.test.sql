begin;

select plan(37);

select has_table('public', 'stock_activity_entries', 'stock activity journal exists');
select has_function('public', 'staff_record_anonymous_purchase', array['uuid','numeric','date','text','uuid'], 'anonymous purchase command exists');
select has_function('public', 'staff_set_counted_stock_total', array['uuid','numeric','date','text','uuid'], 'counted total command exists');
select has_function('public', 'get_staff_stock_activity_workspace', array[]::text[], 'activity workspace exists');
select has_function('public', 'get_staff_money_workspace', array[]::text[], 'money workspace exists');
select ok((select relrowsecurity from pg_class where oid = 'public.stock_activity_entries'::regclass), 'activity journal has RLS');
select ok(not has_table_privilege('authenticated', 'public.stock_activity_entries', 'insert'), 'authenticated callers cannot insert journal rows directly');
select ok(not has_table_privilege('authenticated', 'public.stock_activity_entries', 'select'), 'authenticated callers cannot bypass secured projections');
select ok(not has_function_privilege('anon', 'public.staff_record_anonymous_purchase(uuid,numeric,date,text,uuid)', 'execute'), 'anonymous callers cannot post purchases');
select is((select count(*)::integer from public.permission_scopes where code in ('finance.cashbook.read','inventory.count.reconcile')), 2, 'activity permissions are configured');
select ok(exists(
  select 1 from public.staff_role_permissions role_permission
  join public.staff_roles role on role.id = role_permission.staff_role_id
  join public.permission_scopes permission on permission.id = role_permission.permission_scope_id
  where role.code = 'agent' and permission.code = 'finance.cashbook.read'
), 'Agent can read the operational money summary');
select ok(not exists(
  select 1 from public.staff_role_permissions role_permission
  join public.staff_roles role on role.id = role_permission.staff_role_id
  join public.permission_scopes permission on permission.id = role_permission.permission_scope_id
  where role.code = 'agent' and permission.code = 'inventory.count.reconcile'
), 'Agent cannot reconcile counted totals');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('e1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'activity-agent@example.test', extensions.crypt('test-password', extensions.gen_salt('bf')), now(), now(), now()),
  ('e1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'activity-owner@example.test', extensions.crypt('test-password', extensions.gen_salt('bf')), now(), now(), now()),
  ('e1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'activity-denied@example.test', extensions.crypt('test-password', extensions.gen_salt('bf')), now(), now(), now());

insert into public.actor_profiles (id, auth_user_id, display_name, actor_type)
values
  ('e2000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'Activity Agent', 'staff'),
  ('e2000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 'Activity Owner', 'staff'),
  ('e2000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000003', 'Activity Denied', 'staff');

insert into public.staff_assignments (id, actor_id, staff_role_id, effective_from, assignment_scope)
values
  ('e3000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', (select id from public.staff_roles where code = 'agent'), '2026-01-01T00:00:00Z', '{}'::jsonb),
  ('e3000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000002', (select id from public.staff_roles where code = 'owner'), '2026-01-01T00:00:00Z', '{}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($test$select public.get_staff_money_workspace()$test$, '42501', 'staff_permission_denied', 'unassigned identity cannot read money');

select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($test$
  select * from public.staff_record_anonymous_purchase(
    'ce000000-0000-0000-0000-000000000001', 20, current_date, '',
    'e4000000-0000-0000-0000-000000000001'
  )
$test$, 'Agent can record an anonymous unpriced material purchase');
select lives_ok($test$
  select * from public.staff_record_anonymous_purchase(
    'ce000000-0000-0000-0000-000000000001', 20, current_date, '',
    'e4000000-0000-0000-0000-000000000001'
  )
$test$, 'anonymous purchase retry is idempotent');

reset role;
select is((select count(*)::integer from public.stock_activity_entries where source_request_id = 'e4000000-0000-0000-0000-000000000001'), 1, 'one activity entry is stored');
select is((select financial_status from public.stock_activity_entries where source_request_id = 'e4000000-0000-0000-0000-000000000001'), 'unpriced', 'purchase without a rate remains explicitly unpriced');
select is((select total_amount_minor from public.stock_activity_entries where source_request_id = 'e4000000-0000-0000-0000-000000000001'), null::bigint, 'unpriced purchase does not invent money');
select is((select count(*)::integer from public.procurement_suppliers), 0, 'anonymous purchase does not create a supplier');
select is((
  select sum(entry.quantity_delta)
  from public.inventory_ledger_entries entry
  join public.inventory_accounts account on account.id = entry.inventory_account_id
  where entry.item_id = 'ce000000-0000-0000-0000-000000000001'
    and account.account_kind = 'physical'
), 20::numeric, 'anonymous purchase adds physical reserve stock');
select is((
  select sum(entry.quantity_delta)
  from public.inventory_ledger_entries entry
  join public.stock_activity_entries activity on activity.inventory_transaction_id = entry.inventory_transaction_id
  where activity.source_request_id = 'e4000000-0000-0000-0000-000000000001'
), 0::numeric, 'anonymous purchase ledger transaction balances');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($test$
  select * from public.staff_set_procurement_price(
    'ce000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001', 5,
    'Set tested automatic purchase price.',
    'e4000000-0000-0000-0000-000000000002'
  )
$test$, 'Agent can configure the guaranteed rate under existing authority');
select lives_ok($test$
  select * from public.staff_record_anonymous_purchase(
    'ce000000-0000-0000-0000-000000000001', 10, current_date, 'Aggregate miner purchase.',
    'e4000000-0000-0000-0000-000000000003'
  )
$test$, 'Agent records a purchase using the effective rate');
select throws_ok($test$
  select * from public.staff_set_counted_stock_total(
    'ce000000-0000-0000-0000-000000000006', 3, current_date, 'Attempt Agent count.',
    'e4000000-0000-0000-0000-000000000004'
  )
$test$, '42501', 'staff_warehouse_permission_denied', 'Agent cannot reconcile counted totals');

reset role;
select is((select total_amount_minor from public.stock_activity_entries where source_request_id = 'e4000000-0000-0000-0000-000000000003'), 50::bigint, 'effective rate automatically calculates known spend');
select is((select financial_status from public.stock_activity_entries where source_request_id = 'e4000000-0000-0000-0000-000000000003'), 'paid', 'aggregate bought purchase is paid at intake');
select ok(exists(select 1 from public.audit_log where record_type = 'public.stock_activity_entries' and request_id = 'e4000000-0000-0000-0000-000000000003' and actor_id = 'e2000000-0000-0000-0000-000000000001'), 'purchase audit records exact actor and request');
select is((select count(*)::integer from public.outbox_events where deduplication_key = 'stock_activity.purchase_recorded:e4000000-0000-0000-0000-000000000003'), 1, 'purchase emits durable integration work');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select ok((public.get_staff_money_workspace() ->> 'unpriced_purchase_count')::integer = 1, 'money workspace exposes the unpriced exception count');
select ok(public.get_staff_money_workspace() -> 'summaries' @> jsonb_build_array(jsonb_build_object('currency_code', 'SEP', 'paid_total_minor', 50)), 'money workspace totals known automatic spend');

select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($test$
  select * from public.staff_set_counted_stock_total(
    'ce000000-0000-0000-0000-000000000006', 3, current_date, 'Physical shelf count.',
    'e4000000-0000-0000-0000-000000000005'
  )
$test$, 'Owner can set an ordinary counted total');
select throws_ok($test$
  select * from public.staff_set_counted_stock_total(
    'ce000000-0000-0000-0000-000000000001', 40, current_date, 'Attempt to count player-sourced reserve.',
    'e4000000-0000-0000-0000-000000000006'
  )
$test$, '22023', 'counted_total_not_allowed', 'counted total cannot bypass player-sourced-only policy');

reset role;
select is((select transaction_type from public.inventory_transactions transaction join public.stock_activity_entries activity on activity.inventory_transaction_id = transaction.id where activity.source_request_id = 'e4000000-0000-0000-0000-000000000005'), 'reconciliation', 'counted total posts a reconciliation transaction');
select is((select previous_quantity from public.stock_activity_entries where source_request_id = 'e4000000-0000-0000-0000-000000000005'), 0::numeric, 'counted total preserves the previous derived quantity');
select is((select resulting_quantity from public.stock_activity_entries where source_request_id = 'e4000000-0000-0000-0000-000000000005'), 3::numeric, 'counted total preserves the resulting quantity');
select is((select sum(entry.quantity_delta) from public.inventory_ledger_entries entry join public.stock_activity_entries activity on activity.inventory_transaction_id = entry.inventory_transaction_id where activity.source_request_id = 'e4000000-0000-0000-0000-000000000005'), 0::numeric, 'reconciliation ledger transaction balances');
select throws_ok($test$
  update public.stock_activity_entries set note = 'rewrite' where source_request_id = 'e4000000-0000-0000-0000-000000000005'
$test$, '55000', 'posted_inventory_is_immutable', 'activity evidence is immutable');

select * from finish();
rollback;
