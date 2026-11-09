-- Catalog item options (e.g. Sourdough -> Veggie, Coffee Chocolate Espresso).
-- An item without options keeps behaving exactly as before.
create table if not exists public.admin_product_options (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.admin_products(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  -- null means the option uses the catalog item's own price.
  unit_price numeric(10, 2) check (unit_price is null or unit_price >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists admin_product_options_product_name_key
  on public.admin_product_options (product_id, lower(btrim(name)));
create index if not exists admin_product_options_owner_idx
  on public.admin_product_options (owner_id, product_id);

alter table public.admin_product_options enable row level security;
revoke all on public.admin_product_options from anon;
grant select, insert, update, delete on public.admin_product_options to authenticated;

drop policy if exists "Owners manage their product options" on public.admin_product_options;
create policy "Owners manage their product options"
  on public.admin_product_options for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Order lines snapshot the chosen option. Existing lines get the "Default" option.
alter table public.admin_order_items
  add column if not exists option_name text not null default 'Default',
  add column if not exists catalog_option_id uuid references public.admin_product_options(id) on delete set null;

update public.admin_order_items
set option_name = 'Default'
where option_name is null or btrim(option_name) = '';

-- Website requests: keep the option chosen on the website and default the rest.
update public.admin_order_requests r
set requested_items = coalesce((
  select jsonb_agg(
    case
      when coalesce(nullif(btrim(item ->> 'optionName'), ''), '') = ''
        then item || jsonb_build_object('optionName', 'Default')
      else item
    end
    order by ord
  )
  from jsonb_array_elements(r.requested_items) with ordinality as t(item, ord)
), '[]'::jsonb)
where jsonb_typeof(r.requested_items) = 'array'
  and jsonb_array_length(r.requested_items) > 0;

-- The customer approval payload now carries each line's option.
create or replace function public.admin_order_approval_payload(p_order_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'order_number', o.order_number,
    'customer_name', o.customer_name,
    'due_date', o.due_date,
    'status', o.status,
    'approval_status', o.approval_status,
    'approved_at', o.approved_at,
    'approved_total', o.approved_total,
    'declined_at', o.declined_at,
    'discount_type', o.discount_type,
    'discount_value', o.discount_value,
    'subtotal', t.subtotal,
    'discount_amount', t.discount_amount,
    'total', t.total,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.item_name,
        'option_name', i.option_name,
        'unit_price', i.unit_price,
        'quantity', i.quantity
      ) order by i.item_name, i.option_name)
      from public.admin_order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.admin_orders o, public.admin_order_totals(o.id) t
  where o.id = p_order_id;
$$;
revoke all on function public.admin_order_approval_payload(uuid) from public, anon, authenticated;

-- Website requests record the option for each requested item.
-- The website's own order_items row may expose it as option_name; otherwise the
-- mobile app derives it from the product name.
create or replace function public.mirror_website_order_item_to_admin()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_owner_id uuid;
  v_order_number text;
  v_customer_name text;
  v_phone text;
  v_email text;
  v_due_date date;
  v_order_notes text;
  v_created_at timestamptz;
  v_requested_items jsonb;
  v_request_id uuid;
  v_tokens jsonb;
begin
  if upper(btrim(new.product_name)) <> 'THANKSGIVING ORDER REQUEST' then
    return new;
  end if;

  select o.order_number, o.guest_name, o.phone_number, o.email_address,
         o.requested_pickup_at::date, coalesce(o.order_notes, ''), o.created_at
    into v_order_number, v_customer_name, v_phone, v_email, v_due_date, v_order_notes, v_created_at
  from public.orders o
  where o.id = new.order_id;
  if not found then return new; end if;

  select t.owner_id into v_owner_id
  from public.admin_push_tokens t
  order by t.created_at desc
  limit 1;

  if v_owner_id is null then
    select o.owner_id into v_owner_id
    from public.admin_orders o
    order by o.created_at desc
    limit 1;
  end if;
  if v_owner_id is null then return new; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'productName', i.product_name,
    'optionName', coalesce(nullif(btrim(to_jsonb(i) ->> 'option_name'), ''), 'Default'),
    'quantity', i.quantity,
    'unitPrice', i.submitted_unit_price
  ) order by i.id), '[]'::jsonb)
  into v_requested_items
  from public.order_items i
  where i.order_id = new.order_id
    and upper(btrim(i.product_name)) <> 'THANKSGIVING ORDER REQUEST';

  insert into public.admin_order_requests (
    owner_id, source_order_id, source_order_number, customer_name,
    customer_phone, customer_email, due_date, request_notes, requested_items, created_at
  ) values (
    v_owner_id, new.order_id, v_order_number, v_customer_name,
    v_phone, v_email, v_due_date, v_order_notes, v_requested_items, v_created_at
  )
  on conflict (source_order_id) do nothing
  returning id into v_request_id;

  if v_request_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'to', t.token,
      'title', 'New Thanksgiving request',
      'body', coalesce(nullif(v_customer_name, ''), 'A customer') || ' · ' || v_order_number,
      'sound', 'default',
      'data', jsonb_build_object('requestId', v_request_id)
    )), '[]'::jsonb)
    into v_tokens
    from public.admin_push_tokens t
    where t.owner_id = v_owner_id;

    if jsonb_array_length(v_tokens) > 0 then
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := v_tokens,
        headers := '{"Content-Type": "application/json"}'::jsonb
      );
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.mirror_website_order_item_to_admin() from public, anon, authenticated;
