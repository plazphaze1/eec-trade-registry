begin;

select plan(12);

select has_function('public', 'staff_record_treasury_cash_infusion', array['text','bigint','date','text','text','text','uuid'], 'cash infusion command exists');
select has_function('public', 'get_staff_bank_customer_account_register', array['text','text','integer','integer'], 'customer-only bank register exists');
select ok(not has_function_privilege('anon', 'public.staff_record_treasury_cash_infusion(text,bigint,date,text,text,text,uuid)', 'execute'), 'anonymous callers cannot add Company cash');

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values
  ('bc100000-0000-4000-8000-000000000001','authenticated','authenticated','books.owner@example.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),now(),now()),
  ('bc100000-0000-4000-8000-000000000002','authenticated','authenticated','books.denied@example.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),now(),now());
insert into public.actor_profiles (id,auth_user_id,display_name,actor_type)
values
  ('bc200000-0000-4000-8000-000000000001','bc100000-0000-4000-8000-000000000001','Books Owner','staff'),
  ('bc200000-0000-4000-8000-000000000002','bc100000-0000-4000-8000-000000000002','Books Denied','staff');
insert into public.staff_assignments (actor_id,staff_role_id,effective_from,assignment_scope)
select 'bc200000-0000-4000-8000-000000000001', role.id, '2026-01-01T00:00:00Z', '{}'::jsonb
from public.staff_roles as role where role.code='owner';

select set_config('test.books_treasury_id',(select id::text from public.financial_accounts where account_type='company_treasury' and status='active' limit 1),true);
select set_config('test.books_clearing_id',(select id::text from public.financial_accounts where account_type='external' and status='active' limit 1),true);
select set_config('test.books_treasury_before',private.financial_account_balance(current_setting('test.books_treasury_id')::uuid)::text,true);
select set_config('test.books_clearing_before',private.financial_account_balance(current_setting('test.books_clearing_id')::uuid)::text,true);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bc100000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($test$
  select * from public.staff_record_treasury_cash_infusion('SEP',250,current_date,'OWNER-PURSE','Owner capital','Denied test','bc300000-0000-4000-8000-000000000001')
$test$,'42501','staff_permission_denied','unassigned identity cannot add cash');

select set_config('request.jwt.claims','{"sub":"bc100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($test$
  select * from public.staff_record_treasury_cash_infusion('SEP',250,current_date,'OWNER-PURSE','Owner capital','Record cash infusion','bc300000-0000-4000-8000-000000000002')
$test$,'Owner adds cash to Company Treasury');
select lives_ok($test$
  select * from public.staff_record_treasury_cash_infusion('SEP',250,current_date,'OWNER-PURSE','Owner capital','Retry cash infusion','bc300000-0000-4000-8000-000000000002')
$test$,'cash infusion retry is idempotent');
select lives_ok($test$select public.get_staff_bank_customer_account_register(null,null,50,0)$test$,'customer account register is readable');
reset role;

select is((select count(*)::integer from public.financial_transactions where source_request_id='bc300000-0000-4000-8000-000000000002'),1,'one infusion transaction is stored');
select is(private.financial_account_balance(current_setting('test.books_treasury_id')::uuid),current_setting('test.books_treasury_before')::bigint+250,'Treasury increased by the infusion');
select is(private.financial_account_balance(current_setting('test.books_clearing_id')::uuid),current_setting('test.books_clearing_before')::bigint-250,'outside-world clearing balances the infusion');
select ok(not exists(select 1 from public.financial_transactions t join public.financial_entries e on e.financial_transaction_id=t.id where t.source_request_id='bc300000-0000-4000-8000-000000000002' group by t.id having count(*)<>2 or sum(e.amount_minor)<>0),'infusion has exactly balanced entries');
select is((select memo from public.financial_transactions where source_request_id='bc300000-0000-4000-8000-000000000002'),'Owner capital','infusion note is preserved');

select * from finish();
rollback;
