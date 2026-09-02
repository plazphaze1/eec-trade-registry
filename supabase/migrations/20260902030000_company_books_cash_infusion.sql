begin;

create function public.staff_record_treasury_cash_infusion(
  p_currency_code text,
  p_amount_minor bigint,
  p_occurred_on date,
  p_source_reference text,
  p_note text,
  p_reason text,
  p_request_id uuid
)
returns table (transaction_id uuid, public_reference text, treasury_balance_minor bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor_id uuid;
  currency_record public.currencies%rowtype;
  treasury_id uuid;
  clearing_id uuid;
  created_id uuid;
begin
  actor_id := private.set_staff_audit_context('finance.transaction.post', p_reason, p_request_id);
  select currency.* into currency_record
  from public.currencies as currency
  where currency.code = upper(btrim(coalesce(p_currency_code, ''))) and currency.active;
  if not found or p_amount_minor is null or p_amount_minor <= 0 or p_occurred_on is null then
    raise exception using errcode = '22023', message = 'treasury_cash_infusion_invalid';
  end if;

  select account.id into strict treasury_id
  from public.financial_accounts as account
  where account.account_type = 'company_treasury'
    and account.currency_id = currency_record.id
    and account.status = 'active';
  select account.id into strict clearing_id
  from public.financial_accounts as account
  where account.account_type = 'external'
    and account.currency_id = currency_record.id
    and account.status = 'active';

  created_id := private.post_two_sided_financial_transaction(
    'deposit', clearing_id, treasury_id, p_amount_minor, p_occurred_on,
    coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Company cash infusion'),
    p_source_reference, null, null, 'Company cash infusion', actor_id, p_request_id
  );

  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, payload, deduplication_key)
  values (
    'finance.treasury_cash_infused', 'financial_transaction', created_id,
    jsonb_build_object(
      'transaction_id', created_id,
      'amount_minor', p_amount_minor,
      'currency_code', currency_record.code,
      'occurred_on', p_occurred_on,
      'source_reference', nullif(btrim(coalesce(p_source_reference, '')), '')
    ),
    'finance.treasury_cash_infused:' || p_request_id::text
  ) on conflict (deduplication_key) do nothing;

  return query
  select created_id, transaction.public_reference, private.financial_account_balance(treasury_id)
  from public.financial_transactions as transaction
  where transaction.id = created_id;
end;
$$;

create function public.get_staff_bank_customer_account_register(
  p_search text default null,
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
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
        and account.account_type in ('business', 'personal', 'escrow')
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
          case account.account_type when 'business' then 1 when 'personal' then 2 else 3 end as sort_order
        from public.financial_accounts as account
        join public.currencies as currency on currency.id = account.currency_id
        left join public.parties as party on party.id = account.party_id
        where not account.hidden_from_routine_ui
          and account.account_type in ('business', 'personal', 'escrow')
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

revoke all on function public.staff_record_treasury_cash_infusion(text,bigint,date,text,text,text,uuid),
  public.get_staff_bank_customer_account_register(text,text,integer,integer)
from public, anon;
grant execute on function public.staff_record_treasury_cash_infusion(text,bigint,date,text,text,text,uuid),
  public.get_staff_bank_customer_account_register(text,text,integer,integer)
to authenticated;

comment on function public.staff_record_treasury_cash_infusion(text,bigint,date,text,text,text,uuid) is
  'Posts an idempotent, balanced cash infusion from the outside-world boundary into Company Treasury.';
comment on function public.get_staff_bank_customer_account_register(text,text,integer,integer) is
  'Paginated customer banking accounts. Company Treasury remains in Company books instead of the Bank workspace.';

commit;
