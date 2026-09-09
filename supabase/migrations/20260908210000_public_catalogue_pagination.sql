create function public.get_public_catalogue_page(
  p_search text default null,
  p_category_code text default null,
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (
  item_code text,
  slug text,
  display_name text,
  description text,
  category_code text,
  category_name text,
  unit_code text,
  unit_name text,
  unit_symbol text,
  tags text[],
  control_code text,
  control_label text,
  control_description text,
  availability_code text,
  availability_label text,
  availability_description text,
  price_amount_minor bigint,
  currency_code text,
  currency_symbol text,
  currency_symbol_position text,
  minor_unit_scale smallint,
  bulk_minimum numeric,
  order_increment numeric,
  requirement_summary text,
  published_at timestamptz,
  generated_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    catalogue.*,
    count(*) over () as total_count
  from public.get_public_catalogue(p_search, p_category_code) as catalogue
  order by
    (
      select category.sort_order
      from public.item_categories as category
      where category.code = catalogue.category_code
    ),
    catalogue.display_name,
    catalogue.item_code
  limit greatest(1, least(coalesce(p_limit, 30), 100))
  offset greatest(0, least(coalesce(p_offset, 0), 100000));
$$;

revoke all on function public.get_public_catalogue_page(text, text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_catalogue_page(text, text, integer, integer)
  to anon, authenticated;
