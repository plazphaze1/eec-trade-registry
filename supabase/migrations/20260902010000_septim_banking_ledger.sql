-- Authoritative fictional-currency banking, invoicing, and payment ledger.
-- Septims are an in-server currency. This is not real-world banking or payment processing.

insert into public.permission_scopes (code, display_name, description)
values
  ('finance.bank.read', 'Read banking records', 'View Company and customer balances, invoices, statements, and posted money movements.'),
  ('finance.transaction.post', 'Post money movements', 'Record deposits, withdrawals, transfers, invoice payments, and linked settlements.'),
  ('finance.invoice.manage', 'Manage invoices', 'Issue, collect, and void order invoices through authoritative commands.'),
  ('finance.account.manage', 'Manage financial accounts', 'Open and close Company-controlled fictional-currency accounts.'),
  ('finance.transaction.reverse', 'Reverse money movements', 'Post an exact compensating transaction without rewriting prior evidence.')
on conflict (code) do update
set display_name = excluded.display_name,
    description = excluded.description,
    active = true;

insert into public.staff_role_permissions (staff_role_id, permission_scope_id)
select role.id, permission.id
from public.staff_roles as role
cross join public.permission_scopes as permission
where role.code in ('owner', 'agent')
  and permission.code in ('finance.bank.read', 'finance.transaction.post', 'finance.invoice.manage')
on conflict (staff_role_id, permission_scope_id) do nothing;

insert into private.scope_key_definitions (scope_family, scope_key, value_type)
values
  ('dealer_authority', 'bank.read', 'boolean'),
  ('dealer_authority', 'bank.transfer', 'boolean')
on conflict (scope_family, scope_key) do nothing;

update public.representative_role_definitions
set default_scope = default_scope || jsonb_build_object(
  'bank.read', true,
  'bank.transfer', true
)
where code = 'portal-representative';

update public.party_representatives as representative
set authority_scope = representative.authority_scope || jsonb_build_object(
  'bank.read', true,
  'bank.transfer', true
)
from public.representative_role_definitions as role_definition
where role_definition.id = representative.role_definition_id
  and role_definition.code = 'portal-representative';

insert into public.staff_role_permissions (staff_role_id, permission_scope_id)
select role.id, permission.id
from public.staff_roles as role
cross join public.permission_scopes as permission
where role.code = 'owner'
  and permission.code in ('finance.account.manage', 'finance.transaction.reverse')
on conflict (staff_role_id, permission_scope_id) do nothing;

insert into public.reference_sequences (document_type, prefix, next_value, padding)
values
  ('financial_account', 'EEC-ACC', 1001, 4),
  ('financial_transaction', 'EEC-TXN', 1001, 4),
  ('sales_invoice', 'EEC-INV', 1001, 4),
  ('account_hold', 'EEC-HLD', 1001, 4),
  ('loan', 'EEC-LOAN', 1001, 4)
on conflict (document_type) do nothing;

create function private.allocate_finance_reference(p_document_type text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare sequence_record record; allocated text;
begin
  if p_document_type not in ('financial_account', 'financial_transaction', 'sales_invoice', 'account_hold', 'loan') then
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

create table public.financial_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  public_reference text not null unique,
  display_name text not null check (btrim(display_name) <> '' and char_length(display_name) <= 160),
  account_type text not null check (account_type in ('company_treasury', 'business', 'personal', 'escrow', 'external')),
  party_id uuid references public.parties(id) on delete restrict,
  currency_id uuid not null references public.currencies(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'frozen', 'closed')),
  allow_negative boolean not null default false,
  hidden_from_routine_ui boolean not null default false,
  notes text not null default '' check (char_length(notes) <= 1000),
  opened_by_actor_id uuid references public.actor_profiles(id) on delete restrict,
  source_request_id uuid unique,
  opened_at timestamptz not null default statement_timestamp(),
  closed_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (public_reference = private.normalize_registry_reference(public_reference)),
  check ((account_type = 'external' and party_id is null and allow_negative and hidden_from_routine_ui)
    or account_type <> 'external'),
  check ((status = 'closed' and closed_at is not null) or (status in ('active', 'frozen') and closed_at is null))
);

create unique index financial_accounts_treasury_currency_idx
  on public.financial_accounts(currency_id) where account_type = 'company_treasury';
create unique index financial_accounts_external_currency_idx
  on public.financial_accounts(currency_id) where account_type = 'external';
create index financial_accounts_party_idx on public.financial_accounts(party_id, currency_id) where party_id is not null;
create unique index financial_accounts_business_party_currency_idx
  on public.financial_accounts(party_id, currency_id)
  where account_type = 'business' and party_id is not null;

create table public.financial_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  public_reference text not null unique,
  transaction_type text not null check (transaction_type in (
    'opening_balance', 'deposit', 'withdrawal', 'transfer', 'order_payment',
    'purchase_payment', 'procurement_payment', 'consignment_payment', 'loan_disbursement',
    'loan_payment', 'refund', 'reversal'
  )),
  currency_id uuid not null references public.currencies(id) on delete restrict,
  occurred_on date not null,
  memo text not null check (btrim(memo) <> '' and char_length(memo) <= 500),
  external_reference text check (external_reference is null or char_length(external_reference) <= 200),
  source_record_type text check (source_record_type is null or source_record_type in (
    'order_invoice', 'stock_activity', 'procurement_delivery', 'consignment_settlement', 'loan', 'manual'
  )),
  source_record_id uuid,
  source_reference text,
  reverses_transaction_id uuid unique references public.financial_transactions(id) on delete restrict,
  posted_by_actor_id uuid not null references public.actor_profiles(id) on delete restrict,
  source_request_id uuid not null unique,
  posted_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  check (public_reference = private.normalize_registry_reference(public_reference)),
  check ((source_record_type is null and source_record_id is null) or (source_record_type is not null and source_record_id is not null)),
  check ((transaction_type = 'reversal' and reverses_transaction_id is not null)
    or (transaction_type <> 'reversal' and reverses_transaction_id is null))
);

create unique index financial_transactions_source_idx
  on public.financial_transactions(source_record_type, source_record_id)
  where source_record_type is not null
    and transaction_type in ('opening_balance', 'purchase_payment', 'procurement_payment', 'consignment_payment', 'loan_disbursement');
create index financial_transactions_date_idx on public.financial_transactions(occurred_on desc, posted_at desc);

create table public.financial_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  financial_transaction_id uuid not null references public.financial_transactions(id) on delete restrict,
  financial_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  amount_minor bigint not null check (amount_minor <> 0),
  entry_memo text not null default '' check (char_length(entry_memo) <= 300),
  created_at timestamptz not null default statement_timestamp(),
  unique (financial_transaction_id, financial_account_id)
);
create index financial_entries_account_idx on public.financial_entries(financial_account_id, created_at desc);

create table public.sales_invoices (
  id uuid primary key default extensions.gen_random_uuid(),
  public_reference text not null unique,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  ordering_party_id uuid not null references public.parties(id) on delete restrict,
  currency_id uuid not null references public.currencies(id) on delete restrict,
  total_amount_minor bigint not null check (total_amount_minor > 0),
  status text not null default 'open' check (status in ('open', 'partially_paid', 'paid', 'void')),
  issued_on date not null,
  due_on date,
  note text not null default '' check (char_length(note) <= 1000),
  issued_by_actor_id uuid not null references public.actor_profiles(id) on delete restrict,
  source_request_id uuid not null unique,
  voided_at timestamptz,
  voided_by_actor_id uuid references public.actor_profiles(id) on delete restrict,
  void_reason text check (void_reason is null or char_length(void_reason) <= 500),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (public_reference = private.normalize_registry_reference(public_reference)),
  check (due_on is null or due_on >= issued_on),
  check ((status = 'void' and voided_at is not null and voided_by_actor_id is not null and btrim(coalesce(void_reason, '')) <> '')
    or (status <> 'void' and voided_at is null and voided_by_actor_id is null and void_reason is null))
);

create table public.sales_invoice_lines (
  id uuid primary key default extensions.gen_random_uuid(),
  sales_invoice_id uuid not null references public.sales_invoices(id) on delete restrict,
  order_line_id uuid not null references public.order_lines(id) on delete restrict,
  line_number smallint not null check (line_number > 0),
  item_code_snapshot text not null,
  item_name_snapshot text not null,
  quantity_snapshot numeric(18, 3) not null check (quantity_snapshot > 0),
  unit_code_snapshot text not null,
  unit_price_minor_snapshot bigint not null check (unit_price_minor_snapshot >= 0),
  line_total_minor bigint not null check (line_total_minor >= 0),
  created_at timestamptz not null default statement_timestamp(),
  unique (sales_invoice_id, line_number),
  unique (sales_invoice_id, order_line_id),
  check (line_total_minor = round(quantity_snapshot * unit_price_minor_snapshot)::bigint)
);

create table public.sales_invoice_payments (
  id uuid primary key default extensions.gen_random_uuid(),
  sales_invoice_id uuid not null references public.sales_invoices(id) on delete restrict,
  financial_transaction_id uuid not null unique references public.financial_transactions(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  recorded_by_actor_id uuid not null references public.actor_profiles(id) on delete restrict,
  source_request_id uuid not null unique,
  created_at timestamptz not null default statement_timestamp()
);
create index sales_invoice_payments_invoice_idx on public.sales_invoice_payments(sales_invoice_id, created_at);

create table public.financial_account_holds (
  id uuid primary key default extensions.gen_random_uuid(),
  public_reference text not null unique,
  financial_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'active' check (status in ('active', 'released', 'captured', 'expired')),
  reason text not null check (btrim(reason) <> '' and char_length(reason) <= 500),
  related_record_type text,
  related_record_id uuid,
  expires_at timestamptz,
  created_by_actor_id uuid not null references public.actor_profiles(id) on delete restrict,
  source_request_id uuid not null unique,
  released_at timestamptz,
  released_by_actor_id uuid references public.actor_profiles(id) on delete restrict,
  release_reason text,
  release_request_id uuid unique,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (public_reference = private.normalize_registry_reference(public_reference)),
  check ((related_record_type is null and related_record_id is null) or (related_record_type is not null and related_record_id is not null)),
  check ((status = 'active' and released_at is null and released_by_actor_id is null)
    or (status <> 'active' and released_at is not null and released_by_actor_id is not null))
);
create index financial_account_holds_active_idx on public.financial_account_holds(financial_account_id, expires_at)
  where status = 'active';

create table public.loan_products (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9-]{2,49}$'),
  display_name text not null check (btrim(display_name) <> '' and char_length(display_name) <= 120),
  description text not null default '' check (char_length(description) <= 1000),
  annual_rate_basis_points integer not null check (annual_rate_basis_points between 0 and 100000),
  repayment_frequency text not null check (repayment_frequency in ('weekly', 'monthly')),
  minimum_term_count integer not null check (minimum_term_count > 0),
  maximum_term_count integer not null check (maximum_term_count >= minimum_term_count and maximum_term_count <= 520),
  minimum_principal_minor bigint not null check (minimum_principal_minor > 0),
  maximum_principal_minor bigint check (maximum_principal_minor is null or maximum_principal_minor >= minimum_principal_minor),
  grace_days integer not null default 0 check (grace_days between 0 and 365),
  late_fee_minor bigint not null default 0 check (late_fee_minor >= 0),
  active boolean not null default true,
  created_by_actor_id uuid not null references public.actor_profiles(id) on delete restrict,
  source_request_id uuid not null unique,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table public.loans (
  id uuid primary key default extensions.gen_random_uuid(),
  public_reference text not null unique,
  loan_product_id uuid not null references public.loan_products(id) on delete restrict,
  borrower_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  borrower_party_id uuid references public.parties(id) on delete restrict,
  currency_id uuid not null references public.currencies(id) on delete restrict,
  principal_minor bigint not null check (principal_minor > 0),
  annual_rate_basis_points integer not null check (annual_rate_basis_points between 0 and 100000),
  repayment_frequency text not null check (repayment_frequency in ('weekly', 'monthly')),
  term_count integer not null check (term_count > 0 and term_count <= 520),
  originated_on date not null,
  first_due_on date not null,
  maturity_on date not null,
  status text not null default 'active' check (status in ('active', 'paid', 'defaulted', 'written_off', 'cancelled')),
  purpose text not null default '' check (char_length(purpose) <= 1000),
  disbursement_transaction_id uuid not null unique references public.financial_transactions(id) on delete restrict,
  originated_by_actor_id uuid not null references public.actor_profiles(id) on delete restrict,
  source_request_id uuid not null unique,
  defaulted_at timestamptz,
  default_reason text,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (public_reference = private.normalize_registry_reference(public_reference)),
  check (first_due_on > originated_on and maturity_on >= first_due_on),
  check ((status in ('defaulted', 'written_off') and defaulted_at is not null and btrim(coalesce(default_reason, '')) <> '')
    or (status not in ('defaulted', 'written_off') and defaulted_at is null and default_reason is null))
);
create index loans_borrower_idx on public.loans(borrower_account_id, status, maturity_on);

create table public.loan_installments (
  id uuid primary key default extensions.gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete restrict,
  installment_number integer not null check (installment_number > 0),
  due_on date not null,
  principal_due_minor bigint not null check (principal_due_minor > 0),
  interest_due_minor bigint not null check (interest_due_minor >= 0),
  fee_due_minor bigint not null default 0 check (fee_due_minor >= 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'partially_paid', 'paid', 'overdue', 'waived')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (loan_id, installment_number),
  unique (loan_id, due_on)
);
create index loan_installments_due_idx on public.loan_installments(status, due_on);

create table public.loan_payments (
  id uuid primary key default extensions.gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete restrict,
  financial_transaction_id uuid not null unique references public.financial_transactions(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  occurred_on date not null,
  payment_reference text,
  recorded_by_actor_id uuid not null references public.actor_profiles(id) on delete restrict,
  source_request_id uuid not null unique,
  created_at timestamptz not null default statement_timestamp()
);
create index loan_payments_loan_idx on public.loan_payments(loan_id, occurred_on, created_at);

create table public.loan_payment_allocations (
  id uuid primary key default extensions.gen_random_uuid(),
  loan_payment_id uuid not null references public.loan_payments(id) on delete restrict,
  loan_installment_id uuid not null references public.loan_installments(id) on delete restrict,
  principal_minor bigint not null default 0 check (principal_minor >= 0),
  interest_minor bigint not null default 0 check (interest_minor >= 0),
  fee_minor bigint not null default 0 check (fee_minor >= 0),
  created_at timestamptz not null default statement_timestamp(),
  unique (loan_payment_id, loan_installment_id),
  check (principal_minor + interest_minor + fee_minor > 0)
);
create index loan_payment_allocations_installment_idx on public.loan_payment_allocations(loan_installment_id);

create trigger financial_accounts_set_updated_at before update on public.financial_accounts
for each row execute function private.set_updated_at();
create trigger sales_invoices_set_updated_at before update on public.sales_invoices
for each row execute function private.set_updated_at();
create trigger financial_accounts_audit after insert or update or delete on public.financial_accounts
for each row execute function private.capture_audit_row();
create trigger financial_transactions_audit after insert or update or delete on public.financial_transactions
for each row execute function private.capture_audit_row();
create trigger financial_entries_audit after insert or update or delete on public.financial_entries
for each row execute function private.capture_audit_row();
create trigger sales_invoices_audit after insert or update or delete on public.sales_invoices
for each row execute function private.capture_audit_row();
create trigger sales_invoice_lines_audit after insert or update or delete on public.sales_invoice_lines
for each row execute function private.capture_audit_row();
create trigger sales_invoice_payments_audit after insert or update or delete on public.sales_invoice_payments
for each row execute function private.capture_audit_row();
create trigger financial_account_holds_set_updated_at before update on public.financial_account_holds
for each row execute function private.set_updated_at();
create trigger loan_products_set_updated_at before update on public.loan_products
for each row execute function private.set_updated_at();
create trigger loans_set_updated_at before update on public.loans
for each row execute function private.set_updated_at();
create trigger loan_installments_set_updated_at before update on public.loan_installments
for each row execute function private.set_updated_at();
create trigger financial_account_holds_audit after insert or update or delete on public.financial_account_holds
for each row execute function private.capture_audit_row();
create trigger loan_products_audit after insert or update or delete on public.loan_products
for each row execute function private.capture_audit_row();
create trigger loans_audit after insert or update or delete on public.loans
for each row execute function private.capture_audit_row();
create trigger loan_installments_audit after insert or update or delete on public.loan_installments
for each row execute function private.capture_audit_row();
create trigger loan_payments_audit after insert or update or delete on public.loan_payments
for each row execute function private.capture_audit_row();
create trigger loan_payment_allocations_audit after insert or update or delete on public.loan_payment_allocations
for each row execute function private.capture_audit_row();

create function private.reject_financial_evidence_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = '55000', message = 'financial_evidence_is_immutable';
end;
$$;

create trigger financial_transactions_immutable before update or delete on public.financial_transactions
for each row execute function private.reject_financial_evidence_change();
create trigger financial_entries_immutable before update or delete on public.financial_entries
for each row execute function private.reject_financial_evidence_change();
create trigger sales_invoice_lines_immutable before update or delete on public.sales_invoice_lines
for each row execute function private.reject_financial_evidence_change();
create trigger sales_invoice_payments_immutable before update or delete on public.sales_invoice_payments
for each row execute function private.reject_financial_evidence_change();
create trigger loan_payments_immutable before update or delete on public.loan_payments
for each row execute function private.reject_financial_evidence_change();
create trigger loan_payment_allocations_immutable before update or delete on public.loan_payment_allocations
for each row execute function private.reject_financial_evidence_change();

create function private.require_balanced_financial_transaction()
returns trigger language plpgsql set search_path = '' as $$
declare target_id uuid; entry_count integer; entry_total bigint;
begin
  target_id := coalesce(new.financial_transaction_id, old.financial_transaction_id);
  select count(*), coalesce(sum(entry.amount_minor), 0)
  into entry_count, entry_total
  from public.financial_entries as entry
  where entry.financial_transaction_id = target_id;
  if entry_count < 2 or entry_total <> 0 then
    raise exception using errcode = '23514', message = 'financial_transaction_unbalanced';
  end if;
  return null;
end;
$$;

create constraint trigger financial_entries_balanced
after insert or update or delete on public.financial_entries
deferrable initially deferred for each row execute function private.require_balanced_financial_transaction();

alter table public.financial_accounts enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.financial_entries enable row level security;
alter table public.sales_invoices enable row level security;
alter table public.sales_invoice_lines enable row level security;
alter table public.sales_invoice_payments enable row level security;
alter table public.financial_account_holds enable row level security;
alter table public.loan_products enable row level security;
alter table public.loans enable row level security;
alter table public.loan_installments enable row level security;
alter table public.loan_payments enable row level security;
alter table public.loan_payment_allocations enable row level security;

create function private.financial_account_balance(p_account_id uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum(entry.amount_minor), 0)::bigint
  from public.financial_entries as entry
  where entry.financial_account_id = p_account_id;
$$;

create function private.financial_account_available_balance(p_account_id uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select private.financial_account_balance(p_account_id) - coalesce((
    select sum(hold.amount_minor) from public.financial_account_holds as hold
    where hold.financial_account_id = p_account_id and hold.status = 'active'
      and (hold.expires_at is null or hold.expires_at > statement_timestamp())
  ), 0);
$$;

create function private.post_two_sided_financial_transaction(
  p_transaction_type text, p_from_account_id uuid, p_to_account_id uuid,
  p_amount_minor bigint, p_occurred_on date, p_memo text,
  p_external_reference text, p_source_record_type text, p_source_record_id uuid,
  p_source_reference text, p_actor_id uuid, p_request_id uuid,
  p_reverses_transaction_id uuid default null
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare existing_id uuid; from_account record; to_account record; created_id uuid;
begin
  select transaction.id into existing_id from public.financial_transactions as transaction
  where transaction.source_request_id = p_request_id;
  if found then return existing_id; end if;
  if p_amount_minor is null or p_amount_minor <= 0 or p_from_account_id = p_to_account_id
    or p_occurred_on is null or btrim(coalesce(p_memo, '')) = '' then
    raise exception using errcode = '22023', message = 'financial_transaction_invalid';
  end if;
  select account.* into from_account from public.financial_accounts as account
  where account.id = p_from_account_id for update;
  if not found or from_account.status <> 'active' then
    raise exception using errcode = '22023', message = 'financial_source_account_invalid';
  end if;
  select account.* into to_account from public.financial_accounts as account
  where account.id = p_to_account_id for update;
  if not found or to_account.status <> 'active' or to_account.currency_id <> from_account.currency_id then
    raise exception using errcode = '22023', message = 'financial_destination_account_invalid';
  end if;
  if not from_account.allow_negative and private.financial_account_available_balance(from_account.id) < p_amount_minor then
    raise exception using errcode = '23514', message = 'financial_insufficient_funds';
  end if;
  insert into public.financial_transactions (
    public_reference, transaction_type, currency_id, occurred_on, memo, external_reference,
    source_record_type, source_record_id, source_reference, reverses_transaction_id,
    posted_by_actor_id, source_request_id
  ) values (
    private.allocate_finance_reference('financial_transaction'), p_transaction_type,
    from_account.currency_id, p_occurred_on, btrim(p_memo), nullif(btrim(coalesce(p_external_reference, '')), ''),
    p_source_record_type, p_source_record_id, nullif(btrim(coalesce(p_source_reference, '')), ''),
    p_reverses_transaction_id, p_actor_id, p_request_id
  ) returning id into created_id;
  insert into public.financial_entries (financial_transaction_id, financial_account_id, amount_minor, entry_memo)
  values
    (created_id, from_account.id, -p_amount_minor, 'Money out'),
    (created_id, to_account.id, p_amount_minor, 'Money in');
  return created_id;
end;
$$;

-- One treasury and one hidden outside-world clearing account per currency.
insert into public.financial_accounts (
  public_reference, display_name, account_type, party_id, currency_id,
  allow_negative, hidden_from_routine_ui, notes
)
select private.allocate_finance_reference('financial_account'),
  'East Empire Company Treasury · ' || currency.code, 'company_treasury',
  (select warehouse.operating_party_id from public.warehouses as warehouse order by warehouse.created_at limit 1),
  currency.id, true, false,
  'Authoritative Company treasury. Negative balance remains visible until opening funds or deposits are recorded.'
from public.currencies as currency where currency.active
on conflict do nothing;

create function private.ensure_business_financial_account()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    insert into public.financial_accounts (
      public_reference, display_name, account_type, party_id, currency_id,
      notes, opened_by_actor_id, source_request_id
    )
    select private.allocate_finance_reference('financial_account'), party.display_name,
      'business', new.party_id, currency.id,
      'Opened automatically with active licensed-business portal access.',
      new.updated_by_actor_id, extensions.gen_random_uuid()
    from public.parties as party
    cross join public.currencies as currency
    where party.id = new.party_id and party.status = 'active' and currency.active
    on conflict (party_id, currency_id) where account_type = 'business' and party_id is not null do nothing;
  end if;
  return new;
end;
$$;

create trigger business_portal_financial_account
after insert or update of status on public.business_portal_accounts
for each row execute function private.ensure_business_financial_account();

insert into public.financial_accounts (
  public_reference, display_name, account_type, party_id, currency_id,
  notes, opened_by_actor_id, source_request_id
)
select private.allocate_finance_reference('financial_account'), party.display_name,
  'business', portal.party_id, currency.id,
  'Opened automatically for an existing active licensed-business portal account.',
  portal.updated_by_actor_id, extensions.gen_random_uuid()
from public.business_portal_accounts as portal
join public.parties as party on party.id = portal.party_id and party.status = 'active'
cross join public.currencies as currency
where portal.status = 'active' and currency.active
on conflict (party_id, currency_id) where account_type = 'business' and party_id is not null do nothing;

insert into public.financial_accounts (
  public_reference, display_name, account_type, currency_id,
  allow_negative, hidden_from_routine_ui, notes
)
select private.allocate_finance_reference('financial_account'),
  'Outside-world clearing · ' || currency.code, 'external', currency.id,
  true, true, 'System counter-account for cash entering or leaving the recorded banking boundary.'
from public.currencies as currency where currency.active
on conflict do nothing;

create function public.staff_create_financial_account(
  p_display_name text, p_account_type text, p_party_id uuid, p_currency_code text,
  p_opening_balance_minor bigint, p_note text, p_reason text, p_request_id uuid
)
returns table (account_id uuid, public_reference text, balance_minor bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; existing public.financial_accounts%rowtype; currency_record record;
  created public.financial_accounts%rowtype; clearing_id uuid;
begin
  actor_id := private.set_staff_audit_context('finance.account.manage', p_reason, p_request_id);
  select * into existing from public.financial_accounts where source_request_id = p_request_id;
  if found then return query select existing.id, existing.public_reference, private.financial_account_balance(existing.id); return; end if;
  if p_account_type not in ('business', 'personal', 'escrow') or btrim(coalesce(p_display_name, '')) = ''
    or coalesce(p_opening_balance_minor, 0) < 0 then
    raise exception using errcode = '22023', message = 'financial_account_invalid';
  end if;
  select currency.id, currency.code into currency_record from public.currencies as currency
  where currency.code = upper(btrim(p_currency_code)) and currency.active;
  if not found then raise exception using errcode = '22023', message = 'financial_currency_invalid'; end if;
  if p_party_id is not null and not exists (select 1 from public.parties where id = p_party_id and status = 'active') then
    raise exception using errcode = '22023', message = 'financial_party_invalid';
  end if;
  insert into public.financial_accounts (
    public_reference, display_name, account_type, party_id, currency_id, notes,
    opened_by_actor_id, source_request_id
  ) values (
    private.allocate_finance_reference('financial_account'), btrim(p_display_name), p_account_type,
    p_party_id, currency_record.id, coalesce(btrim(p_note), ''), actor_id, p_request_id
  ) returning * into created;
  if coalesce(p_opening_balance_minor, 0) > 0 then
    select id into strict clearing_id from public.financial_accounts
    where account_type = 'external' and currency_id = currency_record.id;
    perform private.post_two_sided_financial_transaction(
      'opening_balance', clearing_id, created.id, p_opening_balance_minor, current_date,
      'Opening balance for ' || created.display_name, null, 'manual', created.id,
      created.public_reference, actor_id, extensions.gen_random_uuid()
    );
  end if;
  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload, deduplication_key)
  values ('finance.account_opened', 'financial_account', created.id,
    jsonb_build_object('public_reference', created.public_reference, 'display_name', created.display_name),
    'finance.account_opened:' || p_request_id::text);
  return query select created.id, created.public_reference, private.financial_account_balance(created.id);
end;
$$;

create function public.staff_post_cash_movement(
  p_account_id uuid, p_direction text, p_amount_minor bigint, p_occurred_on date,
  p_reference text, p_memo text, p_reason text, p_request_id uuid
)
returns table (transaction_id uuid, public_reference text, account_balance_minor bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; account_record record; clearing_id uuid; created_id uuid;
begin
  actor_id := private.set_staff_audit_context('finance.transaction.post', p_reason, p_request_id);
  select account.* into account_record from public.financial_accounts as account where account.id = p_account_id;
  if not found or account_record.hidden_from_routine_ui or p_direction not in ('deposit', 'withdrawal') then
    raise exception using errcode = '22023', message = 'cash_movement_invalid';
  end if;
  select id into strict clearing_id from public.financial_accounts
  where account_type = 'external' and currency_id = account_record.currency_id;
  if p_direction = 'deposit' then
    created_id := private.post_two_sided_financial_transaction(
      'deposit', clearing_id, account_record.id, p_amount_minor, p_occurred_on,
      p_memo, p_reference, null, null, account_record.public_reference, actor_id, p_request_id
    );
  else
    created_id := private.post_two_sided_financial_transaction(
      'withdrawal', account_record.id, clearing_id, p_amount_minor, p_occurred_on,
      p_memo, p_reference, null, null, account_record.public_reference, actor_id, p_request_id
    );
  end if;
  return query select created_id, transaction.public_reference, private.financial_account_balance(account_record.id)
  from public.financial_transactions as transaction where transaction.id = created_id;
end;
$$;

create function public.staff_transfer_funds(
  p_from_account_id uuid, p_to_account_id uuid, p_amount_minor bigint, p_occurred_on date,
  p_reference text, p_memo text, p_reason text, p_request_id uuid
)
returns table (transaction_id uuid, public_reference text)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; created_id uuid;
begin
  actor_id := private.set_staff_audit_context('finance.transaction.post', p_reason, p_request_id);
  created_id := private.post_two_sided_financial_transaction(
    'transfer', p_from_account_id, p_to_account_id, p_amount_minor, p_occurred_on,
    p_memo, p_reference, null, null, null, actor_id, p_request_id
  );
  return query select created_id, transaction.public_reference
  from public.financial_transactions as transaction where transaction.id = created_id;
end;
$$;

create function public.staff_issue_order_invoice(
  p_order_id uuid, p_issued_on date, p_due_on date, p_note text, p_reason text, p_request_id uuid
)
returns table (invoice_id uuid, public_reference text, total_amount_minor bigint, status text, version bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; existing public.sales_invoices%rowtype; order_record public.orders%rowtype;
  currency_id uuid; computed_total bigint; created public.sales_invoices%rowtype;
begin
  actor_id := private.set_staff_audit_context('finance.invoice.manage', p_reason, p_request_id);
  select * into existing from public.sales_invoices where source_request_id = p_request_id or order_id = p_order_id;
  if found then return query select existing.id, existing.public_reference, existing.total_amount_minor, existing.status, existing.version; return; end if;
  select * into order_record from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'order_not_found'; end if;
  if order_record.status not in ('approved', 'partially_approved', 'awaiting_stock', 'processing', 'fulfilled')
    or p_issued_on is null or (p_due_on is not null and p_due_on < p_issued_on) then
    raise exception using errcode = '22023', message = 'order_not_invoiceable';
  end if;
  if exists (select 1 from public.order_lines as candidate_line where candidate_line.order_id = order_record.id
    and candidate_line.status not in ('denied', 'cancelled') and candidate_line.unit_price_minor_snapshot is null) then
    raise exception using errcode = '22023', message = 'order_price_required';
  end if;
  select currency.id into currency_id from public.currencies as currency
  where currency.code = order_record.currency_code and currency.active;
  select coalesce(sum(round(coalesce(line.quantity_approved, line.quantity_requested) * line.unit_price_minor_snapshot)), 0)::bigint
  into computed_total from public.order_lines as line
  where line.order_id = order_record.id and line.status not in ('denied', 'cancelled');
  if computed_total <= 0 then raise exception using errcode = '22023', message = 'order_total_invalid'; end if;
  insert into public.sales_invoices (
    public_reference, order_id, ordering_party_id, currency_id, total_amount_minor,
    issued_on, due_on, note, issued_by_actor_id, source_request_id
  ) values (
    private.allocate_finance_reference('sales_invoice'), order_record.id, order_record.ordering_party_id,
    currency_id, computed_total, p_issued_on, p_due_on, coalesce(btrim(p_note), ''), actor_id, p_request_id
  ) returning * into created;
  insert into public.sales_invoice_lines (
    sales_invoice_id, order_line_id, line_number, item_code_snapshot, item_name_snapshot,
    quantity_snapshot, unit_code_snapshot, unit_price_minor_snapshot, line_total_minor
  )
  select created.id, line.id, line.line_number, line.item_code_snapshot, line.item_name_snapshot,
    coalesce(line.quantity_approved, line.quantity_requested), line.unit_code_snapshot,
    line.unit_price_minor_snapshot,
    round(coalesce(line.quantity_approved, line.quantity_requested) * line.unit_price_minor_snapshot)::bigint
  from public.order_lines as line
  where line.order_id = order_record.id and line.status not in ('denied', 'cancelled')
  order by line.line_number;
  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload, deduplication_key)
  values ('finance.invoice_issued', 'sales_invoice', created.id,
    jsonb_build_object('public_reference', created.public_reference, 'order_reference', order_record.public_reference,
      'total_amount_minor', created.total_amount_minor, 'currency_code', order_record.currency_code),
    'finance.invoice_issued:' || p_request_id::text);
  return query select created.id, created.public_reference, created.total_amount_minor, created.status, created.version;
end;
$$;

create function public.staff_record_invoice_payment(
  p_invoice_id uuid, p_from_account_id uuid, p_amount_minor bigint, p_occurred_on date,
  p_payment_reference text, p_note text, p_reason text, p_request_id uuid
)
returns table (invoice_id uuid, invoice_status text, paid_amount_minor bigint, balance_due_minor bigint, version bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; invoice_record public.sales_invoices%rowtype; paid_total bigint;
  payer_id uuid; treasury_id uuid; transaction_id uuid; next_status text; next_version bigint;
begin
  actor_id := private.set_staff_audit_context('finance.invoice.manage', p_reason, p_request_id);
  select invoice.* into invoice_record from public.sales_invoices as invoice where invoice.id = p_invoice_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'invoice_not_found'; end if;
  if exists (select 1 from public.sales_invoice_payments where source_request_id = p_request_id) then
    select coalesce(sum(payment.amount_minor), 0)::bigint into paid_total
    from public.sales_invoice_payments as payment
    join public.financial_transactions as transaction on transaction.id = payment.financial_transaction_id
    where payment.sales_invoice_id = invoice_record.id
      and not exists (select 1 from public.financial_transactions as reversal where reversal.reverses_transaction_id = transaction.id);
    return query select invoice_record.id, invoice_record.status, paid_total,
      greatest(invoice_record.total_amount_minor - paid_total, 0), invoice_record.version; return;
  end if;
  if invoice_record.status in ('paid', 'void') then raise exception using errcode = '22023', message = 'invoice_not_payable'; end if;
  select coalesce(sum(payment.amount_minor), 0)::bigint into paid_total
  from public.sales_invoice_payments as payment
  join public.financial_transactions as transaction on transaction.id = payment.financial_transaction_id
  where payment.sales_invoice_id = invoice_record.id
    and not exists (select 1 from public.financial_transactions as reversal where reversal.reverses_transaction_id = transaction.id);
  if p_amount_minor <= 0 or p_amount_minor > invoice_record.total_amount_minor - paid_total then
    raise exception using errcode = '22023', message = 'invoice_payment_amount_invalid';
  end if;
  select id into strict treasury_id from public.financial_accounts
  where account_type = 'company_treasury' and currency_id = invoice_record.currency_id;
  if p_from_account_id is null then
    select id into strict payer_id from public.financial_accounts
    where account_type = 'external' and currency_id = invoice_record.currency_id;
  else
    select id into payer_id from public.financial_accounts
    where id = p_from_account_id and currency_id = invoice_record.currency_id and status = 'active';
    if not found then raise exception using errcode = '22023', message = 'invoice_payer_account_invalid'; end if;
  end if;
  transaction_id := private.post_two_sided_financial_transaction(
    'order_payment', payer_id, treasury_id, p_amount_minor, p_occurred_on,
    coalesce(nullif(btrim(p_note), ''), 'Payment for ' || invoice_record.public_reference),
    p_payment_reference, 'order_invoice', invoice_record.id, invoice_record.public_reference,
    actor_id, p_request_id
  );
  insert into public.sales_invoice_payments (
    sales_invoice_id, financial_transaction_id, amount_minor, recorded_by_actor_id, source_request_id
  ) values (invoice_record.id, transaction_id, p_amount_minor, actor_id, p_request_id);
  paid_total := paid_total + p_amount_minor;
  next_status := case when paid_total = invoice_record.total_amount_minor then 'paid' else 'partially_paid' end;
  update public.sales_invoices as invoice set status = next_status, version = invoice.version + 1
  where invoice.id = invoice_record.id returning invoice.version into next_version;
  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload, deduplication_key)
  values ('finance.invoice_payment_recorded', 'sales_invoice', invoice_record.id,
    jsonb_build_object('public_reference', invoice_record.public_reference, 'amount_minor', p_amount_minor,
      'status', next_status, 'payment_reference', p_payment_reference),
    'finance.invoice_payment_recorded:' || p_request_id::text);
  return query select invoice_record.id, next_status, paid_total,
    invoice_record.total_amount_minor - paid_total, next_version;
end;
$$;

create function public.staff_void_invoice(
  p_invoice_id uuid, p_expected_version bigint, p_reason text, p_request_id uuid
)
returns table (invoice_id uuid, status text, version bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; invoice_record public.sales_invoices%rowtype;
begin
  actor_id := private.set_staff_audit_context('finance.invoice.manage', p_reason, p_request_id);
  select * into invoice_record from public.sales_invoices where id = p_invoice_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'invoice_not_found'; end if;
  if invoice_record.version <> p_expected_version then raise exception using errcode = '40001', message = 'invoice_version_conflict'; end if;
  if invoice_record.status <> 'open' or exists (select 1 from public.sales_invoice_payments where sales_invoice_id = invoice_record.id) then
    raise exception using errcode = '22023', message = 'invoice_cannot_be_voided';
  end if;
  update public.sales_invoices as invoice set status = 'void', voided_at = statement_timestamp(),
    voided_by_actor_id = actor_id, void_reason = btrim(p_reason), version = invoice.version + 1
  where invoice.id = invoice_record.id returning invoice.version into invoice_record.version;
  return query select invoice_record.id, 'void'::text, invoice_record.version;
end;
$$;

create function public.dealer_transfer_funds(
  p_from_account_id uuid, p_to_account_reference text, p_amount_minor bigint,
  p_occurred_on date, p_memo text, p_request_id uuid
)
returns table (transaction_id uuid, public_reference text, available_balance_minor bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare source_account public.financial_accounts%rowtype; destination_account public.financial_accounts%rowtype;
  actor_id uuid; created_id uuid;
begin
  select * into source_account from public.financial_accounts where id = p_from_account_id for update;
  if not found or source_account.party_id is null or source_account.status <> 'active'
    or source_account.hidden_from_routine_ui or source_account.account_type not in ('business', 'personal') then
    raise exception using errcode = '22023', message = 'dealer_source_account_invalid';
  end if;
  select context.actor_id into actor_id
  from private.set_dealer_audit_context(
    source_account.party_id, 'bank.transfer',
    coalesce(nullif(btrim(p_memo), ''), 'Business account transfer.'), p_request_id
  ) as context;
  select destination.* into destination_account from public.financial_accounts as destination
  where destination.public_reference = private.normalize_registry_reference(p_to_account_reference)
    and destination.status = 'active' and not destination.hidden_from_routine_ui
    and destination.account_type <> 'external';
  if not found or destination_account.currency_id <> source_account.currency_id then
    raise exception using errcode = '22023', message = 'dealer_destination_account_invalid';
  end if;
  created_id := private.post_two_sided_financial_transaction(
    'transfer', source_account.id, destination_account.id, p_amount_minor, p_occurred_on,
    p_memo, null, null, null, null, actor_id, p_request_id
  );
  return query select created_id, transaction.public_reference,
    private.financial_account_available_balance(source_account.id)
  from public.financial_transactions as transaction where transaction.id = created_id;
end;
$$;

create function public.dealer_record_invoice_payment(
  p_invoice_id uuid, p_from_account_id uuid, p_amount_minor bigint,
  p_occurred_on date, p_payment_reference text, p_request_id uuid
)
returns table (invoice_id uuid, invoice_status text, paid_amount_minor bigint, balance_due_minor bigint, version bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; invoice_record public.sales_invoices%rowtype; payer public.financial_accounts%rowtype;
  paid_total bigint; treasury_id uuid; transaction_id uuid; next_status text; next_version bigint;
begin
  select * into invoice_record from public.sales_invoices where id = p_invoice_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'invoice_not_found'; end if;
  select context.actor_id into actor_id
  from private.set_dealer_audit_context(
    invoice_record.ordering_party_id, 'bank.transfer',
    'Business invoice payment ' || invoice_record.public_reference, p_request_id
  ) as context;
  select * into payer from public.financial_accounts where id = p_from_account_id for update;
  if not found or payer.party_id <> invoice_record.ordering_party_id or payer.status <> 'active'
    or payer.currency_id <> invoice_record.currency_id or payer.hidden_from_routine_ui
    or payer.account_type not in ('business', 'personal') then
    raise exception using errcode = '22023', message = 'invoice_payer_account_invalid';
  end if;
  select coalesce(sum(payment.amount_minor), 0)::bigint into paid_total
  from public.sales_invoice_payments as payment
  where payment.sales_invoice_id = invoice_record.id;
  if exists (select 1 from public.sales_invoice_payments where source_request_id = p_request_id) then
    return query select invoice_record.id, invoice_record.status, paid_total,
      greatest(invoice_record.total_amount_minor - paid_total, 0), invoice_record.version;
    return;
  end if;
  if invoice_record.status in ('paid', 'void') or p_amount_minor <= 0
    or p_amount_minor > invoice_record.total_amount_minor - paid_total then
    raise exception using errcode = '22023', message = 'invoice_payment_amount_invalid';
  end if;
  select id into strict treasury_id from public.financial_accounts
  where account_type = 'company_treasury' and currency_id = invoice_record.currency_id;
  transaction_id := private.post_two_sided_financial_transaction(
    'order_payment', payer.id, treasury_id, p_amount_minor, p_occurred_on,
    'Payment for ' || invoice_record.public_reference, p_payment_reference,
    'order_invoice', invoice_record.id, invoice_record.public_reference, actor_id, p_request_id
  );
  insert into public.sales_invoice_payments (
    sales_invoice_id, financial_transaction_id, amount_minor, recorded_by_actor_id, source_request_id
  ) values (invoice_record.id, transaction_id, p_amount_minor, actor_id, p_request_id);
  paid_total := paid_total + p_amount_minor;
  next_status := case when paid_total = invoice_record.total_amount_minor then 'paid' else 'partially_paid' end;
  update public.sales_invoices as invoice set status = next_status, version = invoice.version + 1
  where invoice.id = invoice_record.id returning invoice.version into next_version;
  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload, deduplication_key)
  values ('finance.invoice_payment_recorded', 'sales_invoice', invoice_record.id,
    jsonb_build_object('public_reference', invoice_record.public_reference, 'amount_minor', p_amount_minor,
      'status', next_status, 'payment_reference', p_payment_reference, 'channel', 'business_portal'),
    'finance.invoice_payment_recorded:' || p_request_id::text);
  return query select invoice_record.id, next_status, paid_total,
    invoice_record.total_amount_minor - paid_total, next_version;
end;
$$;

create function public.staff_reverse_financial_transaction(
  p_transaction_id uuid, p_reason text, p_request_id uuid
)
returns table (transaction_id uuid, public_reference text)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; original public.financial_transactions%rowtype; from_entry record; to_entry record; created_id uuid;
begin
  actor_id := private.set_staff_audit_context('finance.transaction.reverse', p_reason, p_request_id);
  select * into original from public.financial_transactions where id = p_transaction_id;
  if not found then raise exception using errcode = 'P0002', message = 'financial_transaction_not_found'; end if;
  if original.transaction_type = 'reversal' or exists (
    select 1 from public.financial_transactions where reverses_transaction_id = original.id
  ) then raise exception using errcode = '22023', message = 'financial_transaction_not_reversible'; end if;
  if original.transaction_type in ('order_payment', 'loan_payment') then
    raise exception using errcode = '22023', message = 'linked_payment_requires_domain_refund';
  end if;
  select entry.financial_account_id, entry.amount_minor into from_entry
  from public.financial_entries as entry where entry.financial_transaction_id = original.id and entry.amount_minor < 0;
  select entry.financial_account_id, entry.amount_minor into to_entry
  from public.financial_entries as entry where entry.financial_transaction_id = original.id and entry.amount_minor > 0;
  created_id := private.post_two_sided_financial_transaction(
    'reversal', to_entry.financial_account_id, from_entry.financial_account_id, to_entry.amount_minor,
    current_date, 'Reversal of ' || original.public_reference || ': ' || btrim(p_reason),
    original.external_reference, original.source_record_type, original.source_record_id,
    original.public_reference, actor_id, p_request_id, original.id
  );
  return query select created_id, transaction.public_reference
  from public.financial_transactions as transaction where transaction.id = created_id;
end;
$$;

create function public.staff_set_financial_account_status(
  p_account_id uuid, p_expected_version bigint, p_status text, p_reason text, p_request_id uuid
)
returns table (account_id uuid, status text, version bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; account_record public.financial_accounts%rowtype;
begin
  actor_id := private.set_staff_audit_context('finance.account.manage', p_reason, p_request_id);
  select * into account_record from public.financial_accounts where id = p_account_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'financial_account_not_found'; end if;
  if account_record.version <> p_expected_version then raise exception using errcode = '40001', message = 'financial_account_version_conflict'; end if;
  if account_record.account_type in ('company_treasury', 'external') or p_status not in ('active', 'frozen', 'closed') then
    raise exception using errcode = '22023', message = 'financial_account_status_invalid';
  end if;
  if p_status = 'closed' and (private.financial_account_balance(account_record.id) <> 0
    or exists (select 1 from public.financial_account_holds as account_hold
      where account_hold.financial_account_id = account_record.id and account_hold.status = 'active')
    or exists (select 1 from public.loans as loan
      where loan.borrower_account_id = account_record.id and loan.status in ('active', 'defaulted'))) then
    raise exception using errcode = '23514', message = 'financial_account_cannot_close';
  end if;
  update public.financial_accounts as account set status = p_status,
    closed_at = case when p_status = 'closed' then statement_timestamp() else null end,
    version = account.version + 1 where account.id = account_record.id
  returning account.version into account_record.version;
  return query select account_record.id, p_status, account_record.version;
end;
$$;

create function public.staff_place_account_hold(
  p_account_id uuid, p_amount_minor bigint, p_expires_at timestamptz,
  p_related_record_type text, p_related_record_id uuid, p_reason text, p_request_id uuid
)
returns table (hold_id uuid, public_reference text, available_balance_minor bigint, version bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; account_record public.financial_accounts%rowtype; existing public.financial_account_holds%rowtype;
  created public.financial_account_holds%rowtype;
begin
  actor_id := private.set_staff_audit_context('finance.transaction.post', p_reason, p_request_id);
  select * into existing from public.financial_account_holds where source_request_id = p_request_id;
  if found then return query select existing.id, existing.public_reference,
    private.financial_account_available_balance(existing.financial_account_id), existing.version; return; end if;
  select * into account_record from public.financial_accounts where id = p_account_id for update;
  if not found or account_record.status <> 'active' or account_record.hidden_from_routine_ui
    or p_amount_minor <= 0 or (p_expires_at is not null and p_expires_at <= statement_timestamp()) then
    raise exception using errcode = '22023', message = 'financial_hold_invalid';
  end if;
  if not account_record.allow_negative and private.financial_account_available_balance(account_record.id) < p_amount_minor then
    raise exception using errcode = '23514', message = 'financial_insufficient_funds';
  end if;
  insert into public.financial_account_holds (
    public_reference, financial_account_id, amount_minor, reason, related_record_type,
    related_record_id, expires_at, created_by_actor_id, source_request_id
  ) values (
    private.allocate_finance_reference('account_hold'), account_record.id, p_amount_minor, btrim(p_reason),
    nullif(btrim(coalesce(p_related_record_type, '')), ''), p_related_record_id, p_expires_at, actor_id, p_request_id
  ) returning * into created;
  return query select created.id, created.public_reference,
    private.financial_account_available_balance(account_record.id), created.version;
end;
$$;

create function public.staff_release_account_hold(
  p_hold_id uuid, p_expected_version bigint, p_reason text, p_request_id uuid
)
returns table (hold_id uuid, status text, available_balance_minor bigint, version bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; hold_record public.financial_account_holds%rowtype;
begin
  actor_id := private.set_staff_audit_context('finance.transaction.post', p_reason, p_request_id);
  select * into hold_record from public.financial_account_holds where id = p_hold_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'financial_hold_not_found'; end if;
  if hold_record.release_request_id = p_request_id then return query select hold_record.id, hold_record.status,
    private.financial_account_available_balance(hold_record.financial_account_id), hold_record.version; return; end if;
  if hold_record.version <> p_expected_version or hold_record.status <> 'active' then
    raise exception using errcode = '40001', message = 'financial_hold_version_conflict';
  end if;
  update public.financial_account_holds as account_hold set status = 'released', released_at = statement_timestamp(),
    released_by_actor_id = actor_id, release_reason = btrim(p_reason), release_request_id = p_request_id,
    version = account_hold.version + 1 where account_hold.id = hold_record.id
    returning account_hold.version into hold_record.version;
  return query select hold_record.id, 'released'::text,
    private.financial_account_available_balance(hold_record.financial_account_id), hold_record.version;
end;
$$;

create function public.staff_create_loan_product(
  p_code text, p_display_name text, p_description text, p_annual_rate_basis_points integer,
  p_repayment_frequency text, p_minimum_term_count integer, p_maximum_term_count integer,
  p_minimum_principal_minor bigint, p_maximum_principal_minor bigint,
  p_grace_days integer, p_late_fee_minor bigint, p_reason text, p_request_id uuid
)
returns table (loan_product_id uuid, code text, version bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; existing public.loan_products%rowtype; created public.loan_products%rowtype;
begin
  actor_id := private.set_staff_audit_context('finance.account.manage', p_reason, p_request_id);
  select * into existing from public.loan_products where source_request_id = p_request_id;
  if found then return query select existing.id, existing.code, existing.version; return; end if;
  if lower(btrim(coalesce(p_code, ''))) !~ '^[a-z][a-z0-9-]{2,49}$'
    or btrim(coalesce(p_display_name, '')) = '' or p_repayment_frequency not in ('weekly', 'monthly')
    or p_annual_rate_basis_points not between 0 and 100000 or p_minimum_term_count <= 0
    or p_maximum_term_count < p_minimum_term_count or p_maximum_term_count > 520
    or p_minimum_principal_minor <= 0 or (p_maximum_principal_minor is not null and p_maximum_principal_minor < p_minimum_principal_minor)
    or p_grace_days not between 0 and 365 or p_late_fee_minor < 0 then
    raise exception using errcode = '22023', message = 'loan_product_invalid';
  end if;
  insert into public.loan_products (
    code, display_name, description, annual_rate_basis_points, repayment_frequency,
    minimum_term_count, maximum_term_count, minimum_principal_minor, maximum_principal_minor,
    grace_days, late_fee_minor, created_by_actor_id, source_request_id
  ) values (
    lower(btrim(p_code)), btrim(p_display_name), coalesce(btrim(p_description), ''), p_annual_rate_basis_points,
    p_repayment_frequency, p_minimum_term_count, p_maximum_term_count, p_minimum_principal_minor,
    p_maximum_principal_minor, p_grace_days, p_late_fee_minor, actor_id, p_request_id
  ) returning * into created;
  return query select created.id, created.code, created.version;
end;
$$;

create function public.staff_originate_loan(
  p_loan_product_id uuid, p_borrower_account_id uuid, p_principal_minor bigint,
  p_term_count integer, p_originated_on date, p_first_due_on date, p_purpose text,
  p_reason text, p_request_id uuid
)
returns table (loan_id uuid, public_reference text, status text, version bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; existing public.loans%rowtype; product public.loan_products%rowtype;
  borrower public.financial_accounts%rowtype; treasury_id uuid; created_id uuid; created_reference text;
  disbursement_id uuid; maturity date; period_count integer; remaining bigint; principal_piece bigint;
  interest_piece bigint; due_date date; period_year integer;
begin
  actor_id := private.set_staff_audit_context('finance.account.manage', p_reason, p_request_id);
  select * into existing from public.loans where source_request_id = p_request_id;
  if found then return query select existing.id, existing.public_reference, existing.status, existing.version; return; end if;
  select * into product from public.loan_products where id = p_loan_product_id and active;
  if not found then raise exception using errcode = '22023', message = 'loan_product_invalid'; end if;
  select * into borrower from public.financial_accounts where id = p_borrower_account_id for update;
  if not found or borrower.status <> 'active' or borrower.account_type not in ('business', 'personal') then
    raise exception using errcode = '22023', message = 'loan_borrower_invalid';
  end if;
  if p_principal_minor < product.minimum_principal_minor
    or (product.maximum_principal_minor is not null and p_principal_minor > product.maximum_principal_minor)
    or p_term_count < product.minimum_term_count or p_term_count > product.maximum_term_count
    or p_originated_on is null or p_first_due_on <= p_originated_on then
    raise exception using errcode = '22023', message = 'loan_terms_invalid';
  end if;
  select id into strict treasury_id from public.financial_accounts
  where account_type = 'company_treasury' and currency_id = borrower.currency_id;
  created_id := extensions.gen_random_uuid();
  created_reference := private.allocate_finance_reference('loan');
  maturity := case when product.repayment_frequency = 'weekly'
    then p_first_due_on + ((p_term_count - 1) * 7)
    else (p_first_due_on + make_interval(months => p_term_count - 1))::date end;
  -- Loan row needs the immutable disbursement id, so reserve and post the transaction first.
  disbursement_id := private.post_two_sided_financial_transaction(
    'loan_disbursement', treasury_id, borrower.id, p_principal_minor, p_originated_on,
    'Loan disbursement ' || created_reference || coalesce(': ' || nullif(btrim(p_purpose), ''), ''),
    null, 'loan', created_id, created_reference, actor_id, extensions.gen_random_uuid()
  );
  insert into public.loans (
    id, public_reference, loan_product_id, borrower_account_id, borrower_party_id, currency_id,
    principal_minor, annual_rate_basis_points, repayment_frequency, term_count,
    originated_on, first_due_on, maturity_on, purpose, disbursement_transaction_id,
    originated_by_actor_id, source_request_id
  ) values (
    created_id, created_reference, product.id, borrower.id, borrower.party_id, borrower.currency_id,
    p_principal_minor, product.annual_rate_basis_points, product.repayment_frequency, p_term_count,
    p_originated_on, p_first_due_on, maturity, coalesce(btrim(p_purpose), ''), disbursement_id,
    actor_id, p_request_id
  );
  remaining := p_principal_minor;
  period_year := case when product.repayment_frequency = 'weekly' then 52 else 12 end;
  for period_count in 1..p_term_count loop
    principal_piece := case when period_count = p_term_count then remaining else floor(p_principal_minor::numeric / p_term_count)::bigint end;
    interest_piece := round(remaining::numeric * product.annual_rate_basis_points / 10000 / period_year)::bigint;
    due_date := case when product.repayment_frequency = 'weekly' then p_first_due_on + ((period_count - 1) * 7)
      else (p_first_due_on + make_interval(months => period_count - 1))::date end;
    insert into public.loan_installments (
      loan_id, installment_number, due_on, principal_due_minor, interest_due_minor
    ) values (created_id, period_count, due_date, principal_piece, interest_piece);
    remaining := remaining - principal_piece;
  end loop;
  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload, deduplication_key)
  values ('finance.loan_originated', 'loan', created_id,
    jsonb_build_object('public_reference', created_reference, 'principal_minor', p_principal_minor,
      'borrower_account_reference', borrower.public_reference, 'maturity_on', maturity),
    'finance.loan_originated:' || p_request_id::text);
  return query select created_id, created_reference, 'active'::text, 1::bigint;
end;
$$;

create function public.staff_record_loan_payment(
  p_loan_id uuid, p_amount_minor bigint, p_occurred_on date, p_payment_reference text,
  p_note text, p_reason text, p_request_id uuid
)
returns table (loan_id uuid, loan_status text, remaining_due_minor bigint, version bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; loan_record public.loans%rowtype; treasury_id uuid; transaction_id uuid;
  payment_id uuid; unapplied bigint; payment_installment record; interest_remaining bigint; fee_remaining bigint;
  principal_remaining bigint; take_fee bigint; take_interest bigint; take_principal bigint;
  total_remaining bigint; next_status text; next_version bigint;
begin
  actor_id := private.set_staff_audit_context('finance.transaction.post', p_reason, p_request_id);
  select * into loan_record from public.loans where id = p_loan_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'loan_not_found'; end if;
  if exists (select 1 from public.loan_payments where source_request_id = p_request_id) then
    select coalesce(sum((installment.principal_due_minor + installment.interest_due_minor + installment.fee_due_minor)
      - coalesce(paid.principal, 0) - coalesce(paid.interest, 0) - coalesce(paid.fee, 0)), 0)::bigint
    into total_remaining from public.loan_installments as installment
    left join lateral (select sum(allocation.principal_minor)::bigint as principal, sum(allocation.interest_minor)::bigint as interest,
      sum(allocation.fee_minor)::bigint as fee from public.loan_payment_allocations as allocation where allocation.loan_installment_id = installment.id) as paid on true
    where installment.loan_id = loan_record.id and installment.status <> 'waived';
    return query select loan_record.id, loan_record.status, total_remaining, loan_record.version; return;
  end if;
  if loan_record.status not in ('active', 'defaulted') or p_amount_minor <= 0 then
    raise exception using errcode = '22023', message = 'loan_payment_invalid';
  end if;
  select coalesce(sum((installment.principal_due_minor + installment.interest_due_minor + installment.fee_due_minor)
    - coalesce(paid.principal, 0) - coalesce(paid.interest, 0) - coalesce(paid.fee, 0)), 0)::bigint
  into total_remaining from public.loan_installments as installment
  left join lateral (select sum(allocation.principal_minor)::bigint as principal, sum(allocation.interest_minor)::bigint as interest,
    sum(allocation.fee_minor)::bigint as fee from public.loan_payment_allocations as allocation where allocation.loan_installment_id = installment.id) as paid on true
  where installment.loan_id = loan_record.id and installment.status <> 'waived';
  if p_amount_minor > total_remaining then raise exception using errcode = '22023', message = 'loan_payment_exceeds_balance'; end if;
  select id into strict treasury_id from public.financial_accounts where account_type = 'company_treasury' and currency_id = loan_record.currency_id;
  transaction_id := private.post_two_sided_financial_transaction(
    'loan_payment', loan_record.borrower_account_id, treasury_id, p_amount_minor, p_occurred_on,
    coalesce(nullif(btrim(p_note), ''), 'Loan payment ' || loan_record.public_reference),
    p_payment_reference, null, null, loan_record.public_reference, actor_id, p_request_id
  );
  insert into public.loan_payments (
    loan_id, financial_transaction_id, amount_minor, occurred_on, payment_reference,
    recorded_by_actor_id, source_request_id
  ) values (
    loan_record.id, transaction_id, p_amount_minor, p_occurred_on,
    nullif(btrim(coalesce(p_payment_reference, '')), ''), actor_id, p_request_id
  ) returning id into payment_id;
  unapplied := p_amount_minor;
  for payment_installment in
    select scheduled.id, scheduled.principal_due_minor, scheduled.interest_due_minor, scheduled.fee_due_minor,
      scheduled.version, coalesce(paid.principal, 0)::bigint as principal_paid,
      coalesce(paid.interest, 0)::bigint as interest_paid, coalesce(paid.fee, 0)::bigint as fee_paid
    from public.loan_installments as scheduled
    left join lateral (select sum(allocation.principal_minor)::bigint as principal, sum(allocation.interest_minor)::bigint as interest,
      sum(allocation.fee_minor)::bigint as fee from public.loan_payment_allocations as allocation where allocation.loan_installment_id = scheduled.id) as paid on true
    where scheduled.loan_id = loan_record.id and scheduled.status <> 'waived'
      and scheduled.principal_due_minor + scheduled.interest_due_minor + scheduled.fee_due_minor
        > coalesce(paid.principal, 0) + coalesce(paid.interest, 0) + coalesce(paid.fee, 0)
    order by scheduled.installment_number
  loop
    exit when unapplied = 0;
    fee_remaining := payment_installment.fee_due_minor - payment_installment.fee_paid;
    interest_remaining := payment_installment.interest_due_minor - payment_installment.interest_paid;
    principal_remaining := payment_installment.principal_due_minor - payment_installment.principal_paid;
    take_fee := least(unapplied, fee_remaining); unapplied := unapplied - take_fee;
    take_interest := least(unapplied, interest_remaining); unapplied := unapplied - take_interest;
    take_principal := least(unapplied, principal_remaining); unapplied := unapplied - take_principal;
    insert into public.loan_payment_allocations (
      loan_payment_id, loan_installment_id, principal_minor, interest_minor, fee_minor
    ) values (payment_id, payment_installment.id, take_principal, take_interest, take_fee);
    update public.loan_installments as scheduled set status = case
      when payment_installment.principal_paid + take_principal = payment_installment.principal_due_minor
        and payment_installment.interest_paid + take_interest = payment_installment.interest_due_minor
        and payment_installment.fee_paid + take_fee = payment_installment.fee_due_minor then 'paid'
      else 'partially_paid' end, version = scheduled.version + 1
    where scheduled.id = payment_installment.id;
  end loop;
  total_remaining := total_remaining - p_amount_minor;
  next_status := case when total_remaining = 0 then 'paid' else loan_record.status end;
  update public.loans as loan set status = next_status, version = loan.version + 1
  where loan.id = loan_record.id returning loan.version into next_version;
  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload, deduplication_key)
  values ('finance.loan_payment_recorded', 'loan', loan_record.id,
    jsonb_build_object('public_reference', loan_record.public_reference, 'amount_minor', p_amount_minor,
      'remaining_due_minor', total_remaining, 'status', next_status),
    'finance.loan_payment_recorded:' || p_request_id::text);
  return query select loan_record.id, next_status, total_remaining, next_version;
end;
$$;

create function public.staff_mark_loan_default(
  p_loan_id uuid, p_expected_version bigint, p_status text, p_reason text, p_request_id uuid
)
returns table (loan_id uuid, status text, version bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare actor_id uuid; loan_record public.loans%rowtype;
begin
  actor_id := private.set_staff_audit_context('finance.account.manage', p_reason, p_request_id);
  select * into loan_record from public.loans where id = p_loan_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'loan_not_found'; end if;
  if loan_record.version <> p_expected_version then raise exception using errcode = '40001', message = 'loan_version_conflict'; end if;
  if p_status not in ('active', 'defaulted', 'written_off') or loan_record.status = 'paid' then
    raise exception using errcode = '22023', message = 'loan_status_invalid';
  end if;
  update public.loans as loan set status = p_status,
    defaulted_at = case when p_status in ('defaulted', 'written_off') then statement_timestamp() else null end,
    default_reason = case when p_status in ('defaulted', 'written_off') then btrim(p_reason) else null end,
    version = loan.version + 1 where loan.id = loan_record.id returning loan.version into loan_record.version;
  return query select loan_record.id, p_status, loan_record.version;
end;
$$;

create function private.record_activity_finance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare treasury_id uuid; clearing_id uuid;
begin
  if new.activity_type = 'anonymous_purchase' and new.financial_status = 'paid' then
    select account.id into strict treasury_id from public.financial_accounts as account
    join public.currencies as currency on currency.id = account.currency_id
    where account.account_type = 'company_treasury' and currency.code = new.currency_code;
    select account.id into strict clearing_id from public.financial_accounts as account
    join public.currencies as currency on currency.id = account.currency_id
    where account.account_type = 'external' and currency.code = new.currency_code;
    perform private.post_two_sided_financial_transaction(
      'purchase_payment', treasury_id, clearing_id, new.total_amount_minor, new.occurred_on,
      'Aggregate material purchase ' || new.public_reference, null,
      'stock_activity', new.id, new.public_reference, new.recorded_by_actor_id, new.source_request_id
    );
  end if;
  return new;
end;
$$;
create trigger stock_activity_finance after insert on public.stock_activity_entries
for each row execute function private.record_activity_finance();

create function private.record_procurement_finance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare treasury_id uuid; clearing_id uuid;
begin
  if new.settlement_status = 'paid' and (tg_op = 'INSERT' or old.settlement_status <> 'paid') then
    select account.id into strict treasury_id from public.financial_accounts as account
    join public.currencies as currency on currency.id = account.currency_id
    where account.account_type = 'company_treasury' and currency.code = new.currency_code;
    select account.id into strict clearing_id from public.financial_accounts as account
    join public.currencies as currency on currency.id = account.currency_id
    where account.account_type = 'external' and currency.code = new.currency_code;
    perform private.post_two_sided_financial_transaction(
      'procurement_payment', treasury_id, clearing_id, new.total_amount_minor, coalesce(new.settled_at::date, new.received_at::date),
      'Supplier payment ' || new.public_reference, new.settlement_reference,
      'procurement_delivery', new.id, new.public_reference, new.settled_by_actor_id,
      coalesce(new.settlement_request_id, extensions.gen_random_uuid())
    );
  end if;
  return new;
end;
$$;
create trigger procurement_delivery_finance after insert or update of settlement_status on public.procurement_deliveries
for each row execute function private.record_procurement_finance();

create function private.record_consignment_finance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare treasury_id uuid; clearing_id uuid;
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status <> 'paid') then
    select account.id into strict treasury_id from public.financial_accounts as account
    join public.currencies as currency on currency.id = account.currency_id
    where account.account_type = 'company_treasury' and currency.code = new.currency_code;
    select account.id into strict clearing_id from public.financial_accounts as account
    join public.currencies as currency on currency.id = account.currency_id
    where account.account_type = 'external' and currency.code = new.currency_code;
    perform private.post_two_sided_financial_transaction(
      'consignment_payment', treasury_id, clearing_id, new.owner_amount_minor, coalesce(new.paid_at::date, current_date),
      'Consignment settlement ' || new.public_reference, new.payment_reference,
      'consignment_settlement', new.id, new.public_reference, new.paid_by_actor_id,
      coalesce(new.payment_request_id, extensions.gen_random_uuid())
    );
  end if;
  return new;
end;
$$;
create trigger consignment_settlement_finance after insert or update of status on public.consignment_settlements
for each row execute function private.record_consignment_finance();

-- Backfill already recorded paid procurement evidence into the new ledger.
do $$ declare activity public.stock_activity_entries%rowtype; begin
  for activity in select * from public.stock_activity_entries where activity_type = 'anonymous_purchase' and financial_status = 'paid'
  loop
    perform private.post_two_sided_financial_transaction(
      'purchase_payment',
      (select account.id from public.financial_accounts as account join public.currencies as currency on currency.id = account.currency_id where account.account_type = 'company_treasury' and currency.code = activity.currency_code),
      (select account.id from public.financial_accounts as account join public.currencies as currency on currency.id = account.currency_id where account.account_type = 'external' and currency.code = activity.currency_code),
      activity.total_amount_minor, activity.occurred_on, 'Aggregate material purchase ' || activity.public_reference,
      null, 'stock_activity', activity.id, activity.public_reference, activity.recorded_by_actor_id, activity.source_request_id
    );
  end loop;
end $$;

do $$ declare delivery public.procurement_deliveries%rowtype; begin
  for delivery in select * from public.procurement_deliveries where settlement_status = 'paid'
  loop
    perform private.post_two_sided_financial_transaction(
      'procurement_payment',
      (select account.id from public.financial_accounts as account join public.currencies as currency on currency.id = account.currency_id where account.account_type = 'company_treasury' and currency.code = delivery.currency_code),
      (select account.id from public.financial_accounts as account join public.currencies as currency on currency.id = account.currency_id where account.account_type = 'external' and currency.code = delivery.currency_code),
      delivery.total_amount_minor, coalesce(delivery.settled_at::date, delivery.received_at::date),
      'Supplier payment ' || delivery.public_reference, delivery.settlement_reference,
      'procurement_delivery', delivery.id, delivery.public_reference, delivery.settled_by_actor_id,
      coalesce(delivery.settlement_request_id, extensions.gen_random_uuid())
    );
  end loop;
end $$;

do $$ declare settlement public.consignment_settlements%rowtype; begin
  for settlement in select * from public.consignment_settlements where status = 'paid'
  loop
    perform private.post_two_sided_financial_transaction(
      'consignment_payment',
      (select account.id from public.financial_accounts as account join public.currencies as currency on currency.id = account.currency_id where account.account_type = 'company_treasury' and currency.code = settlement.currency_code),
      (select account.id from public.financial_accounts as account join public.currencies as currency on currency.id = account.currency_id where account.account_type = 'external' and currency.code = settlement.currency_code),
      settlement.owner_amount_minor, coalesce(settlement.paid_at::date, current_date),
      'Consignment settlement ' || settlement.public_reference, settlement.payment_reference,
      'consignment_settlement', settlement.id, settlement.public_reference, settlement.paid_by_actor_id,
      coalesce(settlement.payment_request_id, extensions.gen_random_uuid())
    );
  end loop;
end $$;

create or replace function public.get_staff_money_workspace()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform 1 from private.require_staff_permission('finance.bank.read');
  return jsonb_build_object(
    'generated_at', statement_timestamp(),
    'capabilities', jsonb_build_object(
      'can_post', private.staff_has_permission('finance.transaction.post'),
      'can_invoice', private.staff_has_permission('finance.invoice.manage'),
      'can_manage_accounts', private.staff_has_permission('finance.account.manage'),
      'can_reverse', private.staff_has_permission('finance.transaction.reverse')
    ),
    'summaries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'currency_code', currency.code,
        'paid_total_minor', coalesce((select sum(transaction_amount.amount_minor) from (
          select max(abs(entry.amount_minor))::bigint as amount_minor
          from public.financial_transactions as transaction
          join public.financial_entries as entry on entry.financial_transaction_id = transaction.id
          where transaction.currency_id = currency.id and transaction.transaction_type in ('purchase_payment', 'procurement_payment', 'consignment_payment')
          group by transaction.id
        ) as transaction_amount), 0),
        'paid_30d_minor', coalesce((select sum(transaction_amount.amount_minor) from (
          select max(abs(entry.amount_minor))::bigint as amount_minor
          from public.financial_transactions as transaction
          join public.financial_entries as entry on entry.financial_transaction_id = transaction.id
          where transaction.currency_id = currency.id and transaction.transaction_type in ('purchase_payment', 'procurement_payment', 'consignment_payment')
            and transaction.occurred_on >= current_date - 29
          group by transaction.id
        ) as transaction_amount), 0),
        'outstanding_total_minor', coalesce((select sum(delivery.total_amount_minor) from public.procurement_deliveries as delivery
          left join public.inventory_transactions as reversal on reversal.reversal_of_id = delivery.inventory_transaction_id
          where delivery.currency_code = currency.code and delivery.settlement_status = 'pending' and reversal.id is null), 0),
        'treasury_balance_minor', coalesce((select sum(private.financial_account_balance(account.id)) from public.financial_accounts as account where account.currency_id = currency.id and account.account_type = 'company_treasury'), 0),
        'customer_deposits_minor', coalesce((select sum(private.financial_account_balance(account.id)) from public.financial_accounts as account where account.currency_id = currency.id and account.account_type in ('business', 'personal')), 0),
        'receivable_minor', coalesce((select sum(invoice.total_amount_minor - coalesce(payment.paid, 0)) from public.sales_invoices as invoice left join lateral (
          select sum(allocation.amount_minor)::bigint as paid from public.sales_invoice_payments as allocation
          join public.financial_transactions as transaction on transaction.id = allocation.financial_transaction_id
          where allocation.sales_invoice_id = invoice.id and not exists (select 1 from public.financial_transactions as reversal where reversal.reverses_transaction_id = transaction.id)
        ) as payment on true where invoice.currency_id = currency.id and invoice.status not in ('paid', 'void')), 0),
        'overdue_minor', coalesce((select sum(invoice.total_amount_minor - coalesce(payment.paid, 0)) from public.sales_invoices as invoice left join lateral (
          select sum(allocation.amount_minor)::bigint as paid from public.sales_invoice_payments as allocation
          join public.financial_transactions as transaction on transaction.id = allocation.financial_transaction_id
          where allocation.sales_invoice_id = invoice.id and not exists (select 1 from public.financial_transactions as reversal where reversal.reverses_transaction_id = transaction.id)
        ) as payment on true where invoice.currency_id = currency.id and invoice.status not in ('paid', 'void') and invoice.due_on < current_date), 0),
        'loan_principal_outstanding_minor', coalesce((select sum(remaining.principal_due) from (
          select loan.id, coalesce(sum(installment.principal_due_minor - coalesce(paid.principal, 0)), 0)::bigint as principal_due
          from public.loans as loan join public.loan_installments as installment on installment.loan_id = loan.id
          left join lateral (select sum(allocation.principal_minor)::bigint as principal
            from public.loan_payment_allocations as allocation where allocation.loan_installment_id = installment.id) as paid on true
          where loan.currency_id = currency.id and loan.status in ('active', 'defaulted')
          group by loan.id
        ) as remaining), 0),
        'loan_overdue_minor', coalesce((select sum(
          installment.principal_due_minor + installment.interest_due_minor + installment.fee_due_minor
          - coalesce(paid.total_paid, 0))
          from public.loan_installments as installment join public.loans as loan on loan.id = installment.loan_id
          left join lateral (select sum(allocation.principal_minor + allocation.interest_minor + allocation.fee_minor)::bigint as total_paid
            from public.loan_payment_allocations as allocation where allocation.loan_installment_id = installment.id) as paid on true
          join public.loan_products as product on product.id = loan.loan_product_id
          where loan.currency_id = currency.id and loan.status in ('active', 'defaulted')
            and installment.due_on + product.grace_days < current_date
            and installment.principal_due_minor + installment.interest_due_minor + installment.fee_due_minor > coalesce(paid.total_paid, 0)), 0),
        'money_in_30d_minor', coalesce((select sum(entry.amount_minor) from public.financial_entries as entry join public.financial_transactions as transaction on transaction.id = entry.financial_transaction_id join public.financial_accounts as account on account.id = entry.financial_account_id where account.currency_id = currency.id and account.account_type = 'company_treasury' and entry.amount_minor > 0 and transaction.occurred_on >= current_date - 29), 0),
        'money_out_30d_minor', coalesce(-(select sum(entry.amount_minor) from public.financial_entries as entry join public.financial_transactions as transaction on transaction.id = entry.financial_transaction_id join public.financial_accounts as account on account.id = entry.financial_account_id where account.currency_id = currency.id and account.account_type = 'company_treasury' and entry.amount_minor < 0 and transaction.occurred_on >= current_date - 29), 0)
      ) order by currency.code) from public.currencies as currency where currency.active
    ), '[]'::jsonb),
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', account.id, 'public_reference', account.public_reference, 'display_name', account.display_name,
        'account_type', account.account_type, 'party_id', account.party_id, 'party_name', party.display_name,
        'currency_code', currency.code, 'status', account.status,
        'balance_minor', private.financial_account_balance(account.id),
        'available_balance_minor', private.financial_account_available_balance(account.id),
        'active_hold_minor', private.financial_account_balance(account.id) - private.financial_account_available_balance(account.id),
        'version', account.version
      ) order by case account.account_type when 'company_treasury' then 0 when 'business' then 1 when 'personal' then 2 else 3 end, account.display_name)
      from (
        select visible_account.*
        from public.financial_accounts as visible_account
        where not visible_account.hidden_from_routine_ui
        order by case visible_account.account_type when 'company_treasury' then 0 when 'business' then 1 when 'personal' then 2 else 3 end,
          visible_account.display_name, visible_account.id
        limit 100
      ) as account
      join public.currencies as currency on currency.id = account.currency_id
      left join public.parties as party on party.id = account.party_id
    ), '[]'::jsonb),
    'holds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', hold.id, 'public_reference', hold.public_reference, 'account_id', hold.financial_account_id,
        'account_name', account.display_name, 'amount_minor', hold.amount_minor, 'currency_code', currency.code,
        'status', case when hold.status = 'active' and hold.expires_at <= statement_timestamp() then 'expired' else hold.status end,
        'reason', hold.reason, 'expires_at', hold.expires_at, 'version', hold.version
      ) order by case when hold.status = 'active' then 0 else 1 end, hold.created_at desc)
      from (select * from public.financial_account_holds order by created_at desc limit 200) as hold
      join public.financial_accounts as account on account.id = hold.financial_account_id
      join public.currencies as currency on currency.id = account.currency_id
    ), '[]'::jsonb),
    'unbilled_orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ordered.id, 'public_reference', ordered.public_reference, 'party_name', party.display_name,
        'currency_code', ordered.currency_code, 'total_amount_minor', totals.total_amount_minor,
        'submitted_at', ordered.submitted_at, 'status', ordered.status
      ) order by ordered.submitted_at desc)
      from (
        select candidate.* from public.orders as candidate
        where candidate.status in ('approved', 'partially_approved', 'awaiting_stock', 'processing', 'fulfilled')
        order by candidate.submitted_at desc, candidate.id
        limit 200
      ) as ordered join public.parties as party on party.id = ordered.ordering_party_id
      join lateral (select sum(round(coalesce(line.quantity_approved, line.quantity_requested) * line.unit_price_minor_snapshot))::bigint as total_amount_minor,
        bool_and(line.unit_price_minor_snapshot is not null) as all_priced
        from public.order_lines as line where line.order_id = ordered.id and line.status not in ('denied', 'cancelled')) as totals on true
      where totals.all_priced and totals.total_amount_minor > 0
        and not exists (select 1 from public.sales_invoices as invoice where invoice.order_id = ordered.id)
    ), '[]'::jsonb),
    'loan_products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', product.id, 'code', product.code, 'display_name', product.display_name,
        'annual_rate_basis_points', product.annual_rate_basis_points,
        'repayment_frequency', product.repayment_frequency,
        'minimum_term_count', product.minimum_term_count, 'maximum_term_count', product.maximum_term_count,
        'minimum_principal_minor', product.minimum_principal_minor,
        'maximum_principal_minor', product.maximum_principal_minor, 'grace_days', product.grace_days,
        'late_fee_minor', product.late_fee_minor, 'active', product.active, 'version', product.version
      ) order by product.active desc, product.display_name) from public.loan_products as product
    ), '[]'::jsonb),
    'loans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', loan.id, 'public_reference', loan.public_reference, 'product_name', product.display_name,
        'borrower_account_id', loan.borrower_account_id, 'borrower_account_name', account.display_name,
        'borrower_name', party.display_name, 'currency_code', currency.code,
        'principal_minor', loan.principal_minor, 'principal_paid_minor', coalesce(paid.principal, 0),
        'interest_paid_minor', coalesce(paid.interest, 0),
        'remaining_due_minor', coalesce(due.total_due, 0) - coalesce(paid.total_paid, 0),
        'overdue_minor', coalesce(overdue.total_due, 0) - coalesce(overdue.total_paid, 0),
        'next_due_on', due.next_due_on, 'annual_rate_basis_points', loan.annual_rate_basis_points,
        'repayment_frequency', loan.repayment_frequency, 'term_count', loan.term_count,
        'originated_on', loan.originated_on, 'maturity_on', loan.maturity_on,
        'status', loan.status, 'version', loan.version
      ) order by case when loan.status in ('active', 'defaulted') then 0 else 1 end, loan.maturity_on)
      from (
        select candidate.* from public.loans as candidate
        order by case when candidate.status in ('active', 'defaulted') then 0 else 1 end,
          candidate.maturity_on, candidate.id
        limit 200
      ) as loan join public.loan_products as product on product.id = loan.loan_product_id
      join public.financial_accounts as account on account.id = loan.borrower_account_id
      left join public.parties as party on party.id = loan.borrower_party_id
      join public.currencies as currency on currency.id = loan.currency_id
      left join lateral (select sum(installment.principal_due_minor + installment.interest_due_minor + installment.fee_due_minor)::bigint as total_due,
        min(installment.due_on) filter (where installment.status not in ('paid', 'waived')) as next_due_on
        from public.loan_installments as installment where installment.loan_id = loan.id) as due on true
      left join lateral (select sum(allocation.principal_minor)::bigint as principal,
        sum(allocation.interest_minor)::bigint as interest,
        sum(allocation.principal_minor + allocation.interest_minor + allocation.fee_minor)::bigint as total_paid
        from public.loan_payment_allocations as allocation join public.loan_installments as installment on installment.id = allocation.loan_installment_id
        where installment.loan_id = loan.id) as paid on true
      left join lateral (select sum(installment.principal_due_minor + installment.interest_due_minor + installment.fee_due_minor)::bigint as total_due,
        coalesce(sum(paid_installment.total_paid), 0)::bigint as total_paid
        from public.loan_installments as installment
        left join lateral (select sum(allocation.principal_minor + allocation.interest_minor + allocation.fee_minor)::bigint as total_paid
          from public.loan_payment_allocations as allocation where allocation.loan_installment_id = installment.id) as paid_installment on true
        where installment.loan_id = loan.id and installment.due_on + product.grace_days < current_date) as overdue on true
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', invoice.id, 'public_reference', invoice.public_reference, 'order_id', invoice.order_id,
        'order_reference', ordered.public_reference, 'party_name', party.display_name, 'currency_code', currency.code,
        'total_amount_minor', invoice.total_amount_minor, 'paid_amount_minor', coalesce(payment.paid, 0),
        'balance_due_minor', greatest(invoice.total_amount_minor - coalesce(payment.paid, 0), 0),
        'status', invoice.status, 'issued_on', invoice.issued_on, 'due_on', invoice.due_on,
        'version', invoice.version
      ) order by case when invoice.status in ('open', 'partially_paid') then 0 else 1 end, invoice.issued_on desc)
      from (
        select candidate.* from public.sales_invoices as candidate
        order by case when candidate.status in ('open', 'partially_paid') then 0 else 1 end,
          candidate.issued_on desc, candidate.id
        limit 200
      ) as invoice join public.orders as ordered on ordered.id = invoice.order_id
      join public.parties as party on party.id = invoice.ordering_party_id join public.currencies as currency on currency.id = invoice.currency_id
      left join lateral (select sum(allocation.amount_minor)::bigint as paid from public.sales_invoice_payments as allocation
        join public.financial_transactions as transaction on transaction.id = allocation.financial_transaction_id
        where allocation.sales_invoice_id = invoice.id and not exists (select 1 from public.financial_transactions as reversal where reversal.reverses_transaction_id = transaction.id)) as payment on true
    ), '[]'::jsonb),
    'transactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', transaction.id, 'public_reference', transaction.public_reference, 'transaction_type', transaction.transaction_type,
        'currency_code', currency.code, 'amount_minor', movement.amount_minor,
        'from_account', movement.from_account, 'to_account', movement.to_account,
        'occurred_on', transaction.occurred_on, 'memo', transaction.memo,
        'external_reference', transaction.external_reference, 'source_record_type', transaction.source_record_type,
        'source_record_id', transaction.source_record_id, 'source_reference', transaction.source_reference,
        'is_reversed', exists (select 1 from public.financial_transactions as reversal where reversal.reverses_transaction_id = transaction.id),
        'posted_at', transaction.posted_at
      ) order by transaction.occurred_on desc, transaction.posted_at desc)
      from (select * from public.financial_transactions order by occurred_on desc, posted_at desc limit 200) as transaction
      join public.currencies as currency on currency.id = transaction.currency_id
      join lateral (select max(abs(entry.amount_minor))::bigint as amount_minor,
        max(account.display_name) filter (where entry.amount_minor < 0) as from_account,
        max(account.display_name) filter (where entry.amount_minor > 0) as to_account
        from public.financial_entries as entry join public.financial_accounts as account on account.id = entry.financial_account_id
        where entry.financial_transaction_id = transaction.id) as movement on true
    ), '[]'::jsonb),
    'parties', coalesce((select jsonb_agg(jsonb_build_object('id', party.id, 'name', party.display_name) order by party.display_name)
      from (select candidate.id, candidate.display_name from public.parties as candidate where candidate.status = 'active'
        order by candidate.display_name, candidate.id limit 200) as party), '[]'::jsonb),
    'unpriced_purchase_count', (select count(*) from public.stock_activity_entries as activity left join public.inventory_transactions as reversal on reversal.reversal_of_id = activity.inventory_transaction_id where activity.activity_type = 'anonymous_purchase' and activity.financial_status = 'unpriced' and reversal.id is null),
    'pending_supplier_total_minor', coalesce((select sum(delivery.total_amount_minor) from public.procurement_deliveries as delivery left join public.inventory_transactions as reversal on reversal.reversal_of_id = delivery.inventory_transaction_id where delivery.settlement_status = 'pending' and reversal.id is null), 0)
  );
end;
$$;

create function public.get_staff_bank_account_register(
  p_search text default null, p_status text default null,
  p_limit integer default 50, p_offset integer default 0
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare normalized_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform 1 from private.require_staff_permission('finance.bank.read');
  if p_limit < 1 or p_limit > 200 or p_offset < 0
    or (p_status is not null and p_status not in ('active', 'frozen', 'closed')) then
    raise exception using errcode = '22023', message = 'bank_account_register_filter_invalid';
  end if;
  return jsonb_build_object(
    'total', (
      select count(*) from public.financial_accounts as account
      left join public.parties as party on party.id = account.party_id
      where not account.hidden_from_routine_ui
        and (p_status is null or account.status = p_status)
        and (normalized_search is null or account.public_reference ilike '%' || normalized_search || '%'
          or account.display_name ilike '%' || normalized_search || '%'
          or party.display_name ilike '%' || normalized_search || '%')
    ),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', page.id, 'public_reference', page.public_reference, 'display_name', page.display_name,
        'account_type', page.account_type, 'party_id', page.party_id, 'party_name', page.party_name,
        'currency_code', page.currency_code, 'status', page.status,
        'balance_minor', private.financial_account_balance(page.id),
        'available_balance_minor', private.financial_account_available_balance(page.id),
        'active_hold_minor', private.financial_account_balance(page.id) - private.financial_account_available_balance(page.id),
        'version', page.version
      ) order by page.sort_order, page.display_name, page.id)
      from (
        select account.id, account.public_reference, account.display_name, account.account_type,
          account.party_id, party.display_name as party_name, currency.code as currency_code,
          account.status, account.version,
          case account.account_type when 'company_treasury' then 0 when 'business' then 1 when 'personal' then 2 else 3 end as sort_order
        from public.financial_accounts as account
        join public.currencies as currency on currency.id = account.currency_id
        left join public.parties as party on party.id = account.party_id
        where not account.hidden_from_routine_ui
          and (p_status is null or account.status = p_status)
          and (normalized_search is null or account.public_reference ilike '%' || normalized_search || '%'
            or account.display_name ilike '%' || normalized_search || '%'
            or party.display_name ilike '%' || normalized_search || '%')
        order by sort_order, account.display_name, account.id
        limit p_limit offset p_offset
      ) as page
    ), '[]'::jsonb),
    'limit', p_limit,
    'offset', p_offset
  );
end;
$$;

create function public.get_dealer_banking_workspace()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare party_ids uuid[];
begin
  select array_agg(distinct representation.principal_party_id) into party_ids
  from private.current_dealer_representations('bank.read') as representation;
  if coalesce(cardinality(party_ids), 0) = 0 then
    raise exception using errcode = '42501', message = 'dealer_scope_denied';
  end if;
  return jsonb_build_object(
    'generated_at', statement_timestamp(),
    'parties', coalesce((select jsonb_agg(jsonb_build_object('id', party.id, 'name', party.display_name) order by party.display_name)
      from public.parties as party where party.id = any(party_ids)), '[]'::jsonb),
    'accounts', coalesce((select jsonb_agg(jsonb_build_object(
      'id', account.id, 'public_reference', account.public_reference, 'display_name', account.display_name,
      'account_type', account.account_type, 'party_id', account.party_id, 'party_name', party.display_name,
      'currency_code', currency.code, 'status', account.status,
      'balance_minor', private.financial_account_balance(account.id),
      'available_balance_minor', private.financial_account_available_balance(account.id),
      'active_hold_minor', private.financial_account_balance(account.id) - private.financial_account_available_balance(account.id),
      'version', account.version
    ) order by party.display_name, account.display_name)
      from public.financial_accounts as account join public.currencies as currency on currency.id = account.currency_id
      join public.parties as party on party.id = account.party_id
      where account.party_id = any(party_ids) and not account.hidden_from_routine_ui), '[]'::jsonb),
    'invoices', coalesce((select jsonb_agg(jsonb_build_object(
      'id', invoice.id, 'public_reference', invoice.public_reference, 'order_id', invoice.order_id,
      'order_reference', ordered.public_reference, 'party_id', invoice.ordering_party_id,
      'party_name', party.display_name, 'currency_code', currency.code,
      'total_amount_minor', invoice.total_amount_minor, 'paid_amount_minor', coalesce(payment.paid, 0),
      'balance_due_minor', greatest(invoice.total_amount_minor - coalesce(payment.paid, 0), 0),
      'status', invoice.status, 'issued_on', invoice.issued_on, 'due_on', invoice.due_on,
      'version', invoice.version
    ) order by case when invoice.status in ('open', 'partially_paid') then 0 else 1 end, invoice.issued_on desc)
      from public.sales_invoices as invoice join public.orders as ordered on ordered.id = invoice.order_id
      join public.parties as party on party.id = invoice.ordering_party_id
      join public.currencies as currency on currency.id = invoice.currency_id
      left join lateral (select sum(recorded.amount_minor)::bigint as paid
        from public.sales_invoice_payments as recorded where recorded.sales_invoice_id = invoice.id) as payment on true
      where invoice.ordering_party_id = any(party_ids)), '[]'::jsonb),
    'loans', coalesce((select jsonb_agg(jsonb_build_object(
      'id', loan.id, 'public_reference', loan.public_reference, 'borrower_account_id', loan.borrower_account_id,
      'borrower_account_name', account.display_name, 'borrower_name', party.display_name,
      'currency_code', currency.code, 'principal_minor', loan.principal_minor,
      'remaining_due_minor', coalesce(due.total_due, 0) - coalesce(paid.total_paid, 0),
      'next_due_on', due.next_due_on, 'annual_rate_basis_points', loan.annual_rate_basis_points,
      'repayment_frequency', loan.repayment_frequency, 'originated_on', loan.originated_on,
      'maturity_on', loan.maturity_on, 'status', loan.status
    ) order by case when loan.status in ('active', 'defaulted') then 0 else 1 end, loan.maturity_on)
      from public.loans as loan join public.financial_accounts as account on account.id = loan.borrower_account_id
      join public.parties as party on party.id = loan.borrower_party_id
      join public.currencies as currency on currency.id = loan.currency_id
      left join lateral (select sum(installment.principal_due_minor + installment.interest_due_minor + installment.fee_due_minor)::bigint as total_due,
        min(installment.due_on) filter (where installment.status not in ('paid', 'waived')) as next_due_on
        from public.loan_installments as installment where installment.loan_id = loan.id) as due on true
      left join lateral (select sum(allocation.principal_minor + allocation.interest_minor + allocation.fee_minor)::bigint as total_paid
        from public.loan_payment_allocations as allocation join public.loan_installments as installment
          on installment.id = allocation.loan_installment_id where installment.loan_id = loan.id) as paid on true
      where loan.borrower_party_id = any(party_ids)), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
      'transaction_id', recent.transaction_id, 'public_reference', recent.public_reference,
      'transaction_type', recent.transaction_type, 'occurred_on', recent.occurred_on,
      'posted_at', recent.posted_at, 'memo', recent.memo, 'source_reference', recent.source_reference,
      'account_id', recent.account_id, 'account_name', recent.account_name,
      'currency_code', recent.currency_code, 'amount_minor', recent.amount_minor
    ) order by recent.posted_at desc, recent.transaction_id desc)
      from (select transaction.id as transaction_id, transaction.public_reference, transaction.transaction_type,
        transaction.occurred_on, transaction.posted_at, transaction.memo, transaction.source_reference,
        account.id as account_id, account.display_name as account_name, currency.code as currency_code,
        entry.amount_minor
        from public.financial_entries as entry join public.financial_transactions as transaction on transaction.id = entry.financial_transaction_id
        join public.financial_accounts as account on account.id = entry.financial_account_id
        join public.currencies as currency on currency.id = account.currency_id
        where account.party_id = any(party_ids)
        order by transaction.posted_at desc, transaction.id desc limit 200) as recent), '[]'::jsonb)
  );
end;
$$;

create function public.get_staff_order_finance(p_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare invoice_record record;
begin
  perform 1 from private.require_staff_permission('order.private.read');
  perform 1 from private.require_staff_permission('finance.bank.read');
  select invoice.id, invoice.public_reference, invoice.total_amount_minor, invoice.status,
    invoice.issued_on, invoice.due_on, invoice.version, currency.code as currency_code,
    coalesce(payment.paid, 0)::bigint as paid_amount_minor
  into invoice_record
  from public.sales_invoices as invoice join public.currencies as currency on currency.id = invoice.currency_id
  left join lateral (select sum(allocation.amount_minor)::bigint as paid from public.sales_invoice_payments as allocation
    join public.financial_transactions as transaction on transaction.id = allocation.financial_transaction_id
    where allocation.sales_invoice_id = invoice.id and not exists (select 1 from public.financial_transactions as reversal where reversal.reverses_transaction_id = transaction.id)) as payment on true
  where invoice.order_id = p_order_id;
  if not found then return null; end if;
  return jsonb_build_object('id', invoice_record.id, 'public_reference', invoice_record.public_reference,
    'total_amount_minor', invoice_record.total_amount_minor, 'paid_amount_minor', invoice_record.paid_amount_minor,
    'balance_due_minor', greatest(invoice_record.total_amount_minor - invoice_record.paid_amount_minor, 0),
    'currency_code', invoice_record.currency_code, 'status', invoice_record.status,
    'issued_on', invoice_record.issued_on, 'due_on', invoice_record.due_on, 'version', invoice_record.version);
end;
$$;

create function public.get_staff_financial_account_statement(
  p_account_id uuid, p_before timestamptz default null, p_limit integer default 50
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare account_record record;
begin
  perform 1 from private.require_staff_permission('finance.bank.read');
  if p_limit < 1 or p_limit > 200 then raise exception using errcode = '22023', message = 'statement_limit_invalid'; end if;
  select account.id, account.public_reference, account.display_name, account.account_type,
    account.party_id, party.display_name as party_name, currency.code as currency_code,
    account.status, account.version, private.financial_account_balance(account.id) as balance_minor,
    private.financial_account_available_balance(account.id) as available_balance_minor
  into account_record from public.financial_accounts as account
  join public.currencies as currency on currency.id = account.currency_id
  left join public.parties as party on party.id = account.party_id
  where account.id = p_account_id and not account.hidden_from_routine_ui;
  if not found then raise exception using errcode = 'P0002', message = 'financial_account_not_found'; end if;
  return jsonb_build_object(
    'capabilities', jsonb_build_object(
      'can_manage_accounts', private.staff_has_permission('finance.account.manage'),
      'can_post', private.staff_has_permission('finance.transaction.post')
    ),
    'account', to_jsonb(account_record),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'transaction_id', transaction.id, 'public_reference', transaction.public_reference,
        'transaction_type', transaction.transaction_type, 'occurred_on', transaction.occurred_on,
        'posted_at', transaction.posted_at, 'memo', transaction.memo,
        'external_reference', transaction.external_reference, 'source_record_type', transaction.source_record_type,
        'source_record_id', transaction.source_record_id, 'source_reference', transaction.source_reference,
        'amount_minor', entry.amount_minor, 'running_balance_minor', entry.running_balance_minor,
        'is_reversed', exists (select 1 from public.financial_transactions as reversal where reversal.reverses_transaction_id = transaction.id)
      ) order by transaction.posted_at desc)
      from (
        select transaction.id, ledger.amount_minor,
          (select coalesce(sum(prior_entry.amount_minor), 0)::bigint
            from public.financial_entries as prior_entry
            join public.financial_transactions as prior_transaction on prior_transaction.id = prior_entry.financial_transaction_id
            where prior_entry.financial_account_id = p_account_id
              and (prior_transaction.posted_at, prior_transaction.id) <= (transaction.posted_at, transaction.id)
          ) as running_balance_minor
        from public.financial_entries as ledger
        join public.financial_transactions as transaction on transaction.id = ledger.financial_transaction_id
        where ledger.financial_account_id = p_account_id
          and (p_before is null or transaction.posted_at < p_before)
        order by transaction.posted_at desc, transaction.id desc limit p_limit
      ) as entry join public.financial_transactions as transaction on transaction.id = entry.id
    ), '[]'::jsonb),
    'holds', coalesce((select jsonb_agg(jsonb_build_object(
      'id', hold.id, 'public_reference', hold.public_reference, 'amount_minor', hold.amount_minor,
      'status', hold.status, 'reason', hold.reason, 'expires_at', hold.expires_at, 'version', hold.version
    ) order by hold.created_at desc) from public.financial_account_holds as hold where hold.financial_account_id = p_account_id), '[]'::jsonb),
    'loans', coalesce((select jsonb_agg(jsonb_build_object(
      'id', loan.id, 'public_reference', loan.public_reference, 'principal_minor', loan.principal_minor,
      'status', loan.status, 'maturity_on', loan.maturity_on, 'version', loan.version
    ) order by loan.originated_on desc) from public.loans as loan where loan.borrower_account_id = p_account_id), '[]'::jsonb)
  );
end;
$$;

create function public.get_staff_loan(p_loan_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare loan_record record;
begin
  perform 1 from private.require_staff_permission('finance.bank.read');
  select loan.id, loan.public_reference, loan.status, loan.principal_minor,
    loan.annual_rate_basis_points, loan.repayment_frequency, loan.term_count,
    loan.originated_on, loan.first_due_on, loan.maturity_on, loan.purpose, loan.version,
    product.display_name as product_name, product.grace_days, product.late_fee_minor,
    account.id as borrower_account_id, account.public_reference as borrower_account_reference,
    account.display_name as borrower_account_name, party.display_name as borrower_name,
    currency.code as currency_code
  into loan_record from public.loans as loan join public.loan_products as product on product.id = loan.loan_product_id
  join public.financial_accounts as account on account.id = loan.borrower_account_id
  left join public.parties as party on party.id = loan.borrower_party_id
  join public.currencies as currency on currency.id = loan.currency_id where loan.id = p_loan_id;
  if not found then raise exception using errcode = 'P0002', message = 'loan_not_found'; end if;
  return jsonb_build_object(
    'capabilities', jsonb_build_object(
      'can_manage', private.staff_has_permission('finance.account.manage'),
      'can_post', private.staff_has_permission('finance.transaction.post')
    ),
    'loan', to_jsonb(loan_record),
    'installments', coalesce((select jsonb_agg(jsonb_build_object(
      'id', installment.id, 'installment_number', installment.installment_number, 'due_on', installment.due_on,
      'principal_due_minor', installment.principal_due_minor, 'interest_due_minor', installment.interest_due_minor,
      'fee_due_minor', installment.fee_due_minor, 'principal_paid_minor', coalesce(paid.principal, 0),
      'interest_paid_minor', coalesce(paid.interest, 0), 'fee_paid_minor', coalesce(paid.fee, 0),
      'balance_due_minor', installment.principal_due_minor + installment.interest_due_minor + installment.fee_due_minor
        - coalesce(paid.principal, 0) - coalesce(paid.interest, 0) - coalesce(paid.fee, 0),
      'status', installment.status, 'version', installment.version
    ) order by installment.installment_number)
    from public.loan_installments as installment
    left join lateral (select sum(allocation.principal_minor)::bigint as principal,
      sum(allocation.interest_minor)::bigint as interest, sum(allocation.fee_minor)::bigint as fee
      from public.loan_payment_allocations as allocation where allocation.loan_installment_id = installment.id) as paid on true
    where installment.loan_id = p_loan_id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
      'id', payment.id, 'transaction_id', payment.financial_transaction_id,
      'transaction_reference', transaction.public_reference, 'amount_minor', payment.amount_minor,
      'occurred_on', payment.occurred_on, 'payment_reference', payment.payment_reference,
      'is_reversed', exists (select 1 from public.financial_transactions as reversal where reversal.reverses_transaction_id = transaction.id)
    ) order by payment.occurred_on desc, payment.created_at desc)
    from public.loan_payments as payment join public.financial_transactions as transaction on transaction.id = payment.financial_transaction_id
    where payment.loan_id = p_loan_id), '[]'::jsonb)
  );
end;
$$;

revoke all on public.financial_accounts, public.financial_transactions, public.financial_entries,
  public.sales_invoices, public.sales_invoice_lines, public.sales_invoice_payments,
  public.financial_account_holds, public.loan_products, public.loans, public.loan_installments,
  public.loan_payments, public.loan_payment_allocations from public, anon, authenticated;
revoke all on function private.allocate_finance_reference(text), private.financial_account_balance(uuid),
  private.financial_account_available_balance(uuid),
  private.post_two_sided_financial_transaction(text,uuid,uuid,bigint,date,text,text,text,uuid,text,uuid,uuid,uuid),
  private.ensure_business_financial_account(), private.record_activity_finance(),
  private.record_procurement_finance(), private.record_consignment_finance()
from public, anon, authenticated;
revoke all on function public.staff_create_financial_account(text,text,uuid,text,bigint,text,text,uuid),
  public.staff_post_cash_movement(uuid,text,bigint,date,text,text,text,uuid),
  public.staff_transfer_funds(uuid,uuid,bigint,date,text,text,text,uuid),
  public.staff_issue_order_invoice(uuid,date,date,text,text,uuid),
  public.staff_record_invoice_payment(uuid,uuid,bigint,date,text,text,text,uuid),
  public.dealer_transfer_funds(uuid,text,bigint,date,text,uuid),
  public.dealer_record_invoice_payment(uuid,uuid,bigint,date,text,uuid),
  public.staff_void_invoice(uuid,bigint,text,uuid),
  public.staff_reverse_financial_transaction(uuid,text,uuid),
  public.staff_set_financial_account_status(uuid,bigint,text,text,uuid),
  public.staff_place_account_hold(uuid,bigint,timestamptz,text,uuid,text,uuid),
  public.staff_release_account_hold(uuid,bigint,text,uuid),
  public.staff_create_loan_product(text,text,text,integer,text,integer,integer,bigint,bigint,integer,bigint,text,uuid),
  public.staff_originate_loan(uuid,uuid,bigint,integer,date,date,text,text,uuid),
  public.staff_record_loan_payment(uuid,bigint,date,text,text,text,uuid),
  public.staff_mark_loan_default(uuid,bigint,text,text,uuid),
  public.get_staff_money_workspace(), public.get_staff_bank_account_register(text,text,integer,integer),
  public.get_dealer_banking_workspace(),
  public.get_staff_order_finance(uuid),
  public.get_staff_financial_account_statement(uuid,timestamptz,integer), public.get_staff_loan(uuid)
from public, anon;
grant execute on function public.staff_create_financial_account(text,text,uuid,text,bigint,text,text,uuid),
  public.staff_post_cash_movement(uuid,text,bigint,date,text,text,text,uuid),
  public.staff_transfer_funds(uuid,uuid,bigint,date,text,text,text,uuid),
  public.staff_issue_order_invoice(uuid,date,date,text,text,uuid),
  public.staff_record_invoice_payment(uuid,uuid,bigint,date,text,text,text,uuid),
  public.dealer_transfer_funds(uuid,text,bigint,date,text,uuid),
  public.dealer_record_invoice_payment(uuid,uuid,bigint,date,text,uuid),
  public.staff_void_invoice(uuid,bigint,text,uuid),
  public.staff_reverse_financial_transaction(uuid,text,uuid),
  public.staff_set_financial_account_status(uuid,bigint,text,text,uuid),
  public.staff_place_account_hold(uuid,bigint,timestamptz,text,uuid,text,uuid),
  public.staff_release_account_hold(uuid,bigint,text,uuid),
  public.staff_create_loan_product(text,text,text,integer,text,integer,integer,bigint,bigint,integer,bigint,text,uuid),
  public.staff_originate_loan(uuid,uuid,bigint,integer,date,date,text,text,uuid),
  public.staff_record_loan_payment(uuid,bigint,date,text,text,text,uuid),
  public.staff_mark_loan_default(uuid,bigint,text,text,uuid),
  public.get_staff_money_workspace(), public.get_staff_bank_account_register(text,text,integer,integer),
  public.get_dealer_banking_workspace(),
  public.get_staff_order_finance(uuid),
  public.get_staff_financial_account_statement(uuid,timestamptz,integer), public.get_staff_loan(uuid)
to authenticated;

comment on table public.financial_transactions is 'Immutable fictional-currency transaction headers. Corrections append an exact reversal; prior evidence is never edited.';
comment on table public.financial_entries is 'Balanced signed account movements. Account balances are always derived from these entries.';
comment on table public.sales_invoices is 'Order-linked receivables. Payments are linked ledger transactions, not editable paid flags.';
