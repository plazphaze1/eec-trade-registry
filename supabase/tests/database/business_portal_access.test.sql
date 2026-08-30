begin;

select plan(27);

select has_table('public', 'business_portal_accounts', 'business portal account table exists');
select has_function('public', 'get_staff_business_portal_access', array['uuid'], 'owner access projection exists');
select has_function('public', 'get_business_portal_login_context', array['text'], 'private license login resolver exists');
select has_function('public', 'staff_activate_business_portal_account', array['uuid','uuid','text','uuid'], 'owner activation command exists');
select has_function('public', 'staff_disable_business_portal_account', array['uuid','text','uuid'], 'owner disable command exists');
select ok((select relrowsecurity from pg_class where oid = 'public.business_portal_accounts'::regclass), 'business portal accounts use RLS');
select ok(not has_table_privilege('authenticated', 'public.business_portal_accounts', 'select'), 'authenticated users cannot read credential bindings directly');
select ok(not has_function_privilege('anon', 'public.get_business_portal_login_context(text)', 'execute'), 'anonymous users cannot resolve login bindings');
select ok(not has_function_privilege('authenticated', 'public.get_business_portal_login_context(text)', 'execute'), 'ordinary sessions cannot resolve login bindings');
select ok(has_function_privilege('service_role', 'public.get_business_portal_login_context(text)', 'execute'), 'only the trusted server can resolve login bindings');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('ea000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'business.owner@example.test', extensions.crypt('test-password', extensions.gen_salt('bf')), now(), now(), now()),
  ('ea000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'business-92000000000000000000000000000001@accounts.eec.invalid', extensions.crypt('private-code-2026', extensions.gen_salt('bf')), now(), now(), now()),
  ('ea000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'business.denied@example.test', extensions.crypt('test-password', extensions.gen_salt('bf')), now(), now(), now());

insert into public.actor_profiles (id, auth_user_id, display_name, actor_type)
values
  ('eb000000-0000-4000-8000-000000000001', 'ea000000-0000-4000-8000-000000000001', 'Business Access Owner', 'staff'),
  ('eb000000-0000-4000-8000-000000000003', 'ea000000-0000-4000-8000-000000000003', 'Unassigned Staff', 'staff');

insert into public.staff_assignments (id, actor_id, staff_role_id, effective_from, assignment_scope)
select
  'ec000000-0000-4000-8000-000000000001',
  'eb000000-0000-4000-8000-000000000001',
  role.id,
  '2026-01-01T00:00:00Z',
  '{}'::jsonb
from public.staff_roles as role
where role.code = 'owner';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok(
  $test$select public.get_staff_business_portal_access('95000000-0000-0000-0000-000000000001')$test$,
  '42501', 'staff_permission_denied',
  'unassigned staff cannot view business access metadata'
);
select throws_ok(
  $test$select * from public.staff_activate_business_portal_account('95000000-0000-0000-0000-000000000001','ea000000-0000-4000-8000-000000000002','Attempt unauthorized activation','ed000000-0000-4000-8000-000000000001')$test$,
  '42501', 'staff_permission_denied',
  'unassigned staff cannot activate business access'
);

select set_config('request.jwt.claims', '{"sub":"ea000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(
  (public.get_staff_business_portal_access('95000000-0000-0000-0000-000000000001') ->> 'configured')::boolean,
  false,
  'owner sees that access has not been configured'
);
select lives_ok(
  $test$select * from public.staff_activate_business_portal_account('95000000-0000-0000-0000-000000000001','ea000000-0000-4000-8000-000000000002','Enable business access','ed000000-0000-4000-8000-000000000002')$test$,
  'owner can activate license-code business access'
);
select lives_ok(
  $test$select * from public.staff_activate_business_portal_account('95000000-0000-0000-0000-000000000001','ea000000-0000-4000-8000-000000000002','Enable business access','ed000000-0000-4000-8000-000000000002')$test$,
  'activation is idempotent for one request id'
);
select is(
  public.get_staff_business_portal_access('95000000-0000-0000-0000-000000000001') #>> '{eligible_license_references,0}',
  'LIC-DEMO-4Q2M',
  'owner sees the license number the business will use'
);

reset role;
select is((select count(*)::integer from public.business_portal_accounts where party_id = '92000000-0000-0000-0000-000000000001'), 1, 'one business account is stored');
select is((select count(*)::integer from public.actor_profiles where auth_user_id = 'ea000000-0000-4000-8000-000000000002' and actor_type = 'dealer' and status = 'active'), 1, 'activation creates an active business actor');
select is((select count(*)::integer from public.party_representatives where principal_party_id = '92000000-0000-0000-0000-000000000001' and revoked_at is null and authority_scope @> '{"portal.read":true,"order.create":true}'::jsonb), 1, 'activation grants the complete configured portal scope');
select is((select count(*)::integer from public.outbox_events where deduplication_key = 'business.portal_access_activated:ed000000-0000-4000-8000-000000000002'), 1, 'activation emits one outbox event');
select cmp_ok((select count(*)::integer from public.audit_log where request_id = 'ed000000-0000-4000-8000-000000000002'), '>=', 2, 'activation records audited authority changes');

set local role service_role;
select is((select auth_user_id from public.get_business_portal_login_context('LIC-DEMO-4Q2M')), 'ea000000-0000-4000-8000-000000000002'::uuid, 'trusted server resolves an active license to the internal auth user');
select is((select count(*)::integer from public.get_business_portal_login_context('LIC-NOT-REAL')), 0, 'unknown license numbers reveal no login context');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select lives_ok($test$select public.get_dealer_portal_overview()$test$, 'business session can open the existing order portal');

select set_config('request.jwt.claims', '{"sub":"ea000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $test$select * from public.staff_disable_business_portal_account('95000000-0000-0000-0000-000000000001','Disable business access','ed000000-0000-4000-8000-000000000003')$test$,
  'owner can disable business access'
);

set local role service_role;
select is((select count(*)::integer from public.get_business_portal_login_context('LIC-DEMO-4Q2M')), 0, 'disabled access cannot start a new session');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($test$select public.get_dealer_portal_overview()$test$, '28000', 'dealer_authentication_required', 'disabled access fails closed for an existing session');

select * from finish();
rollback;
