-- Money commands must be safe to retry and opposing transfers must acquire
-- account locks in one stable order.

create or replace function private.post_two_sided_financial_transaction(
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

  -- A single ordered lock query prevents A -> B and B -> A transactions from
  -- taking the same pair of account locks in opposite orders.
  perform 1
  from public.financial_accounts as account
  where account.id in (p_from_account_id, p_to_account_id)
  order by account.id
  for update;

  select account.* into from_account from public.financial_accounts as account
  where account.id = p_from_account_id;
  if not found or from_account.status <> 'active' then
    raise exception using errcode = '22023', message = 'financial_source_account_invalid';
  end if;
  select account.* into to_account from public.financial_accounts as account
  where account.id = p_to_account_id;
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

comment on function private.post_two_sided_financial_transaction(
  text,uuid,uuid,bigint,date,text,text,text,uuid,text,uuid,uuid,uuid
) is 'Posts one idempotent balanced money movement after locking both accounts in deterministic identifier order.';
