create table public.business_portal_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  party_id uuid not null unique references public.parties(id) on delete restrict,
  actor_id uuid not null unique references public.actor_profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'disabled')),
  credential_version bigint not null default 1 check (credential_version > 0),
  activated_at timestamptz not null default now(),
  credential_rotated_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_by_actor_id uuid not null references public.actor_profiles(id) on delete restrict,
  updated_by_actor_id uuid not null references public.actor_profiles(id) on delete restrict,
  source_request_id uuid not null unique,
  last_request_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'active' and disabled_at is null) or status = 'disabled')
);

comment on table public.business_portal_accounts is
  'One organization credential binding per business. Access-code hashes remain exclusively in Supabase Auth; this table stores only authority and lifecycle metadata.';

create trigger business_portal_accounts_set_updated_at
before update on public.business_portal_accounts
for each row execute function private.set_updated_at();

create trigger business_portal_accounts_audit
after insert or update or delete on public.business_portal_accounts
for each row execute function private.capture_audit_row();

alter table public.business_portal_accounts enable row level security;
revoke all on public.business_portal_accounts from public, anon, authenticated;

create function public.get_staff_business_portal_access(
  p_dealer_authorization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  dealer_record record;
begin
  perform 1 from private.require_staff_permission('access.private.read');

  select dealer.id, dealer.dealer_party_id, party.display_name
  into dealer_record
  from public.dealer_authorizations as dealer
  join public.parties as party on party.id = dealer.dealer_party_id
  where dealer.id = p_dealer_authorization_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'dealer_authorization_not_found';
  end if;

  return jsonb_build_object(
    'party_id', dealer_record.dealer_party_id,
    'party_name', dealer_record.display_name,
    'configured', account.id is not null,
    'status', account.status,
    'actor_id', account.actor_id,
    'auth_user_id', actor.auth_user_id,
    'credential_version', account.credential_version,
    'credential_rotated_at', account.credential_rotated_at,
    'disabled_at', account.disabled_at,
    'eligible_license_references', coalesce((
      select jsonb_agg(license.public_reference order by license.public_reference)
      from public.licenses as license
      join public.license_status_definitions as license_status
        on license_status.id = license.status_definition_id
        and license_status.confers_authority
      where license.dealer_authorization_id = dealer_record.id
        and license.holder_party_id = dealer_record.dealer_party_id
        and license.effective_from <= statement_timestamp()
        and (license.expires_at is null or license.expires_at > statement_timestamp())
    ), '[]'::jsonb)
  )
  from (select 1) as singleton
  left join public.business_portal_accounts as account
    on account.party_id = dealer_record.dealer_party_id
  left join public.actor_profiles as actor on actor.id = account.actor_id;
end;
$$;

create function public.get_business_portal_login_context(
  p_license_reference text
)
returns table (party_id uuid, auth_user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select account.party_id, actor.auth_user_id
  from public.licenses as license
  join public.license_status_definitions as license_status
    on license_status.id = license.status_definition_id
    and license_status.confers_authority
  join public.dealer_authorizations as dealer
    on dealer.id = license.dealer_authorization_id
    and dealer.dealer_party_id = license.holder_party_id
  join public.dealer_status_definitions as dealer_status
    on dealer_status.id = dealer.status_definition_id
    and dealer_status.confers_authority
  join public.business_portal_accounts as account
    on account.party_id = license.holder_party_id
    and account.status = 'active'
  join public.actor_profiles as actor
    on actor.id = account.actor_id
    and actor.actor_type = 'dealer'
    and actor.status = 'active'
  where license.public_reference = private.normalize_registry_reference(p_license_reference)
    and license.effective_from <= statement_timestamp()
    and (license.expires_at is null or license.expires_at > statement_timestamp())
    and dealer.effective_from <= statement_timestamp()
    and (dealer.effective_until is null or dealer.effective_until > statement_timestamp())
  limit 1;
$$;

create function public.staff_activate_business_portal_account(
  p_dealer_authorization_id uuid,
  p_auth_user_id uuid,
  p_reason text,
  p_request_id uuid
)
returns table (account_id uuid, actor_id uuid, credential_version bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  author_actor_id uuid;
  dealer_record record;
  account_record record;
  current_actor_id uuid;
  role_id uuid;
  scopes jsonb;
begin
  author_actor_id := private.set_staff_audit_context(
    'access.assignment.manage', p_reason, p_request_id, 'staff_business_access'
  );

  select account.id, account.actor_id, account.credential_version
  into account_record
  from public.business_portal_accounts as account
  where account.last_request_id = p_request_id;
  if found then
    return query select account_record.id, account_record.actor_id, account_record.credential_version;
    return;
  end if;

  if p_auth_user_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'business_portal_access_invalid';
  end if;

  select dealer.id, dealer.dealer_party_id, party.display_name
  into dealer_record
  from public.dealer_authorizations as dealer
  join public.dealer_status_definitions as status
    on status.id = dealer.status_definition_id and status.confers_authority
  join public.parties as party
    on party.id = dealer.dealer_party_id and party.status = 'active'
  where dealer.id = p_dealer_authorization_id
    and dealer.effective_from <= statement_timestamp()
    and (dealer.effective_until is null or dealer.effective_until > statement_timestamp())
  for update of dealer;
  if not found then
    raise exception using errcode = '22023', message = 'business_portal_dealer_not_authorized';
  end if;

  if not exists (
    select 1
    from public.licenses as license
    join public.license_status_definitions as status
      on status.id = license.status_definition_id and status.confers_authority
    where license.dealer_authorization_id = dealer_record.id
      and license.holder_party_id = dealer_record.dealer_party_id
      and license.effective_from <= statement_timestamp()
      and (license.expires_at is null or license.expires_at > statement_timestamp())
  ) then
    raise exception using errcode = '22023', message = 'business_portal_license_required';
  end if;

  if not exists (select 1 from auth.users as auth_user where auth_user.id = p_auth_user_id) then
    raise exception using errcode = 'P0002', message = 'business_portal_auth_user_not_found';
  end if;

  select account.id, account.actor_id, account.credential_version, actor.auth_user_id
  into account_record
  from public.business_portal_accounts as account
  join public.actor_profiles as actor on actor.id = account.actor_id
  where account.party_id = dealer_record.dealer_party_id
  for update of account, actor;

  if found then
    if account_record.auth_user_id <> p_auth_user_id then
      raise exception using errcode = '22023', message = 'business_portal_auth_user_mismatch';
    end if;
    current_actor_id := account_record.actor_id;
    update public.actor_profiles
    set status = 'active', display_name = dealer_record.display_name || ' business account'
    where id = current_actor_id;
    update public.business_portal_accounts
    set status = 'active', disabled_at = null,
      credential_version = business_portal_accounts.credential_version + 1,
      credential_rotated_at = statement_timestamp(),
      updated_by_actor_id = author_actor_id,
      last_request_id = p_request_id
    where id = account_record.id
    returning business_portal_accounts.credential_version into account_record.credential_version;
  else
    select actor.id into current_actor_id
    from public.actor_profiles as actor
    where actor.auth_user_id = p_auth_user_id;
    if found then
      if not exists (
        select 1 from public.actor_profiles as actor
        where actor.id = current_actor_id and actor.actor_type = 'dealer'
      ) or exists (
        select 1 from public.business_portal_accounts as account
        where account.actor_id = current_actor_id
      ) then
        raise exception using errcode = '22023', message = 'business_portal_actor_conflict';
      end if;
      update public.actor_profiles
      set status = 'active', display_name = dealer_record.display_name || ' business account'
      where id = current_actor_id;
    else
      insert into public.actor_profiles (auth_user_id, display_name, actor_type, status)
      values (p_auth_user_id, dealer_record.display_name || ' business account', 'dealer', 'active')
      returning id into current_actor_id;
    end if;

    insert into public.business_portal_accounts (
      party_id, actor_id, created_by_actor_id, updated_by_actor_id,
      source_request_id, last_request_id
    ) values (
      dealer_record.dealer_party_id, current_actor_id, author_actor_id, author_actor_id,
      p_request_id, p_request_id
    ) returning id, business_portal_accounts.credential_version
      into account_record.id, account_record.credential_version;
  end if;

  select role.id, role.default_scope into strict role_id, scopes
  from public.representative_role_definitions as role
  where role.code = 'portal-representative' and role.active;

  if exists (
    select 1 from public.party_representatives as representative
    where representative.principal_party_id = dealer_record.dealer_party_id
      and representative.actor_id = current_actor_id
      and representative.role_definition_id = role_id
      and representative.revoked_at is null
      and representative.effective_from <= statement_timestamp()
      and (representative.effective_until is null or representative.effective_until > statement_timestamp())
  ) then
    update public.party_representatives
    set authority_scope = scopes, verified_at = statement_timestamp(),
      verified_by = author_actor_id, version = version + 1
    where principal_party_id = dealer_record.dealer_party_id
      and actor_id = current_actor_id
      and role_definition_id = role_id
      and revoked_at is null
      and effective_from <= statement_timestamp()
      and (effective_until is null or effective_until > statement_timestamp());
  else
    insert into public.party_representatives (
      principal_party_id, actor_id, role_definition_id, authority_scope,
      effective_from, verified_at, verified_by
    ) values (
      dealer_record.dealer_party_id, current_actor_id, role_id, scopes,
      statement_timestamp(), statement_timestamp(), author_actor_id
    );
  end if;

  insert into public.outbox_events (
    event_type, aggregate_type, aggregate_id, payload, deduplication_key
  ) values (
    'business.portal_access_activated', 'business_portal_account', account_record.id,
    jsonb_build_object(
      'business_portal_account_id', account_record.id,
      'party_id', dealer_record.dealer_party_id,
      'dealer_authorization_id', dealer_record.id,
      'credential_version', account_record.credential_version,
      'changed_by_actor_id', author_actor_id
    ),
    'business.portal_access_activated:' || p_request_id::text
  );

  return query select account_record.id, current_actor_id, account_record.credential_version;
end;
$$;

create function public.staff_disable_business_portal_account(
  p_dealer_authorization_id uuid,
  p_reason text,
  p_request_id uuid
)
returns table (account_id uuid, disabled_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  author_actor_id uuid;
  account_record record;
  disabled_time timestamptz := statement_timestamp();
begin
  author_actor_id := private.set_staff_audit_context(
    'access.assignment.manage', p_reason, p_request_id, 'staff_business_access'
  );

  select account.id, account.actor_id, account.status, account.disabled_at,
    account.last_request_id
  into account_record
  from public.dealer_authorizations as dealer
  join public.business_portal_accounts as account
    on account.party_id = dealer.dealer_party_id
  where dealer.id = p_dealer_authorization_id
  for update of account;
  if not found then
    raise exception using errcode = 'P0002', message = 'business_portal_account_not_found';
  end if;

  if account_record.last_request_id = p_request_id then
    return query select account_record.id, account_record.disabled_at;
    return;
  end if;

  update public.business_portal_accounts
  set status = 'disabled', disabled_at = disabled_time,
    updated_by_actor_id = author_actor_id, last_request_id = p_request_id
  where id = account_record.id;

  update public.actor_profiles set status = 'disabled'
  where id = account_record.actor_id;

  update public.party_representatives
  set revoked_at = disabled_time, version = version + 1
  where actor_id = account_record.actor_id
    and revoked_at is null
    and effective_from <= disabled_time
    and (effective_until is null or effective_until > disabled_time);

  insert into public.outbox_events (
    event_type, aggregate_type, aggregate_id, payload, deduplication_key
  ) values (
    'business.portal_access_disabled', 'business_portal_account', account_record.id,
    jsonb_build_object(
      'business_portal_account_id', account_record.id,
      'dealer_authorization_id', p_dealer_authorization_id,
      'disabled_at', disabled_time,
      'changed_by_actor_id', author_actor_id
    ),
    'business.portal_access_disabled:' || p_request_id::text
  );

  return query select account_record.id, disabled_time;
end;
$$;

revoke all on function public.get_staff_business_portal_access(uuid) from public, anon;
revoke all on function public.get_business_portal_login_context(text) from public, anon, authenticated;
revoke all on function public.staff_activate_business_portal_account(uuid,uuid,text,uuid) from public, anon;
revoke all on function public.staff_disable_business_portal_account(uuid,text,uuid) from public, anon;

grant execute on function public.get_staff_business_portal_access(uuid) to authenticated;
grant execute on function public.get_business_portal_login_context(text) to service_role;
grant execute on function public.staff_activate_business_portal_account(uuid,uuid,text,uuid) to authenticated;
grant execute on function public.staff_disable_business_portal_account(uuid,text,uuid) to authenticated;
