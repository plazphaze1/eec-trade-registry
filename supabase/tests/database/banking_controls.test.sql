begin;

select plan(49);

select has_table('public', 'invoice_payment_reversals', 'invoice payment correction evidence exists');
select has_table('public', 'loan_payment_reversals', 'loan payment correction evidence exists');
select has_table('public', 'loan_late_fee_assessments', 'late fee evidence exists');
select has_table('public', 'financial_reconciliations', 'reconciliation register exists');
select has_table('public', 'financial_periods', 'financial period register exists');
select has_function('public', 'staff_reverse_latest_invoice_payment', array['uuid','bigint','text','uuid'], 'invoice correction command exists');
select has_function('public', 'staff_reverse_latest_loan_payment', array['uuid','bigint','text','uuid'], 'loan correction command exists');
select has_function('public', 'staff_assess_overdue_loan_fees', array['date','text','uuid'], 'late fee command exists');
select has_function('public', 'staff_record_financial_reconciliation', array['uuid','date','bigint','text','text','uuid'], 'reconciliation command exists');
select has_function('public', 'staff_close_financial_period', array['date','date','text','text','uuid'], 'period close command exists');
select ok((select relrowsecurity from pg_class where oid = 'public.financial_reconciliations'::regclass), 'reconciliations use RLS');
select ok(not has_table_privilege('authenticated', 'public.financial_period_account_balances', 'select'), 'authenticated callers cannot bypass period snapshots');
select ok(not has_function_privilege('anon', 'public.staff_close_financial_period(date,date,text,text,uuid)', 'execute'), 'anonymous callers cannot close books');

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values ('bb100000-0000-4000-8000-000000000001','authenticated','authenticated','controls.owner@example.test',
  extensions.crypt('test-password',extensions.gen_salt('bf')),now(),now(),now());
insert into public.actor_profiles (id,auth_user_id,display_name,actor_type)
values ('bb200000-0000-4000-8000-000000000001','bb100000-0000-4000-8000-000000000001','Controls Owner','staff');
insert into public.staff_assignments (actor_id,staff_role_id,effective_from,assignment_scope)
select 'bb200000-0000-4000-8000-000000000001', role.id, '2026-01-01T00:00:00Z', '{}'::jsonb
from public.staff_roles as role where role.code='owner';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bb100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($test$
  select * from public.staff_create_financial_account(
    'Controls Test Account','business','92000000-0000-0000-0000-000000000001','SEP',5000,
    'Banking controls fixture.','Open controls fixture.','bb300000-0000-4000-8000-000000000001')
$test$,'Owner opens the correction test account');
reset role;
select set_config('test.controls_account_id',(select id::text from public.financial_accounts where source_request_id='bb300000-0000-4000-8000-000000000001'),true);
select set_config('test.controls_treasury_id',(select id::text from public.financial_accounts where account_type='company_treasury' limit 1),true);

insert into public.orders (
  id,public_reference,ordering_party_id,dealer_authorization_id,jurisdiction_id,
  fulfillment_mode,status,currency_code,requested_by_actor_id,source_request_id
) values (
  'bb400000-0000-4000-8000-000000000001','EEC-ORD-CONTROLS-1','92000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001',
  'collection','approved','SEP','bb200000-0000-4000-8000-000000000001','bb400000-0000-4000-8000-000000000011'
);
insert into public.order_lines (
  id,order_id,line_number,item_id,item_code_snapshot,item_name_snapshot,unit_code_snapshot,
  quantity_requested,quantity_approved,status,unit_price_minor_snapshot,currency_code_snapshot,
  pricing_status,control_profile_code_snapshot,requires_staff_review_snapshot,
  requires_transaction_approval_snapshot,requires_serial_tracking_snapshot
) values (
  'bb410000-0000-4000-8000-000000000001','bb400000-0000-4000-8000-000000000001',1,
  'ce000000-0000-0000-0000-000000000006','TG-NOCTURNAL-DRESS','Nocturnal Dress','garment',
  2,2,'approved',500,'SEP','configured','ordinary',false,false,false
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bb100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($test$
  select * from public.staff_issue_order_invoice('bb400000-0000-4000-8000-000000000001',current_date,current_date+14,
    'Correction invoice.','Issue correction fixture.','bb300000-0000-4000-8000-000000000002')
$test$,'Owner issues an invoice for correction testing');
reset role;
select set_config('test.controls_invoice_id',(select id::text from public.sales_invoices where order_id='bb400000-0000-4000-8000-000000000001'),true);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bb100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok(format($test$
  select * from public.staff_record_invoice_payment(%L::uuid,%L::uuid,1000,current_date,
    'CONTROL-PAY','Payment to correct.','Record correction fixture payment.','bb300000-0000-4000-8000-000000000003')
$test$,current_setting('test.controls_invoice_id'),current_setting('test.controls_account_id')),'invoice payment posts before correction');
select lives_ok(format($test$
  select * from public.staff_reverse_latest_invoice_payment(%L::uuid,2,
    'Duplicate payment entry.','bb300000-0000-4000-8000-000000000004')
$test$,current_setting('test.controls_invoice_id')),'latest invoice payment can be safely undone');
select lives_ok(format($test$
  select * from public.staff_reverse_latest_invoice_payment(%L::uuid,2,
    'Duplicate payment entry.','bb300000-0000-4000-8000-000000000004')
$test$,current_setting('test.controls_invoice_id')),'invoice correction retry is idempotent');
select throws_ok(format($test$
  select * from public.staff_reverse_latest_invoice_payment(%L::uuid,3,
    'Nothing left to undo.','bb300000-0000-4000-8000-000000000005')
$test$,current_setting('test.controls_invoice_id')),'22023','invoice_has_no_reversible_payment','a corrected payment cannot be reversed twice');
reset role;

select is((select status from public.sales_invoices where id=current_setting('test.controls_invoice_id')::uuid),'open','invoice reopens after its payment is corrected');
select is((select private.financial_account_balance(current_setting('test.controls_account_id')::uuid)),5000::bigint,'invoice correction restores the payer balance');
select ok(exists(select 1 from public.invoice_payment_reversals),'invoice correction evidence identifies the original payment and reversal');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bb100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($test$
  select * from public.staff_create_loan_product('controls-loan','Controls Loan','Correction and fee terms.',1200,'monthly',1,12,100,null::bigint,3,25,
    'Create correction test loan terms.','bb300000-0000-4000-8000-000000000006')
$test$,'Owner creates fee-bearing loan terms');
reset role;
select set_config('test.controls_product_id',(select id::text from public.loan_products where code='controls-loan'),true);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bb100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok(format($test$
  select * from public.staff_originate_loan(%L::uuid,%L::uuid,1200,2,current_date-100,current_date-70,
    'Correction fixture.','Approve correction test loan.','bb300000-0000-4000-8000-000000000007')
$test$,current_setting('test.controls_product_id'),current_setting('test.controls_account_id')),'loan disbursement posts');
reset role;
select set_config('test.controls_loan_id',(select id::text from public.loans where source_request_id='bb300000-0000-4000-8000-000000000007'),true);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bb100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok(format($test$
  select * from public.staff_record_loan_payment(%L::uuid,200,current_date,
    'CONTROL-LOAN-PAY','Repayment to correct.','Record test repayment.','bb300000-0000-4000-8000-000000000008')
$test$,current_setting('test.controls_loan_id')),'loan repayment posts before correction');
select lives_ok(format($test$
  select * from public.staff_set_financial_account_status(%L::uuid,1,'frozen',
    'Test corrections after an account is frozen.','bb300000-0000-4000-8000-000000000018')
$test$,current_setting('test.controls_account_id')),'borrower account can be frozen before a correction');
select lives_ok(format($test$
  select * from public.staff_reverse_latest_loan_payment(%L::uuid,2,
    'Wrong repayment amount.','bb300000-0000-4000-8000-000000000009')
$test$,current_setting('test.controls_loan_id')),'latest loan payment can be safely undone');
select lives_ok(format($test$
  select * from public.staff_set_financial_account_status(%L::uuid,2,'active',
    'Correction test complete.','bb300000-0000-4000-8000-000000000019')
$test$,current_setting('test.controls_account_id')),'borrower account can be restored after the correction');
reset role;

select is((select coalesce(sum(principal_minor+interest_minor+fee_minor),0) from public.loan_payment_allocations),0::numeric,'negative correction allocations restore the unpaid schedule');
select is((select status from public.loans where id=current_setting('test.controls_loan_id')::uuid),'active','reversing a repayment reopens the loan');
select ok(exists(select 1 from public.loan_payment_reversals),'loan correction evidence identifies the original repayment and reversal');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bb100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($test$
  select * from public.staff_assess_overdue_loan_fees(current_date,'Run due late fees.','bb300000-0000-4000-8000-000000000010')
$test$,'overdue loan fees can be assessed in one batch');
select lives_ok($test$
  select * from public.staff_assess_overdue_loan_fees(current_date,'Run due late fees.','bb300000-0000-4000-8000-000000000010')
$test$,'late fee batch retry is idempotent');
select lives_ok($test$
  select * from public.staff_assess_overdue_loan_fees(current_date,'Check for newly due fees.','bb300000-0000-4000-8000-000000000011')
$test$,'a later fee run safely finds no duplicate fees');
reset role;

select is((select assessed_count from public.loan_fee_assessment_runs where source_request_id='bb300000-0000-4000-8000-000000000010'),2,'one fee is assessed for each overdue installment');
select is((select sum(amount_minor) from public.loan_late_fee_assessments),50::numeric,'fee evidence totals the configured charges');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bb100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok(format($test$
  select * from public.staff_record_financial_reconciliation(%L::uuid,current_date,6200,
    'Statement agrees.','Reconcile test account.','bb300000-0000-4000-8000-000000000012')
$test$,current_setting('test.controls_account_id')),'matching statement reconciliation is recorded');
select lives_ok(format($test$
  select * from public.staff_record_financial_reconciliation(%L::uuid,current_date,6199,
    'One Septim difference.','Record visible variance.','bb300000-0000-4000-8000-000000000013')
$test$,current_setting('test.controls_account_id')),'variance is recorded without changing the ledger');
reset role;

select is((select status from public.financial_reconciliations where source_request_id='bb300000-0000-4000-8000-000000000012'),'matched','matching reconciliation is classified correctly');
select is((select difference_minor from public.financial_reconciliations where source_request_id='bb300000-0000-4000-8000-000000000013'),-1::bigint,'variance retains the exact difference');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bb100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($test$
  select * from public.staff_close_financial_period(current_date-10,current_date-1,
    'Test close.','Close tested financial period.','bb300000-0000-4000-8000-000000000014')
$test$,'Owner closes a financial period');
reset role;
select set_config('test.controls_period_id',(select id::text from public.financial_periods where source_request_id='bb300000-0000-4000-8000-000000000014'),true);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bb100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok(format($test$
  select * from public.staff_post_cash_movement(%L::uuid,'deposit',10,current_date-5,'BACKDATE','Closed-period deposit.',
    'Try closed period.','bb300000-0000-4000-8000-000000000015')
$test$,current_setting('test.controls_treasury_id')),'23514','financial_period_is_closed','closed periods reject backdated money');
select lives_ok(format($test$
  select * from public.staff_reopen_financial_period(%L::uuid,1,
    'Correction is required.','bb300000-0000-4000-8000-000000000016')
$test$,current_setting('test.controls_period_id')),'Owner can reopen a period with a reason');
select lives_ok(format($test$
  select * from public.staff_post_cash_movement(%L::uuid,'deposit',10,current_date-5,'BACKDATE','Reopened-period deposit.',
    'Post authorized correction.','bb300000-0000-4000-8000-000000000017')
$test$,current_setting('test.controls_treasury_id')),'reopened period accepts the authorized correction');
select lives_ok($test$select public.get_staff_banking_controls()$test$,'banking controls projection is readable');
reset role;

select is((select status from public.financial_periods where id=current_setting('test.controls_period_id')::uuid),'reopened','period history preserves the reopen state');
select ok((select count(*) from public.financial_period_account_balances where financial_period_id=current_setting('test.controls_period_id')::uuid) >= 2,'period close freezes account balance snapshots');
select throws_ok($test$update public.financial_reconciliations set difference_minor=0 where status='variance'$test$,'55000','financial_evidence_is_immutable','reconciliation evidence cannot be rewritten');
select ok(not exists(select 1 from public.financial_transactions as transaction join public.financial_entries as entry on entry.financial_transaction_id=transaction.id group by transaction.id having count(*) < 2 or sum(entry.amount_minor) <> 0),'all original and correction transactions remain balanced');

select * from finish();
rollback;
