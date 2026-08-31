begin;

select plan(14);

select has_table(
  'public', 'license_application_onboarding_profiles',
  'license application onboarding is configurable'
);
select is(
  (
    select count(*)::integer
    from public.license_application_onboarding_profiles as profile
    join public.license_classes as class on class.id = profile.license_class_id
    where class.code = 'commercial-dealer'
  ),
  1,
  'the ordinary business license has one onboarding profile'
);
select ok(
  not has_table_privilege(
    'authenticated', 'public.license_application_onboarding_profiles', 'select'
  ),
  'authenticated callers cannot bypass the configured onboarding command'
);

insert into auth.users(
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
)
values (
  'fc100000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'one-step-owner@example.test',
  extensions.crypt('test-password', extensions.gen_salt('bf')),
  now(), now(), now()
);

insert into public.actor_profiles(id, auth_user_id, display_name, actor_type)
values (
  'fc200000-0000-4000-8000-000000000001',
  'fc100000-0000-4000-8000-000000000001',
  'One-step owner', 'staff'
);

insert into public.staff_assignments(
  actor_id, staff_role_id, effective_from, assignment_scope
)
select
  'fc200000-0000-4000-8000-000000000001', role.id,
  '2026-01-01T00:00:00Z', '{}'::jsonb
from public.staff_roles as role
where role.code = 'platform_administrator';

set local role anon;
select lives_ok(
  $test$
    select * from public.public_submit_license_application(
      'new',
      'One Click Forge',
      'forge-discord',
      'commercial-dealer',
      'harbor-district',
      null,
      array['smithing-metalwork'],
      'We make and sell forged goods.',
      'fc300000-0000-4000-8000-000000000001'
    )
  $test$,
  'a new business can submit one public request'
);
reset role;

select set_config(
  'test.one_step_application_id',
  (
    select id::text
    from public.license_applications
    where source_request_id = 'fc300000-0000-4000-8000-000000000001'
  ),
  false
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"fc100000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  $test$
    select * from public.staff_decide_license_application(
      current_setting('test.one_step_application_id')::uuid,
      1,
      'approve',
      null,
      null,
      null,
      'active',
      'Application reviewed and approved.',
      'fc300000-0000-4000-8000-000000000002'
    )
  $test$,
  'one approval creates the complete licensed business'
);
reset role;

select is(
  (select status from public.license_applications
    where source_request_id = 'fc300000-0000-4000-8000-000000000001'),
  'issued',
  'the application is issued'
);
select is(
  (select count(*)::integer from public.parties where legal_name = 'One Click Forge'),
  1,
  'one canonical business party is created'
);
select is(
  (
    select count(*)::integer
    from public.dealer_authorizations as dealer
    join public.parties as party on party.id = dealer.dealer_party_id
    join public.dealer_status_definitions as status
      on status.id = dealer.status_definition_id
    where party.legal_name = 'One Click Forge'
      and status.confers_authority
      and dealer.public_disclosure_enabled
  ),
  1,
  'one current public dealer authorization is created'
);
select is(
  (
    select count(*)::integer
    from public.licenses as license
    join public.parties as party on party.id = license.holder_party_id
    join public.dealer_authorizations as dealer
      on dealer.id = license.dealer_authorization_id
      and dealer.dealer_party_id = party.id
    where party.legal_name = 'One Click Forge'
      and license.public_disclosure_enabled
  ),
  1,
  'the public license is linked to the new business authorization'
);
select is(
  (
    select count(*)::integer
    from public.license_endorsements as endorsement
    join public.licenses as license on license.id = endorsement.license_id
    join public.parties as party on party.id = license.holder_party_id
    where party.legal_name = 'One Click Forge'
  ),
  1,
  'the requested endorsement is granted to the issued license'
);
select ok(
  exists(
    select 1 from public.outbox_events
    where event_type = 'dealer.authorization_created'
      and aggregate_id = (
        select dealer.id
        from public.dealer_authorizations as dealer
        join public.parties as party on party.id = dealer.dealer_party_id
        where party.legal_name = 'One Click Forge'
      )
  ),
  'business authorization creation emits durable projection work'
);
select ok(
  exists(
    select 1 from public.outbox_events
    where event_type = 'license.application_decided'
      and payload ->> 'party_id' = (
        select id::text from public.parties where legal_name = 'One Click Forge'
      )
  ),
  'the application decision event identifies the created business'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"fc100000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  $test$
    select * from public.staff_decide_license_application(
      current_setting('test.one_step_application_id')::uuid,
      2,
      'approve',
      null,
      null,
      null,
      'active',
      'Application reviewed and approved.',
      'fc300000-0000-4000-8000-000000000002'
    )
  $test$,
  'repeating the same decision request is idempotent'
);
reset role;

select is(
  (
    select count(*)::integer
    from public.licenses as license
    join public.parties as party on party.id = license.holder_party_id
    where party.legal_name = 'One Click Forge'
  ),
  1,
  'an idempotent retry does not duplicate the business license'
);

select * from finish();
rollback;
