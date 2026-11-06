-- Keep public website requests separate from admin orders until an owner
-- chooses to build and send a customer approval for a real order.
create table if not exists public.admin_order_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_order_id uuid not null unique,
  source_order_number text not null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  due_date date not null,
  request_notes text not null default '',
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'converted')),
  converted_order_id uuid references public.admin_orders(id) on delete set null
);

create index if not exists admin_order_requests_owner_created_idx
  on public.admin_order_requests (owner_id, created_at desc);

alter table public.admin_order_requests enable row level security;
revoke all on public.admin_order_requests from anon, authenticated;
grant select, update on public.admin_order_requests to authenticated;

drop policy if exists "Owners can view their website order requests" on public.admin_order_requests;
create policy "Owners can view their website order requests"
  on public.admin_order_requests for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Owners can update their website order requests" on public.admin_order_requests;
create policy "Owners can update their website order requests"
  on public.admin_order_requests for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Migrate any request mirrors created by the previous mobile notification
-- trigger before deleting their placeholder admin orders.
insert into public.admin_order_requests (
  id, owner_id, source_order_id, source_order_number, customer_name,
  customer_phone, customer_email, due_date, request_notes, created_at
)
select
  a.id,
  a.owner_id,
  substring(a.notes from 'source=([0-9a-fA-F-]{36})')::uuid,
  a.order_number,
  coalesce(a.customer_name, 'Customer'),
  coalesce(nullif(substring(a.notes from 'Phone: ([^\n]*)'), ''), ''),
  nullif(substring(a.notes from 'Email: ([^\n]*)'), ''),
  a.due_date,
  coalesce(substring(a.notes from 'Customer request: ([\s\S]*)$'), ''),
  a.created_at
from public.admin_orders a
where a.notes like 'THANKSGIVING_REQUEST|source=%'
  and substring(a.notes from 'source=([0-9a-fA-F-]{36})') is not null
on conflict (source_order_id) do nothing;

delete from public.admin_order_items i
using public.admin_orders a
where i.order_id = a.id and a.notes like 'THANKSGIVING_REQUEST|%';

delete from public.admin_orders a
where a.notes like 'THANKSGIVING_REQUEST|%';

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

  insert into public.admin_order_requests (
    owner_id, source_order_id, source_order_number, customer_name,
    customer_phone, customer_email, due_date, request_notes, created_at
  ) values (
    v_owner_id, new.order_id, v_order_number, v_customer_name,
    v_phone, v_email, v_due_date, v_order_notes, v_created_at
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
drop trigger if exists order_items_mirror_website_order_to_admin on public.order_items;
create trigger order_items_mirror_website_order_to_admin
  after insert on public.order_items
  for each row execute function public.mirror_website_order_item_to_admin();
