create or replace function public.consume_public_action_rate_limit(
  p_scope text,
  p_fingerprint text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_window interval;
  maximum_requests integer;
  current_count integer;
begin
  if p_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_public_action_fingerprint';
  end if;

  case p_scope
    when 'license_application_submit_ip' then
      current_window := interval '1 hour';
      maximum_requests := 5;
    when 'license_application_status_ip' then
      current_window := interval '10 minutes';
      maximum_requests := 60;
    when 'license_application_status_reference' then
      current_window := interval '10 minutes';
      maximum_requests := 10;
    else
      raise exception using errcode = '22023', message = 'invalid_public_action_scope';
  end case;

  insert into private.public_verification_rate_limits as bucket (
    fingerprint,
    window_started_at,
    request_count,
    updated_at
  )
  values (p_fingerprint, current_timestamp, 1, current_timestamp)
  on conflict (fingerprint) do update
  set
    window_started_at = case
      when bucket.window_started_at <= current_timestamp - current_window
        then current_timestamp
      else bucket.window_started_at
    end,
    request_count = case
      when bucket.window_started_at <= current_timestamp - current_window then 1
      else bucket.request_count + 1
    end,
    updated_at = current_timestamp
  returning request_count into current_count;

  delete from private.public_verification_rate_limits
  where updated_at < current_timestamp - interval '1 day';

  return current_count <= maximum_requests;
end;
$$;

comment on function public.consume_public_action_rate_limit(text, text) is
  'Consumes a server-only, scope-specific abuse-control bucket for anonymous public actions.';

revoke all on function public.consume_public_action_rate_limit(text, text)
  from public, anon, authenticated;
grant execute on function public.consume_public_action_rate_limit(text, text)
  to service_role;

create or replace function private.reject_new_license_renewal_application()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.application_type = 'renewal' then
    raise exception using errcode = '22023', message = 'license_renewals_disabled';
  end if;
  return new;
end;
$$;

drop trigger if exists license_applications_reject_new_renewals
  on public.license_applications;
create trigger license_applications_reject_new_renewals
before insert on public.license_applications
for each row execute function private.reject_new_license_renewal_application();

comment on function private.reject_new_license_renewal_application() is
  'Preserves historical renewal rows while preventing any new renewal application.';

create or replace function private.reject_license_renewal_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '22023', message = 'license_renewals_disabled';
end;
$$;

drop trigger if exists license_renewal_events_reject_new
  on public.license_renewal_events;
create trigger license_renewal_events_reject_new
before insert on public.license_renewal_events
for each row execute function private.reject_license_renewal_event();

comment on function private.reject_license_renewal_event() is
  'Preserves historical renewal evidence while preventing future renewal commands.';

revoke all on function public.public_submit_license_renewal(text, uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.public_submit_license_application(
  text, text, text, text, text, text, text[], text, uuid
) from public, anon, authenticated;
grant execute on function public.public_submit_license_application(
  text, text, text, text, text, text, text[], text, uuid
) to service_role;

revoke all on function public.public_get_license_application_status(text, text)
  from public, anon, authenticated;
grant execute on function public.public_get_license_application_status(text, text)
  to service_role;
