begin;

select plan(42);

select has_table('public', 'financial_accounts', 'financial account register exists');
select has_table('public', 'financial_transactions', 'immutable transaction journal exists');
select has_table('public', 'financial_entries', 'balanced entries exist');
select has_table('public', 'sales_invoices', 'order invoice register exists');
select has_table('public', 'loans', 'loan register exists');
select has_function('public', 'staff_create_financial_account', array['text','text','uuid','text','bigint','text','text','uuid'], 'staff account command exists');
select has_function('public', 'get_dealer_banking_workspace', array[]::text[], 'business banking projection exists');
select ok((select relrowsecurity from pg_class where oid = 'public.financial_accounts'::regclass), 'accounts use RLS');
select ok(not has_table_privilege('authenticated', 'public.financial_entries', 'select'), 'authenticated callers cannot bypass secured statements');
select ok(not has_function_privilege('anon', 'public.staff_transfer_funds(uuid,uuid,bigint,date,text,text,text,uuid)', 'execute'), 'anonymous callers cannot move money');
select is((select count(*)::integer from public.permission_scopes where code like 'finance.%' and code in (
  'finance.bank.read','finance.transaction.post','finance.invoice.manage','finance.account.manage','finance.transaction.reverse'
)), 5, 'banking permissions are configured');
select ok(exists(select 1 from public.staff_role_permissions rp join public.staff_roles r on r.id=rp.staff_role_id join public.permission_scopes p on p.id=rp.permission_scope_id where r.code='owner' and p.code='finance.account.manage'), 'Owner can administer accounts');
select ok(not exists(select 1 from public.staff_role_permissions rp join public.staff_roles r on r.id=rp.staff_role_id join public.permission_scopes p on p.id=rp.permission_scope_id where r.code='agent' and p.code='finance.account.manage'), 'Agent cannot administer accounts');

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values
  ('ba100000-0000-4000-8000-000000000001','authenticated','authenticated','bank.owner@example.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),now(),now()),
  ('ba100000-0000-4000-8000-000000000002','authenticated','authenticated','bank.denied@example.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),now(),now()),
  ('ba100000-0000-4000-8000-000000000003','authenticated','authenticated','bank.dealer@example.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),now(),now());

insert into public.actor_profiles (id,auth_user_id,display_name,actor_type)
values
  ('ba200000-0000-4000-8000-000000000001','ba100000-0000-4000-8000-000000000001','Bank Owner','staff'),
  ('ba200000-0000-4000-8000-000000000002','ba100000-0000-4000-8000-000000000002','Bank Denied','staff'),
  ('ba200000-0000-4000-8000-000000000003','ba100000-0000-4000-8000-000000000003','Harbor Treasurer','dealer');

insert into public.staff_assignments (actor_id,staff_role_id,effective_from,assignment_scope)
select 'ba200000-0000-4000-8000-000000000001', role.id, '2026-01-01T00:00:00Z', '{}'::jsonb
from public.staff_roles as role where role.code='owner';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ba100000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($test$select public.get_staff_money_workspace()$test$, '42501', 'staff_permission_denied', 'unassigned staff cannot read the bank');

select set_config('request.jwt.claims','{"sub":"ba100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($test$
  select * from public.staff_create_financial_account(
    'Harbor Supply Operating','business','92000000-0000-0000-0000-000000000001','SEP',3000,
    'Primary business account.','Open tested business account.','ba300000-0000-4000-8000-000000000001'
  )
$test$, 'Owner opens a business account');
select lives_ok($test$
  select * from public.staff_create_financial_account(
    'Harbor Supply Operating','business','92000000-0000-0000-0000-000000000001','SEP',3000,
    'Primary business account.','Retry tested business account.','ba300000-0000-4000-8000-000000000001'
  )
$test$, 'account opening retry is idempotent');
reset role;

select is((select count(*)::integer from public.financial_accounts where source_request_id='ba300000-0000-4000-8000-000000000001'),1,'one business account is stored');
select set_config('test.bank_account_id',(select id::text from public.financial_accounts where source_request_id='ba300000-0000-4000-8000-000000000001'),true);
select set_config('test.treasury_id',(select id::text from public.financial_accounts where account_type='company_treasury' limit 1),true);
select set_config('test.treasury_reference',(select public_reference from public.financial_accounts where account_type='company_treasury' limit 1),true);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ba100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok(format($test$
  select * from public.staff_post_cash_movement(
    %L::uuid,
    'deposit',10000,current_date,'OPENING-CASH','Opening Company funds.','Record tested Treasury funds.','ba300000-0000-4000-8000-000000000002'
  )
$test$,current_setting('test.treasury_id')), 'Owner records Treasury funds');
select lives_ok(format($test$
  select * from public.staff_place_account_hold(%L::uuid,500,current_timestamp + interval '7 days',null,null,
    'Pending trade.','ba300000-0000-4000-8000-000000000003')
$test$,current_setting('test.bank_account_id')),'hold reserves available funds');
select throws_ok(format($test$
  select * from public.staff_transfer_funds(%L::uuid,%L::uuid,2800,current_date,
    'HOLD-OVERSPEND','Too much while held.','Test hold enforcement.','ba300000-0000-4000-8000-000000000004')
$test$,current_setting('test.bank_account_id'),current_setting('test.treasury_id')),'23514','financial_insufficient_funds','holds prevent overspending');
reset role;
select set_config('test.hold_id',(select id::text from public.financial_account_holds where source_request_id='ba300000-0000-4000-8000-000000000003'),true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ba100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok(format($test$
  select * from public.staff_release_account_hold(
    %L::uuid,1,
    'Trade cancelled.','ba300000-0000-4000-8000-000000000005')
$test$,current_setting('test.hold_id')),'hold can be released');
reset role;

insert into public.orders (
  id,public_reference,ordering_party_id,dealer_authorization_id,jurisdiction_id,
  fulfillment_mode,status,currency_code,requested_by_actor_id,source_request_id
) values (
  'ba400000-0000-4000-8000-000000000001','EEC-ORD-BANK-1','92000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001',
  'collection','approved','SEP','ba200000-0000-4000-8000-000000000001','ba400000-0000-4000-8000-000000000011'
);
insert into public.order_lines (
  id,order_id,line_number,item_id,item_code_snapshot,item_name_snapshot,unit_code_snapshot,
  quantity_requested,quantity_approved,status,unit_price_minor_snapshot,currency_code_snapshot,
  pricing_status,control_profile_code_snapshot,requires_staff_review_snapshot,
  requires_transaction_approval_snapshot,requires_serial_tracking_snapshot
) values (
  'ba410000-0000-4000-8000-000000000001','ba400000-0000-4000-8000-000000000001',1,
  'ce000000-0000-0000-0000-000000000006','TG-NOCTURNAL-DRESS','Nocturnal Dress','garment',
  2,2,'approved',500,'SEP','configured','ordinary',false,false,false
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ba100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($test$
  select * from public.staff_issue_order_invoice('ba400000-0000-4000-8000-000000000001',current_date,current_date+14,
    'Test invoice.','Issue tested order invoice.','ba300000-0000-4000-8000-000000000006')
$test$,'priced approved order becomes an invoice');
reset role;
select set_config('test.invoice_id',(select id::text from public.sales_invoices where order_id='ba400000-0000-4000-8000-000000000001'),true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ba100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok(format($test$
  select * from public.staff_record_invoice_payment(
    %L::uuid,%L::uuid,
    400,current_date,'PAY-ONE','First payment.','Record first partial payment.','ba300000-0000-4000-8000-000000000007')
$test$,current_setting('test.invoice_id'),current_setting('test.bank_account_id')),'partial invoice payment posts');
select lives_ok(format($test$
  select * from public.staff_record_invoice_payment(
    %L::uuid,%L::uuid,
    600,current_date,'PAY-TWO','Final payment.','Record final payment.','ba300000-0000-4000-8000-000000000008')
$test$,current_setting('test.invoice_id'),current_setting('test.bank_account_id')),'a second payment can settle the invoice');
reset role;

select is((select count(*)::integer from public.sales_invoice_payments),2,'partial payments are independently preserved');
select is((select status from public.sales_invoices where order_id='ba400000-0000-4000-8000-000000000001'),'paid','invoice becomes paid only at full settlement');
select is((select sum(amount_minor) from public.sales_invoice_payments),1000::numeric,'invoice payment total equals frozen invoice total');
select ok(not exists(select 1 from public.financial_transactions t join public.financial_entries e on e.financial_transaction_id=t.id group by t.id having count(*) < 2 or sum(e.amount_minor) <> 0),'every financial transaction is balanced');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ba100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($test$
  select * from public.staff_create_loan_product('standard-test','Standard Test Loan','Test terms.',1200,'monthly',1,24,100,null::bigint,3,0,
    'Create tested lending terms.','ba300000-0000-4000-8000-000000000009')
$test$,'Owner creates reusable loan terms');
reset role;
select set_config('test.loan_product_id',(select id::text from public.loan_products where code='standard-test'),true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ba100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok(format($test$
  select * from public.staff_originate_loan(
    %L::uuid,%L::uuid,1200,6,current_date,current_date+30,
    'Working capital.','Approve tested loan.','ba300000-0000-4000-8000-000000000010')
$test$,current_setting('test.loan_product_id'),current_setting('test.bank_account_id')),'loan approval disburses real funds');
reset role;

select set_config('test.loan_id',(select id::text from public.loans where source_request_id='ba300000-0000-4000-8000-000000000010'),true);

select is((select count(*)::integer from public.loan_installments where loan_id=(select id from public.loans where source_request_id='ba300000-0000-4000-8000-000000000010')),6,'loan schedule has the requested installments');
select is((select sum(principal_due_minor) from public.loan_installments where loan_id=(select id from public.loans where source_request_id='ba300000-0000-4000-8000-000000000010')),1200::numeric,'scheduled principal exactly equals disbursed principal');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ba100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok(format($test$
  select * from public.staff_record_loan_payment(
    %L::uuid,200,current_date+30,
    'LOAN-PAY-ONE','Scheduled repayment.','Record tested loan payment.','ba300000-0000-4000-8000-000000000011')
$test$,current_setting('test.loan_id')),'loan repayment posts and allocates');
reset role;
select set_config('test.loan_payment_transaction_id',(select financial_transaction_id::text from public.loan_payments where source_request_id='ba300000-0000-4000-8000-000000000011'),true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ba100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok(format($test$
  select * from public.staff_reverse_financial_transaction(
    %L::uuid,
    'Unsafe generic reversal attempt.','ba300000-0000-4000-8000-000000000012')
$test$,current_setting('test.loan_payment_transaction_id')),'22023','linked_payment_requires_domain_refund','linked loan payment cannot be generically reversed');
select lives_ok($test$select public.get_staff_bank_account_register('Harbor Supply',null,50,0)$test$,'account register supports server-side search');
reset role;

select is((select sum(principal_minor+interest_minor+fee_minor) from public.loan_payment_allocations),200::numeric,'repayment allocation equals the posted payment');
select throws_ok($test$update public.financial_entries set amount_minor=1 where id=(select id from public.financial_entries limit 1)$test$,'55000','financial_evidence_is_immutable','posted entries cannot be rewritten');
select ok(exists(select 1 from public.audit_log where record_type='public.sales_invoices' and request_id='ba300000-0000-4000-8000-000000000006' and actor_id='ba200000-0000-4000-8000-000000000001'),'invoice audit identifies actor and request');
select ok(exists(select 1 from public.outbox_events where deduplication_key='finance.loan_originated:ba300000-0000-4000-8000-000000000010'),'loan origination emits durable integration work');

insert into public.business_portal_accounts (
  party_id,actor_id,created_by_actor_id,updated_by_actor_id,source_request_id,last_request_id
) values (
  '92000000-0000-0000-0000-000000000001','ba200000-0000-4000-8000-000000000003',
  'ba200000-0000-4000-8000-000000000001','ba200000-0000-4000-8000-000000000001',
  'ba500000-0000-4000-8000-000000000001','ba500000-0000-4000-8000-000000000002'
);
insert into public.party_representatives (
  principal_party_id,actor_id,role_definition_id,authority_scope,verified_at,verified_by
) select '92000000-0000-0000-0000-000000000001','ba200000-0000-4000-8000-000000000003',role.id,
  role.default_scope,now(),'ba200000-0000-4000-8000-000000000001'
from public.representative_role_definitions as role where role.code='portal-representative';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ba100000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select lives_ok($test$select public.get_dealer_banking_workspace()$test$,'licensed business representative can read its bank workspace');
select lives_ok(format($test$
  select * from public.dealer_transfer_funds(%L::uuid,
    %L,50,current_date,
    'Business transfer to Company.','ba500000-0000-4000-8000-000000000003')
$test$,current_setting('test.bank_account_id'),current_setting('test.treasury_reference')),'business representative can transfer owned funds');
select throws_ok(format($test$
  select * from public.dealer_transfer_funds(
    %L::uuid,'EEC-ACC-NOT-USED',1,current_date,
    'Unauthorized source.','ba500000-0000-4000-8000-000000000004')
$test$,current_setting('test.treasury_id')),'22023','dealer_source_account_invalid','business representative cannot spend another party account');
reset role;

select * from finish();
rollback;
