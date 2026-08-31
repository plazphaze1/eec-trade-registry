-- Remove public-facing legacy names without changing stable internal references.

update public.items
set slug = 'firewood',
    display_name = 'Firewood',
    description = 'Firewood purchased into the Company reserve.'
where item_code = 'RM-LUMBER';

update public.item_publications as publication
set public_name = 'Firewood',
    public_description = 'Firewood purchased into the Company reserve.'
from public.items as item
where item.id = publication.item_id
  and item.item_code = 'RM-LUMBER'
  and publication.audience_code = 'public'
  and publication.publication_status in ('draft', 'published');

-- Older owner accounts predate the Discord approval queue. When an approved,
-- protected owner request has a newer Discord display name, make that approved
-- identity the staff roster name as well. No private identity is hard-coded.
update public.actor_profiles as actor
set display_name = btrim(access_request.display_name)
from public.staff_access_requests as access_request
where access_request.auth_user_id = actor.auth_user_id
  and access_request.approved_actor_id = actor.id
  and access_request.status = 'approved'
  and btrim(access_request.display_name) <> ''
  and actor.display_name is distinct from btrim(access_request.display_name)
  and exists (
    select 1
    from public.staff_assignments as assignment
    join public.staff_roles as role
      on role.id = assignment.staff_role_id
    where assignment.actor_id = actor.id
      and role.code in ('owner', 'platform_administrator')
      and assignment.revoked_at is null
      and assignment.effective_from <= statement_timestamp()
      and (
        assignment.effective_until is null
        or assignment.effective_until > statement_timestamp()
      )
  );
