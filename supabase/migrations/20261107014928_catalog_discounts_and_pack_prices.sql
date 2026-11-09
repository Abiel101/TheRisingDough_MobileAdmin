alter table public.admin_products
  add column discount_type text,
  add column discount_value numeric(10, 2) not null default 0,
  add column pricing_options jsonb not null default '[]'::jsonb,
  add constraint admin_products_discount_type_check
    check (discount_type is null or discount_type in ('percent', 'amount')),
  add constraint admin_products_discount_value_check
    check (
      (discount_type is null and discount_value = 0)
      or (discount_type = 'percent' and discount_value > 0 and discount_value <= 100)
      or (discount_type = 'amount' and discount_value > 0)
    ),
  add constraint admin_products_pricing_options_array_check
    check (jsonb_typeof(pricing_options) = 'array');

create table public.admin_catalog_promotions (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Holiday promotion',
  is_active boolean not null default false,
  discount_percent numeric(5, 2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 100),
  stack_on_product_discount boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_catalog_promotions enable row level security;
revoke all on public.admin_catalog_promotions from anon, authenticated;
grant select, insert, update on public.admin_catalog_promotions to authenticated;

create policy "Owners can read their catalog promotion"
  on public.admin_catalog_promotions for select to authenticated
  using (auth.uid() = owner_id);

create policy "Owners can create their catalog promotion"
  on public.admin_catalog_promotions for insert to authenticated
  with check (auth.uid() = owner_id);

create policy "Owners can update their catalog promotion"
  on public.admin_catalog_promotions for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

comment on column public.admin_products.pricing_options is
  'Fixed pack/size price overrides as [{id,label,packSize,priceCents}].';
comment on column public.admin_products.discount_value is
  'Per-item discount value in percent or USD according to discount_type.';
