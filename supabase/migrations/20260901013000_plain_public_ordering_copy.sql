-- Replace the original registry-style raw-material note with player-facing copy.

update public.item_publications as publication
set requirement_summary =
  'Choose the amount you need. An EEC Agent will confirm the price and delivery.'
from public.items as item
join public.item_categories as category
  on category.id = item.category_id
where item.id = publication.item_id
  and category.code = 'raw-materials'
  and publication.audience_code = 'public'
  and publication.publication_status in ('draft', 'published')
  and publication.requirement_summary =
    'Published reserve availability is informational; staff confirm quantity and current price when ordering.';
