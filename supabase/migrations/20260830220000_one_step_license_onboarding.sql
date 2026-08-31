create table public.license_application_onboarding_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  license_class_id uuid not null unique references public.license_classes(id) on delete restrict,
  party_type_id uuid not null references public.party_types(id) on delete restrict,
  dealer_type_id uuid not null references public.dealer_types(id) on delete restrict,
  dealer_status_definition_id uuid not null references public.dealer_status_definitions(id) on delete restrict,
  public_disclosure_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.license_application_onboarding_profiles is
  'Configures the party and dealer records created atomically when staff approve a new public license application. The mapping is configuration; application code does not infer it from display labels.';

create trigger license_application_onboarding_profiles_set_updated_at
before update on public.license_application_onboarding_profiles
for each row execute function private.set_updated_at();

create trigger license_application_onboarding_profiles_audit
after insert or update or delete on public.license_application_onboarding_profiles
for each row execute function private.capture_audit_row();

alter table public.license_application_onboarding_profiles enable row level security;

insert into public.license_application_onboarding_profiles (
  license_class_id,
  party_type_id,
  dealer_type_id,
  dealer_status_definition_id,
  public_disclosure_enabled
)
select
  license_class.id,
  party_type.id,
  dealer_type.id,
  dealer_status.id,
  true
from public.license_classes as license_class
join public.party_types as party_type
  on party_type.code = 'organization' and party_type.active
join public.dealer_types as dealer_type
  on dealer_type.code = 'wholesale-counterparty' and dealer_type.active
join public.dealer_status_definitions as dealer_status
  on dealer_status.code = 'active' and dealer_status.active
where license_class.active
on conflict (license_class_id) do nothing;

create or replace function public.staff_decide_license_application(
  p_application_id uuid,
  p_expected_version bigint,
  p_decision text,
  p_holder_party_id uuid,
  p_effective_from timestamptz,
  p_expires_at timestamptz,
  p_initial_status_code text,
  p_reason text,
  p_request_id uuid
)
returns table(application_id uuid,status text,issued_license_id uuid,version bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  application record;
  issued record;
  onboarding record;
  existing_dealer record;
  endorsement_codes text[];
  holder_id uuid;
  dealer_authorization_id uuid;
  disclose_publicly boolean := false;
begin
  actor_id := private.set_staff_audit_context(
    'license.application.review', p_reason, p_request_id
  );

  select item.* into application
  from public.license_applications as item
  where item.id = p_application_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'license_application_not_found';
  end if;
  if application.review_request_id = p_request_id then
    return query select application.id, application.status,
      application.issued_license_id, application.version;
    return;
  end if;

  select item.* into application
  from public.license_applications as item
  where item.id = p_application_id
  for update;
  if application.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'license_application_version_conflict';
  end if;
  if application.status not in ('submitted', 'under_review')
    or p_decision not in ('approve', 'deny') then
    raise exception using errcode = '22023', message = 'license_application_transition_invalid';
  end if;

  if p_decision = 'deny' then
    update public.license_applications
    set status = 'denied',
        reviewed_at = statement_timestamp(),
        reviewed_by_actor_id = actor_id,
        review_reason = btrim(p_reason),
        review_request_id = p_request_id,
        version = version + 1
    where id = p_application_id
    returning * into application;
  elsif application.application_type = 'new' then
    select coalesce(array_agg(definition.code), array[]::text[])
    into endorsement_codes
    from public.license_application_endorsements as requested
    join public.endorsement_definitions as definition
      on definition.id = requested.endorsement_definition_id
    where requested.application_id = application.id;

    holder_id := p_holder_party_id;
    if holder_id is null then
      select
        party_type.code as party_type_code,
        dealer_type.code as dealer_type_code,
        dealer_status.code as dealer_status_code,
        license_class.code as license_class_code,
        jurisdiction.code as jurisdiction_code,
        profile.public_disclosure_enabled
      into onboarding
      from public.license_application_onboarding_profiles as profile
      join public.party_types as party_type
        on party_type.id = profile.party_type_id and party_type.active
      join public.dealer_types as dealer_type
        on dealer_type.id = profile.dealer_type_id and dealer_type.active
      join public.dealer_status_definitions as dealer_status
        on dealer_status.id = profile.dealer_status_definition_id
        and dealer_status.active and dealer_status.confers_authority
      join public.license_classes as license_class
        on license_class.id = profile.license_class_id and license_class.active
      join public.jurisdictions as jurisdiction
        on jurisdiction.id = application.requested_jurisdiction_id
        and jurisdiction.status = 'active'
      where profile.license_class_id = application.requested_license_class_id;
      if not found then
        raise exception using errcode = '22023', message = 'license_application_onboarding_profile_missing';
      end if;

      select created.id, created.party_id
      into dealer_authorization_id, holder_id
      from public.staff_create_dealer_authorization(
        onboarding.party_type_code,
        application.applicant_name,
        application.applicant_name,
        case when onboarding.public_disclosure_enabled then application.applicant_name else '' end,
        onboarding.dealer_type_code,
        onboarding.jurisdiction_code,
        onboarding.dealer_status_code,
        '',
        '',
        'Created automatically from license application ' || application.public_reference || '.',
        onboarding.public_disclosure_enabled,
        p_reason,
        p_request_id
      ) as created;
      disclose_publicly := onboarding.public_disclosure_enabled;
    else
      select dealer.id, dealer.public_disclosure_enabled
      into existing_dealer
      from public.dealer_authorizations as dealer
      join public.dealer_status_definitions as dealer_status
        on dealer_status.id = dealer.status_definition_id
        and dealer_status.confers_authority
      where dealer.dealer_party_id = holder_id
        and dealer.jurisdiction_id = application.requested_jurisdiction_id
        and dealer.effective_from <= statement_timestamp()
        and (dealer.effective_until is null or dealer.effective_until > statement_timestamp())
      order by dealer.approved_at desc nulls last, dealer.created_at desc
      limit 1;
      if not found then
        raise exception using errcode = '22023', message = 'license_application_dealer_authorization_required';
      end if;
      dealer_authorization_id := existing_dealer.id;
      select existing_dealer.public_disclosure_enabled and party.public_profile_enabled
      into disclose_publicly
      from public.parties as party
      where party.id = holder_id and party.status = 'active';
    end if;

    select * into issued
    from public.staff_issue_license(
      holder_id,
      dealer_authorization_id,
      (select code from public.license_classes where id = application.requested_license_class_id),
      (select code from public.jurisdictions where id = application.requested_jurisdiction_id),
      coalesce(nullif(btrim(p_initial_status_code), ''), 'active'),
      p_effective_from,
      p_expires_at,
      disclose_publicly,
      '',
      'Issued from application ' || application.public_reference,
      endorsement_codes,
      p_reason,
      p_request_id
    );

    actor_id := private.set_staff_audit_context(
      'license.application.review', p_reason, p_request_id
    );
    update public.license_applications
    set status = 'issued',
        reviewed_at = statement_timestamp(),
        reviewed_by_actor_id = actor_id,
        review_reason = btrim(p_reason),
        review_request_id = p_request_id,
        issued_license_id = issued.id,
        version = version + 1
    where id = p_application_id
    returning * into application;
  else
    if p_expires_at is null or p_expires_at <= statement_timestamp() then
      raise exception using errcode = '22023', message = 'license_renewal_term_invalid';
    end if;
    insert into public.license_renewal_events(
      license_id, application_id, previous_expires_at, new_expires_at,
      renewed_by_actor_id, reason, request_id
    )
    select license.id, application.id, license.expires_at, p_expires_at,
      actor_id, btrim(p_reason), p_request_id
    from public.licenses as license
    where license.id = application.existing_license_id;

    update public.licenses as license
    set expires_at = p_expires_at, version = license.version + 1
    where license.id = application.existing_license_id;

    update public.license_applications
    set status = 'renewed',
        reviewed_at = statement_timestamp(),
        reviewed_by_actor_id = actor_id,
        review_reason = btrim(p_reason),
        review_request_id = p_request_id,
        issued_license_id = existing_license_id,
        version = version + 1
    where id = p_application_id
    returning * into application;
  end if;

  insert into public.outbox_events(
    event_type, aggregate_type, aggregate_id, payload, deduplication_key
  ) values (
    'license.application_decided',
    'license_application',
    application.id,
    jsonb_build_object(
      'public_reference', application.public_reference,
      'status', application.status,
      'license_id', application.issued_license_id,
      'party_id', holder_id,
      'dealer_authorization_id', dealer_authorization_id
    ),
    'license.application_decided:' || p_request_id::text
  );

  return query select application.id, application.status,
    application.issued_license_id, application.version;
end;
$$;

comment on function public.staff_decide_license_application(
  uuid,bigint,text,uuid,timestamptz,timestamptz,text,text,uuid
) is
  'Approves or denies a public license request. New approvals without a selected holder atomically create the configured business, active dealer authorization, and linked license.';

revoke all on table public.license_application_onboarding_profiles from anon, authenticated;
revoke all on function public.staff_decide_license_application(
  uuid,bigint,text,uuid,timestamptz,timestamptz,text,text,uuid
) from public, anon;
grant execute on function public.staff_decide_license_application(
  uuid,bigint,text,uuid,timestamptz,timestamptz,text,text,uuid
) to authenticated;
