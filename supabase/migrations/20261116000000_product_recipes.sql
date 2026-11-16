-- Recipe ingredients for one unit of a catalog item, used to total the
-- inventory needed for orders that have not been started.
create table if not exists public.admin_product_recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.admin_products(id) on delete cascade,
  ingredient text not null check (btrim(ingredient) <> ''),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists admin_product_recipes_owner_idx
  on public.admin_product_recipes (owner_id, product_id);

alter table public.admin_product_recipes enable row level security;
revoke all on public.admin_product_recipes from anon;
grant select, insert, update, delete on public.admin_product_recipes to authenticated;

drop policy if exists "Owners manage their product recipes" on public.admin_product_recipes;
create policy "Owners manage their product recipes"
  on public.admin_product_recipes for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
