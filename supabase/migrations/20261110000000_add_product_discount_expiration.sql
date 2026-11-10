alter table public.admin_products
  add column if not exists discount_ends_on date;

comment on column public.admin_products.discount_ends_on is
  'Last local calendar date on which the item discount applies.';

update public.admin_product_options o
set unit_price = p.unit_price
from public.admin_products p
where o.product_id = p.id
  and o.unit_price is null;

insert into public.admin_product_options (owner_id, product_id, name, unit_price, sort_order)
select p.owner_id, p.id, 'Regular', p.unit_price, 0
from public.admin_products p
where not exists (
  select 1
  from public.admin_product_options o
  where o.product_id = p.id
);
