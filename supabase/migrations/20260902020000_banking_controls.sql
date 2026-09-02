-- Operational controls for the authoritative fictional-currency bank.
-- Corrections append evidence; reconciliations never overwrite balances.

insert into public.reference_sequences (document_type, prefix, next_value, padding)
values
  ('financial_reconciliation', 'EEC-REC', 1001, 4),
  ('financial_period', 'EEC-PER', 1001, 4)
on conflict (document_type) do nothing;

create or replace function private.allocate_finance_reference(p_document_type text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare sequence_record record; allocated text;
begin
  if p_document_type not in (
    'financial_account', 'financial_transaction', 'sales_invoice', 'account_hold', 'loan',
    'financial_reconciliation', 'financial_period'
  ) then
    raise exception using errcode = '22023', message = 'finance_reference_type_invalid';
  end if;
  select sequence.prefix, sequence.next_value, sequence.padding into strict sequence_record
  from public.reference_sequences as sequence
  where sequence.document_type = p_document_type and sequence.active for update;
  allocated := sequence_record.prefix || '-' || lpad(sequence_record.next_value::text, sequence_record.padding, '0');
  update public.reference_sequences as sequence
  set next_value = sequence.next_value + 1
  where sequence.document_type = p_document_type;
  return allocated;
exception when no_data_found then
  raise exception using errcode = '55000', message = 'finance_reference_sequence_unavailable';
end;
$$;

create table public.invoice_payment_reversals (
  id uuid primary key default extensions.gen_random_uuid(),
  sales_invoice_payment_id uuid not null unique references public.sales_invoice_payments(id) on delete restrict,
  reversal_transaction_id uuid not null unique references public.financial_transactions(id) on delete restrict,
  reason text not null check (btrim(reason) <> '' and char_length(reason) <= 500),
  reversed_by_actor_id uuid not null references public.actor_profiles(id) on delete restrict,
  source_request_id uuid not null unique,
  created_at timestamptz not null default statement_timestamp()
);

create table public.loan_payment_reversals (
  id uuid primary key default extensions.gen_random_uuid(),
  loan_payment_id uuid not null unique references public.loan_payments(id) on delete restrict,
  reversal_transaction_id uuid not null unique references public.financial_transactions(id) on delete restrict,
  reason text not null check (btrim(reason) <> '' and char_length(reason) <= 500),
  reversed_by_actor_id uuid not null references public.actor_profiles(id) on delete restrict,
  source_request_id uuid not null unique,
  created_at timestamptz not null default statement_timestamp()
);

alter table public.loan_payment_allocations
  drop constraint if exists loan_payment_allocations_loan_payment_id_loan_installment_id_key,
  drop constraint if exists loan_payment_allocations_loan_payment_id_loan_installment_i_key,
  drop constraint if exists loan_payment_allocations_principal_minor_check,
  drop constraint if exists loan_payment_allocations_interest_minor_check,
  drop constraint if exists loan_payment_allocations_fee_minor_check,
  drop constraint if exists loan_payment_allocations_check;

alter table public.loan_payment_allocations
  add column reverses_allocation_id uuid unique references public.loan_payment_allocations(id) on delete restrict,
  add constraint loan_payment_allocation_direction_check check (
    (reverses_allocation_id is null and principal_minor >= 0 and interest_minor >= 0 and fee_minor >= 0
      and principal_minor + interest_minor + fee_minor > 0)
    or
    (reverses_allocation_id is not null and principal_minor <= 0 and interest_minor <= 0 and fee_minor <= 0
      and principal_minor + interest_minor + fee_minor < 0)
  );

create unique index loan_payment_allocations_original_idx
  on public.loan_payment_allocations(loan_payment_id, loan_installment_id)
  where reverses_allocation_id is null;

create table public.loan_fee_assessment_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  assessed_as_of date not null,
  assessed_count integer not null default 0 check (assessed_count >= 0),
  total_amount_minor bigint not null default 0 check (total_amount_minor >= 0),
  reason text not null check (btrim(reason) <> '' and char_length(reason) <= 500),
  assessed_by_actor_id uuid not null references public.actor_profiles(id) on delete restrict,
  source_request_id uuid not null unique,
  created_at timestamptz not null default statement_timestamp()
);

create table public.loan_late_fee_assessments (
  id uuid primary key default extensions.gen_random_uuid(),
  assessment_run_id uuid not null references public.loan_fee_assessment_runs(id) on delete restrict deferrable initially deferred,
  loan_installment_id uuid not null unique references public.loan_installments(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  assessed_on date not null,
  created_at timestamptz not null default statement_timestamp()
);

create table public.financial_reconciliations (
  id uuid primary key default extensions.gen_random_uuid(),
  public_reference text not null unique,
  financial_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  statement_through date not null,
  statement_balance_minor bigint not null,
  ledger_balance_minor bigint not null,
  difference_minor bigint not null,
  status text not null check (status in ('matched', 'variance')),
  note text not null default '' check (char_length(note) <= 1000),
  recorded_by_actor_id uuid not null references public.actor_profiles(id) on delete restrict,
  source_request_id uuid not null unique,
  created_at timestamptz not null default statement_timestamp(),
  check (public_reference = private.normalize_registry_reference(public_reference)),
  check (difference_minor = statement_balance_minor - ledger_balance_minor),
  check ((status = 'matched' and difference_minor = 0) or (status = 'variance' and difference_minor <> 0))
);
create index financial_reconciliations_account_idx
  on public.financial_reconciliations(financial_account_id, statement_through desc, created_at desc);

create table public.financial_periods (
  id uuid primary key default extensions.gen_random_uuid(),
  public_reference text not null unique,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'closed' check (status in ('closed', 'reopened')),
  note text not null default '' check (char_length(note) <= 1000),
  closed_by_actor_id uuid not null references public.actor_profiles(id) on delete restrict,
  source_request_id uuid not null unique,
  closed_at timestamptz not null default statement_timestamp(),
  reopened_at timestamptz,
  reopened_by_actor_id uuid references public.actor_profiles(id) on delete restrict,
  reopen_reason text check (reopen_reason is null or char_length(reopen_reason) <= 500),
  reopen_request_id uuid unique,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (public_reference = private.normalize_registry_reference(public_reference)),
  check (ends_on >= starts_on),
  check ((status = 'closed' and reopened_at is null and reopened_by_actor_id is null and reopen_reason is null)
    or (status = 'reopened' and reopened_at is not null and reopened_by_actor_id is not null
      and btrim(coalesce(reopen_reason, '')) <> ''))
);
create index financial_periods_dates_idx on public.financial_periods(starts_on, ends_on, status);

create table public.financial_period_account_balances (
  id uuid primary key default extensions.gen_random_uuid(),
  financial_period_id uuid not null references public.financial_periods(id) on delete restrict,
  financial_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  account_reference_snapshot text not null,
  account_name_snapshot text not null,
  balance_minor bigint not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (financial_period_id, financial_account_id)
);

create trigger financial_periods_set_updated_at before update on public.financial_periods
for each row execute function private.set_updated_at();

create trigger invoice_payment_reversals_audit after insert or update or delete on public.invoice_payment_reversals
for each row execute function private.capture_audit_row();
create trigger loan_payment_reversals_audit after insert or update or delete on public.loan_payment_reversals
for each row execute function private.capture_audit_row();
create trigger loan_fee_assessment_runs_audit after insert or update or delete on public.loan_fee_assessment_runs
for each row execute function private.capture_audit_row();
create trigger loan_late_fee_assessments_audit after insert or update or delete on public.loan_late_fee_assessments
for each row execute function private.capture_audit_row();
create trigger financial_reconciliations_audit after insert or update or delete on public.financial_reconciliations
for each row execute function private.capture_audit_row();
create trigger financial_periods_audit after insert or update or delete on public.financial_periods
for each row execute function private.capture_audit_row();
create trigger financial_period_account_balances_audit after insert or update or delete on public.financial_period_account_balances
for each row execute function private.capture_audit_row();

create trigger invoice_payment_reversals_immutable before update or delete on public.invoice_payment_reversals
for each row execute function private.reject_financial_evidence_change();
create trigger loan_payment_reversals_immutable before update or delete on public.loan_payment_reversals
for each row execute function private.reject_financial_evidence_change();
create trigger loan_fee_assessment_runs_immutable before update or delete on public.loan_fee_assessment_runs
for each row execute function private.reject_financial_evidence_change();
create trigger loan_late_fee_assessments_immutable before update or delete on public.loan_late_fee_assessments
for each row execute function private.reject_financial_evidence_change();
create trigger financial_reconciliations_immutable before update or delete on public.financial_reconciliations
for each row execute function private.reject_financial_evidence_change();
create trigger financial_period_account_balances_immutable before update or delete on public.financial_period_account_balances
for each row execute function private.reject_financial_evidence_change();

alter table public.invoice_payment_reversals enable row level security;
alter table public.loan_payment_reversals enable row level security;
alter table public.loan_fee_assessment_runs enable row level security;
alter table public.loan_late_fee_assessments enable row level security;
alter table public.financial_reconciliations enable row level security;
alter table public.financial_periods enable row level security;
alter table public.financial_period_account_balances enable row level security;

create function private.financial_account_balance_through(p_account_id uuid, p_through date)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum(entry.amount_minor), 0)::bigint
  from public.financial_entries as entry
  join public.financial_transactions as transaction
    on transaction.id = entry.financial_transaction_id
  where entry.financial_account_id = p_account_id
    and transaction.occurred_on <= p_through;
$$;

create function private.reject_closed_financial_period_posting()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.financial_periods as period
    where period.status = 'closed' and new.occurred_on between period.starts_on and period.ends_on
  ) then
    raise exception using errcode = '23514', message = 'financial_period_is_closed';
  end if;
  return new;
end;
$$;

create trigger financial_transactions_closed_period
before insert on public.financial_transactions
for each row execute function private.reject_closed_financial_period_posting();

create function private.post_exact_financial_reversal(
  p_original_transaction_id uuid, p_occurred_on date, p_memo text,
  p_source_record_type text, p_source_record_id uuid, p_source_reference text,
  p_actor_id uuid, p_request_id uuid
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare existing_id uuid; original public.financial_transactions%rowtype; created_id uuid;
begin
  select transaction.id into existing_id from public.financial_transactions as transaction
  where transaction.source_request_id = p_request_id;
  if found then return existing_id; end if;
  select transaction.* into original from public.financial_transactions as transaction
  where transaction.id = p_original_transaction_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'financial_transaction_not_found'; end if;
  if exists (select 1 from public.financial_transactions as reversal
    where reversal.reverses_transaction_id = original.id) then
    raise exception using errcode = '23514', message = 'financial_transaction_already_reversed';
  end if;
  if p_occurred_on is null or btrim(coalesce(p_memo, '')) = '' then
    raise exception using errcode = '22023', message = 'financial_reversal_invalid';
  end if;
  insert into public.financial_transactions (
    public_reference, transaction_type, currency_id, occurred_on, memo, external_reference,
    source_record_type, source_record_id, source_reference, reverses_transaction_id,
    posted_by_actor_id, source_request_id
  ) values (
    private.allocate_finance_reference('financial_transaction'), 'reversal', original.currency_id,
    p_occurred_on, btrim(p_memo), original.public_reference,
    p_source_record_type, p_source_record_id, nullif(btrim(coalesce(p_source_reference, '')), ''),
    original.id, p_actor_id, p_request_id
  ) returning id into created_id;
  insert into public.financial_entries (
    financial_transaction_id, financial_account_id, amount_minor, entry_memo
  ) select created_id, entry.financial_account_id, -entry.amount_minor,
    'Reversal of ' || original.public_reference
  from public.financial_entries as entry where entry.financial_transaction_id = original.id;
  return created_id;
end;
$$;

create function public.staff_reverse_latest_invoice_payment(
  p_invoice_id uuid, p_expected_version bigint, p_reason text, p_request_id uuid
)
returns table (invoice_id uuid, invoice_status text, paid_amount_minor bigint, balance_due_minor bigint, version bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; invoice_record public.sales_invoices%rowtype; payment_record record;
  reversal_id uuid; paid_total bigint; next_status text; next_version bigint;
begin
  actor_id := private.set_staff_audit_context('finance.transaction.reverse', p_reason, p_request_id);
  if exists (select 1 from public.invoice_payment_reversals as correction where correction.source_request_id = p_request_id) then
    select invoice.* into strict invoice_record from public.sales_invoices as invoice where invoice.id = p_invoice_id;
    select coalesce(sum(payment.amount_minor), 0)::bigint into paid_total
    from public.sales_invoice_payments as payment
    join public.financial_transactions as transaction on transaction.id = payment.financial_transaction_id
    where payment.sales_invoice_id = invoice_record.id
      and not exists (select 1 from public.financial_transactions as reversal
        where reversal.reverses_transaction_id = transaction.id);
    return query select invoice_record.id, invoice_record.status, paid_total,
      invoice_record.total_amount_minor - paid_total, invoice_record.version;
    return;
  end if;
  select invoice.* into invoice_record from public.sales_invoices as invoice where invoice.id = p_invoice_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'invoice_not_found'; end if;
  if invoice_record.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'invoice_version_conflict';
  end if;
  select payment.id, payment.amount_minor, payment.financial_transaction_id, transaction.public_reference
  into payment_record
  from public.sales_invoice_payments as payment
  join public.financial_transactions as transaction on transaction.id = payment.financial_transaction_id
  where payment.sales_invoice_id = invoice_record.id
    and not exists (select 1 from public.financial_transactions as reversal
      where reversal.reverses_transaction_id = transaction.id)
  order by transaction.posted_at desc, payment.id desc limit 1;
  if not found then raise exception using errcode = '22023', message = 'invoice_has_no_reversible_payment'; end if;
  reversal_id := private.post_exact_financial_reversal(
    payment_record.financial_transaction_id, current_date,
    'Invoice payment correction for ' || invoice_record.public_reference || ': ' || btrim(p_reason),
    'order_invoice', invoice_record.id, invoice_record.public_reference, actor_id, p_request_id
  );
  insert into public.invoice_payment_reversals (
    sales_invoice_payment_id, reversal_transaction_id, reason, reversed_by_actor_id, source_request_id
  ) values (payment_record.id, reversal_id, btrim(p_reason), actor_id, p_request_id);
  select coalesce(sum(payment.amount_minor), 0)::bigint into paid_total
  from public.sales_invoice_payments as payment
  join public.financial_transactions as transaction on transaction.id = payment.financial_transaction_id
  where payment.sales_invoice_id = invoice_record.id
    and not exists (select 1 from public.financial_transactions as reversal
      where reversal.reverses_transaction_id = transaction.id);
  next_status := case when paid_total = invoice_record.total_amount_minor then 'paid'
    when paid_total > 0 then 'partially_paid' else 'open' end;
  update public.sales_invoices as invoice
  set status = next_status, version = invoice.version + 1
  where invoice.id = invoice_record.id returning invoice.version into next_version;
  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload, deduplication_key)
  values ('finance.invoice_payment_reversed', 'sales_invoice', invoice_record.id,
    jsonb_build_object('public_reference', invoice_record.public_reference,
      'amount_minor', payment_record.amount_minor, 'status', next_status),
    'finance.invoice_payment_reversed:' || p_request_id::text);
  return query select invoice_record.id, next_status, paid_total,
    invoice_record.total_amount_minor - paid_total, next_version;
end;
$$;

create function public.staff_reverse_latest_loan_payment(
  p_loan_id uuid, p_expected_version bigint, p_reason text, p_request_id uuid
)
returns table (loan_id uuid, loan_status text, remaining_due_minor bigint, version bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; loan_record public.loans%rowtype; payment_record record;
  reversal_id uuid; total_remaining bigint;
  next_status text; next_version bigint;
begin
  actor_id := private.set_staff_audit_context('finance.transaction.reverse', p_reason, p_request_id);
  if exists (select 1 from public.loan_payment_reversals as correction where correction.source_request_id = p_request_id) then
    select loan.* into strict loan_record from public.loans as loan where loan.id = p_loan_id;
    select coalesce(sum(scheduled.principal_due_minor + scheduled.interest_due_minor + scheduled.fee_due_minor
      - coalesce(paid.total_paid, 0)), 0)::bigint into total_remaining
    from public.loan_installments as scheduled
    left join lateral (select sum(allocation.principal_minor + allocation.interest_minor + allocation.fee_minor)::bigint as total_paid
      from public.loan_payment_allocations as allocation where allocation.loan_installment_id = scheduled.id) as paid on true
    where scheduled.loan_id = loan_record.id and scheduled.status <> 'waived';
    return query select loan_record.id, loan_record.status, total_remaining, loan_record.version;
    return;
  end if;
  select loan.* into loan_record from public.loans as loan where loan.id = p_loan_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'loan_not_found'; end if;
  if loan_record.version <> p_expected_version then raise exception using errcode = '40001', message = 'loan_version_conflict'; end if;
  if loan_record.status in ('written_off', 'cancelled') then raise exception using errcode = '22023', message = 'loan_payment_not_reversible'; end if;
  select payment.id, payment.amount_minor, payment.financial_transaction_id, transaction.public_reference
  into payment_record from public.loan_payments as payment
  join public.financial_transactions as transaction on transaction.id = payment.financial_transaction_id
  where payment.loan_id = loan_record.id
    and not exists (select 1 from public.financial_transactions as reversal where reversal.reverses_transaction_id = transaction.id)
  order by transaction.posted_at desc, payment.id desc limit 1;
  if not found then raise exception using errcode = '22023', message = 'loan_has_no_reversible_payment'; end if;
  reversal_id := private.post_exact_financial_reversal(
    payment_record.financial_transaction_id, current_date,
    'Loan payment correction for ' || loan_record.public_reference || ': ' || btrim(p_reason),
    'loan', loan_record.id, loan_record.public_reference, actor_id, p_request_id
  );
  insert into public.loan_payment_reversals (
    loan_payment_id, reversal_transaction_id, reason, reversed_by_actor_id, source_request_id
  ) values (payment_record.id, reversal_id, btrim(p_reason), actor_id, p_request_id);
  insert into public.loan_payment_allocations (
    loan_payment_id, loan_installment_id, principal_minor, interest_minor, fee_minor, reverses_allocation_id
  ) select allocation.loan_payment_id, allocation.loan_installment_id,
    -allocation.principal_minor, -allocation.interest_minor, -allocation.fee_minor, allocation.id
  from public.loan_payment_allocations as allocation
  where allocation.loan_payment_id = payment_record.id and allocation.reverses_allocation_id is null;
  update public.loan_installments as scheduled set
    status = case when scheduled.status = 'waived' then 'waived'
      when scheduled.principal_due_minor + scheduled.interest_due_minor + scheduled.fee_due_minor
        - coalesce(paid.total_paid, 0) = 0 then 'paid'
      when coalesce(paid.total_paid, 0) > 0 then 'partially_paid'
      when scheduled.due_on < current_date then 'overdue' else 'scheduled' end,
    version = scheduled.version + 1
  from (select target.id, sum(allocation.principal_minor + allocation.interest_minor + allocation.fee_minor)::bigint as total_paid
    from public.loan_installments as target
    left join public.loan_payment_allocations as allocation on allocation.loan_installment_id = target.id
    where target.loan_id = loan_record.id group by target.id) as paid
  where scheduled.id = paid.id;
  select coalesce(sum(scheduled.principal_due_minor + scheduled.interest_due_minor + scheduled.fee_due_minor
    - coalesce(paid.total_paid, 0)), 0)::bigint into total_remaining
  from public.loan_installments as scheduled
  left join lateral (select sum(allocation.principal_minor + allocation.interest_minor + allocation.fee_minor)::bigint as total_paid
    from public.loan_payment_allocations as allocation where allocation.loan_installment_id = scheduled.id) as paid on true
  where scheduled.loan_id = loan_record.id and scheduled.status <> 'waived';
  next_status := case when total_remaining = 0 then 'paid'
    when loan_record.status = 'defaulted' then 'defaulted' else 'active' end;
  update public.loans as loan set status = next_status,
    defaulted_at = case when next_status = 'defaulted' then loan.defaulted_at else null end,
    default_reason = case when next_status = 'defaulted' then loan.default_reason else null end,
    version = loan.version + 1
  where loan.id = loan_record.id returning loan.version into next_version;
  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload, deduplication_key)
  values ('finance.loan_payment_reversed', 'loan', loan_record.id,
    jsonb_build_object('public_reference', loan_record.public_reference,
      'amount_minor', payment_record.amount_minor, 'remaining_due_minor', total_remaining, 'status', next_status),
    'finance.loan_payment_reversed:' || p_request_id::text);
  return query select loan_record.id, next_status, total_remaining, next_version;
end;
$$;

create function public.staff_assess_overdue_loan_fees(
  p_as_of date, p_reason text, p_request_id uuid
)
returns table (assessment_run_id uuid, assessed_count integer, total_amount_minor bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; existing public.loan_fee_assessment_runs%rowtype;
  run_id uuid := extensions.gen_random_uuid();
  target record; created_count integer := 0; created_total bigint := 0;
begin
  actor_id := private.set_staff_audit_context('finance.account.manage', p_reason, p_request_id);
  select run.* into existing from public.loan_fee_assessment_runs as run where run.source_request_id = p_request_id;
  if found then return query select existing.id, existing.assessed_count, existing.total_amount_minor; return; end if;
  if p_as_of is null or p_as_of > current_date then raise exception using errcode = '22023', message = 'loan_fee_date_invalid'; end if;
  for target in
    select installment.id, product.late_fee_minor
    from public.loan_installments as installment
    join public.loans as loan on loan.id = installment.loan_id
    join public.loan_products as product on product.id = loan.loan_product_id
    left join lateral (select sum(allocation.principal_minor + allocation.interest_minor + allocation.fee_minor)::bigint as total_paid
      from public.loan_payment_allocations as allocation where allocation.loan_installment_id = installment.id) as paid on true
    where loan.status in ('active', 'defaulted') and product.late_fee_minor > 0
      and installment.due_on + product.grace_days < p_as_of
      and installment.principal_due_minor + installment.interest_due_minor + installment.fee_due_minor > coalesce(paid.total_paid, 0)
      and not exists (select 1 from public.loan_late_fee_assessments as fee where fee.loan_installment_id = installment.id)
    order by installment.due_on, installment.id for update of installment skip locked
  loop
    insert into public.loan_late_fee_assessments (
      assessment_run_id, loan_installment_id, amount_minor, assessed_on
    ) values (run_id, target.id, target.late_fee_minor, p_as_of);
    update public.loan_installments as installment
    set fee_due_minor = installment.fee_due_minor + target.late_fee_minor,
      status = case when installment.status = 'paid' then 'partially_paid' else 'overdue' end,
      version = installment.version + 1
    where installment.id = target.id;
    created_count := created_count + 1;
    created_total := created_total + target.late_fee_minor;
  end loop;
  insert into public.loan_fee_assessment_runs (
    id, assessed_as_of, assessed_count, total_amount_minor, reason,
    assessed_by_actor_id, source_request_id
  ) values (
    run_id, p_as_of, created_count, created_total, btrim(p_reason), actor_id, p_request_id
  );
  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload, deduplication_key)
  values ('finance.loan_fees_assessed', 'loan_fee_assessment_run', run_id,
    jsonb_build_object('assessed_as_of', p_as_of, 'assessed_count', created_count,
      'total_amount_minor', created_total), 'finance.loan_fees_assessed:' || p_request_id::text);
  return query select run_id, created_count, created_total;
end;
$$;

create function public.staff_record_financial_reconciliation(
  p_account_id uuid, p_statement_through date, p_statement_balance_minor bigint,
  p_note text, p_reason text, p_request_id uuid
)
returns table (reconciliation_id uuid, public_reference text, status text, difference_minor bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; account_record public.financial_accounts%rowtype;
  existing public.financial_reconciliations%rowtype; created public.financial_reconciliations%rowtype;
  calculated_balance bigint; next_status text;
begin
  actor_id := private.set_staff_audit_context('finance.account.manage', p_reason, p_request_id);
  select reconciliation.* into existing from public.financial_reconciliations as reconciliation
  where reconciliation.source_request_id = p_request_id;
  if found then return query select existing.id, existing.public_reference, existing.status, existing.difference_minor; return; end if;
  select account.* into account_record from public.financial_accounts as account
  where account.id = p_account_id and not account.hidden_from_routine_ui;
  if not found or p_statement_through is null or p_statement_through > current_date then
    raise exception using errcode = '22023', message = 'financial_reconciliation_invalid';
  end if;
  calculated_balance := private.financial_account_balance_through(account_record.id, p_statement_through);
  next_status := case when p_statement_balance_minor = calculated_balance then 'matched' else 'variance' end;
  insert into public.financial_reconciliations (
    public_reference, financial_account_id, statement_through, statement_balance_minor,
    ledger_balance_minor, difference_minor, status, note, recorded_by_actor_id, source_request_id
  ) values (
    private.allocate_finance_reference('financial_reconciliation'), account_record.id, p_statement_through,
    p_statement_balance_minor, calculated_balance, p_statement_balance_minor - calculated_balance,
    next_status, coalesce(btrim(p_note), ''), actor_id, p_request_id
  ) returning * into created;
  return query select created.id, created.public_reference, created.status, created.difference_minor;
end;
$$;

create function public.staff_close_financial_period(
  p_starts_on date, p_ends_on date, p_note text, p_reason text, p_request_id uuid
)
returns table (period_id uuid, public_reference text, account_count integer, version bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; existing public.financial_periods%rowtype; created public.financial_periods%rowtype;
  captured_count integer;
begin
  actor_id := private.set_staff_audit_context('finance.account.manage', p_reason, p_request_id);
  select period.* into existing from public.financial_periods as period where period.source_request_id = p_request_id;
  if found then return query select existing.id, existing.public_reference,
    (select count(*)::integer from public.financial_period_account_balances as balance where balance.financial_period_id = existing.id),
    existing.version; return; end if;
  if p_starts_on is null or p_ends_on is null or p_ends_on < p_starts_on or p_ends_on >= current_date then
    raise exception using errcode = '22023', message = 'financial_period_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('eec-financial-period-close', 0));
  if exists (select 1 from public.financial_periods as period where period.status = 'closed'
    and daterange(period.starts_on, period.ends_on, '[]') && daterange(p_starts_on, p_ends_on, '[]')) then
    raise exception using errcode = '23514', message = 'financial_period_overlap';
  end if;
  insert into public.financial_periods (
    public_reference, starts_on, ends_on, note, closed_by_actor_id, source_request_id
  ) values (private.allocate_finance_reference('financial_period'), p_starts_on, p_ends_on,
    coalesce(btrim(p_note), ''), actor_id, p_request_id) returning * into created;
  insert into public.financial_period_account_balances (
    financial_period_id, financial_account_id, account_reference_snapshot, account_name_snapshot, balance_minor
  ) select created.id, account.id, account.public_reference, account.display_name,
    private.financial_account_balance_through(account.id, p_ends_on)
  from public.financial_accounts as account;
  get diagnostics captured_count = row_count;
  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload, deduplication_key)
  values ('finance.period_closed', 'financial_period', created.id,
    jsonb_build_object('public_reference', created.public_reference, 'starts_on', p_starts_on,
      'ends_on', p_ends_on, 'account_count', captured_count),
    'finance.period_closed:' || p_request_id::text);
  return query select created.id, created.public_reference, captured_count, created.version;
end;
$$;

create function public.staff_reopen_financial_period(
  p_period_id uuid, p_expected_version bigint, p_reason text, p_request_id uuid
)
returns table (period_id uuid, status text, version bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; period_record public.financial_periods%rowtype;
begin
  actor_id := private.set_staff_audit_context('finance.account.manage', p_reason, p_request_id);
  select period.* into period_record from public.financial_periods as period where period.id = p_period_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'financial_period_not_found'; end if;
  if period_record.reopen_request_id = p_request_id then
    return query select period_record.id, period_record.status, period_record.version; return;
  end if;
  if period_record.status <> 'closed' or period_record.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'financial_period_version_conflict';
  end if;
  update public.financial_periods as period set status = 'reopened', reopened_at = statement_timestamp(),
    reopened_by_actor_id = actor_id, reopen_reason = btrim(p_reason), reopen_request_id = p_request_id,
    version = period.version + 1 where period.id = period_record.id returning period.version into period_record.version;
  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload, deduplication_key)
  values ('finance.period_reopened', 'financial_period', period_record.id,
    jsonb_build_object('public_reference', period_record.public_reference, 'reason', btrim(p_reason)),
    'finance.period_reopened:' || p_request_id::text);
  return query select period_record.id, 'reopened'::text, period_record.version;
end;
$$;

create function public.get_staff_banking_controls()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform 1 from private.require_staff_permission('finance.bank.read');
  return jsonb_build_object(
    'generated_at', statement_timestamp(),
    'can_manage', private.staff_has_permission('finance.account.manage'),
    'eligible_late_fee_count', (
      select count(*) from public.loan_installments as installment
      join public.loans as loan on loan.id = installment.loan_id
      join public.loan_products as product on product.id = loan.loan_product_id
      left join lateral (select sum(allocation.principal_minor + allocation.interest_minor + allocation.fee_minor)::bigint as total_paid
        from public.loan_payment_allocations as allocation where allocation.loan_installment_id = installment.id) as paid on true
      where loan.status in ('active', 'defaulted') and product.late_fee_minor > 0
        and installment.due_on + product.grace_days < current_date
        and installment.principal_due_minor + installment.interest_due_minor + installment.fee_due_minor > coalesce(paid.total_paid, 0)
        and not exists (select 1 from public.loan_late_fee_assessments as fee where fee.loan_installment_id = installment.id)
    ),
    'periods', coalesce((select jsonb_agg(jsonb_build_object(
      'id', period.id, 'public_reference', period.public_reference, 'starts_on', period.starts_on,
      'ends_on', period.ends_on, 'status', period.status, 'note', period.note,
      'closed_at', period.closed_at, 'reopened_at', period.reopened_at, 'version', period.version,
      'account_count', (select count(*) from public.financial_period_account_balances as balance
        where balance.financial_period_id = period.id)
    ) order by period.ends_on desc, period.created_at desc)
      from (select * from public.financial_periods order by ends_on desc, created_at desc limit 50) as period), '[]'::jsonb),
    'reconciliations', coalesce((select jsonb_agg(jsonb_build_object(
      'id', reconciliation.id, 'public_reference', reconciliation.public_reference,
      'account_id', reconciliation.financial_account_id, 'account_name', account.display_name,
      'account_reference', account.public_reference, 'currency_code', currency.code,
      'statement_through', reconciliation.statement_through,
      'statement_balance_minor', reconciliation.statement_balance_minor,
      'ledger_balance_minor', reconciliation.ledger_balance_minor,
      'difference_minor', reconciliation.difference_minor, 'status', reconciliation.status,
      'note', reconciliation.note, 'created_at', reconciliation.created_at
    ) order by reconciliation.statement_through desc, reconciliation.created_at desc)
      from (select * from public.financial_reconciliations order by statement_through desc, created_at desc limit 100) as reconciliation
      join public.financial_accounts as account on account.id = reconciliation.financial_account_id
      join public.currencies as currency on currency.id = account.currency_id), '[]'::jsonb),
    'fee_runs', coalesce((select jsonb_agg(jsonb_build_object(
      'id', run.id, 'assessed_as_of', run.assessed_as_of, 'assessed_count', run.assessed_count,
      'total_amount_minor', run.total_amount_minor, 'created_at', run.created_at
    ) order by run.created_at desc)
      from (select * from public.loan_fee_assessment_runs order by created_at desc limit 30) as run), '[]'::jsonb)
  );
end;
$$;

revoke all on public.invoice_payment_reversals, public.loan_payment_reversals,
  public.loan_fee_assessment_runs, public.loan_late_fee_assessments,
  public.financial_reconciliations, public.financial_periods,
  public.financial_period_account_balances from public, anon, authenticated;

revoke all on function private.financial_account_balance_through(uuid,date),
  private.reject_closed_financial_period_posting(),
  private.post_exact_financial_reversal(uuid,date,text,text,uuid,text,uuid,uuid),
  public.staff_reverse_latest_invoice_payment(uuid,bigint,text,uuid),
  public.staff_reverse_latest_loan_payment(uuid,bigint,text,uuid),
  public.staff_assess_overdue_loan_fees(date,text,uuid),
  public.staff_record_financial_reconciliation(uuid,date,bigint,text,text,uuid),
  public.staff_close_financial_period(date,date,text,text,uuid),
  public.staff_reopen_financial_period(uuid,bigint,text,uuid),
  public.get_staff_banking_controls() from public, anon, authenticated;

grant execute on function public.staff_reverse_latest_invoice_payment(uuid,bigint,text,uuid),
  public.staff_reverse_latest_loan_payment(uuid,bigint,text,uuid),
  public.staff_assess_overdue_loan_fees(date,text,uuid),
  public.staff_record_financial_reconciliation(uuid,date,bigint,text,text,uuid),
  public.staff_close_financial_period(date,date,text,text,uuid),
  public.staff_reopen_financial_period(uuid,bigint,text,uuid),
  public.get_staff_banking_controls() to authenticated;

comment on table public.financial_reconciliations is 'Immutable comparisons between a stated balance and the ledger-derived balance through a date.';
comment on table public.financial_periods is 'Audited close/reopen records; closed periods reject newly posted backdated transactions.';
comment on table public.invoice_payment_reversals is 'Purpose-built invoice corrections linked to exact balanced reversal transactions.';
comment on table public.loan_payment_reversals is 'Purpose-built loan corrections with compensating money and allocation evidence.';
