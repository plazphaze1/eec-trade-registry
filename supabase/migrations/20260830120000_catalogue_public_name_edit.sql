create or replace function public.staff_update_catalogue_item_with_public_name(
  p_item_id uuid,
  p_expected_version bigint,
  p_display_name text,
  p_description text,
  p_category_code text,
  p_unit_code text,
  p_inventory_mode text,
  p_internal_notes text,
  p_public_name text,
  p_reason text,
  p_request_id uuid
)
returns table (id uuid, version bigint, public_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  updated_id uuid;
  updated_version bigint;
  current_publication public.item_publications%rowtype;
  normalized_public_name text;
  effective_at timestamptz := statement_timestamp();
begin
  select updated.id, updated.version
  into updated_id, updated_version
  from public.staff_update_catalogue_item(
    p_item_id,
    p_expected_version,
    p_display_name,
    p_description,
    p_category_code,
    p_unit_code,
    p_inventory_mode,
    p_internal_notes,
    p_reason,
    p_request_id
  ) as updated;

  normalized_public_name := nullif(btrim(coalesce(p_public_name, '')), '');

  if normalized_public_name is not null then
    select publication.*
    into current_publication
    from public.item_publications as publication
    where publication.item_id = p_item_id
      and publication.audience_code = 'public'
      and publication.publication_status = 'published'
      and publication.effective_from <= effective_at
      and (
        publication.effective_until is null
        or publication.effective_until > effective_at
      )
    order by publication.effective_from desc
    limit 1
    for update;

    if found and current_publication.public_name is distinct from normalized_public_name then
      perform private.set_staff_audit_context(
        'publication.manage',
        p_reason,
        p_request_id,
        'staff_item_editor'
      );

      update public.item_publications as publication
      set effective_until = effective_at
      where publication.id = current_publication.id;

      insert into public.item_publications (
        item_id,
        audience_code,
        publication_status,
        public_name,
        public_description,
        control_profile_id,
        availability_profile_id,
        requirement_summary,
        bulk_minimum,
        order_increment,
        media_url,
        effective_from
      ) values (
        current_publication.item_id,
        current_publication.audience_code,
        current_publication.publication_status,
        normalized_public_name,
        current_publication.public_description,
        current_publication.control_profile_id,
        current_publication.availability_profile_id,
        current_publication.requirement_summary,
        current_publication.bulk_minimum,
        current_publication.order_increment,
        current_publication.media_url,
        effective_at
      );

      insert into public.outbox_events (
        event_type,
        aggregate_type,
        aggregate_id,
        payload,
        deduplication_key
      ) values (
        'catalogue.public_name_changed',
        'item',
        p_item_id,
        jsonb_build_object(
          'item_id', p_item_id,
          'previous_public_name', current_publication.public_name,
          'public_name', normalized_public_name
        ),
        'catalogue.public_name_changed:' || p_request_id::text
      );
    end if;
  end if;

  select publication.public_name
  into normalized_public_name
  from public.item_publications as publication
  where publication.item_id = p_item_id
    and publication.audience_code = 'public'
    and publication.publication_status = 'published'
    and publication.effective_from <= statement_timestamp()
    and (
      publication.effective_until is null
      or publication.effective_until > statement_timestamp()
    )
  order by publication.effective_from desc
  limit 1;

  return query select updated_id, updated_version, normalized_public_name;
end;
$$;

comment on function public.staff_update_catalogue_item_with_public_name(
  uuid, bigint, text, text, text, text, text, text, text, text, uuid
) is
  'Updates a canonical catalogue item and, when supplied, replaces its current public name in the same transaction while preserving all other effective public terms.';

revoke all on function public.staff_update_catalogue_item_with_public_name(
  uuid, bigint, text, text, text, text, text, text, text, text, uuid
) from public, anon;
grant execute on function public.staff_update_catalogue_item_with_public_name(
  uuid, bigint, text, text, text, text, text, text, text, text, uuid
) to authenticated;
