-- Adds order discounts, customer approval links and push notifications for approvals.
alter table public.admin_orders
  add column if not exists discount_type text,
  add column if not exists discount_value numeric(10, 2) not null default 0,
  add column if not exists approval_token uuid not null default gen_random_uuid(),
  add column if not exists approval_status text not null default 'draft',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by_name text,
  add column if not exists approved_total numeric(10, 2);

create unique index if not exists admin_orders_approval_token_key
  on public.admin_orders (approval_token);

alter table public.admin_orders
  drop constraint if exists admin_orders_discount_check,
  drop constraint if exists admin_orders_approval_status_check;
alter table public.admin_orders
  add constraint admin_orders_discount_check check (
    (discount_type is null and discount_value = 0)
    or (discount_type = 'percent' and discount_value > 0 and discount_value <= 100)
    or (discount_type = 'amount' and discount_value > 0)
  ),
  add constraint admin_orders_approval_status_check
    check (approval_status in ('draft', 'pending', 'approved'));

-- Expo push tokens of the devices that should be notified about approvals.
create table if not exists public.admin_push_tokens (
  owner_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, token)
);
alter table public.admin_push_tokens enable row level security;
drop policy if exists "Owners manage their push tokens" on public.admin_push_tokens;
create policy "Owners manage their push tokens" on public.admin_push_tokens
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Server-side total so the approved amount can never be supplied by the client.
create or replace function public.admin_order_totals(p_order_id uuid)
returns table (subtotal numeric, discount_amount numeric, total numeric)
language sql stable security definer set search_path = public as $$
  with s as (
    select coalesce(sum(i.unit_price * i.quantity), 0)::numeric as subtotal
    from public.admin_order_items i where i.order_id = p_order_id
  ), o as (
    select discount_type, discount_value from public.admin_orders where id = p_order_id
  )
  select s.subtotal,
    d.amount,
    round(s.subtotal - d.amount, 2)
  from s, o,
  lateral (select round(case
    when o.discount_type = 'percent' then s.subtotal * least(o.discount_value, 100) / 100
    when o.discount_type = 'amount' then least(o.discount_value, s.subtotal)
    else 0 end, 2) as amount) d;
$$;
revoke all on function public.admin_order_totals(uuid) from public, anon, authenticated;

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
    'discount_type', o.discount_type,
    'discount_value', o.discount_value,
    'subtotal', t.subtotal,
    'discount_amount', t.discount_amount,
    'total', t.total,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.item_name, 'unit_price', i.unit_price, 'quantity', i.quantity
      ) order by i.item_name)
      from public.admin_order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.admin_orders o, public.admin_order_totals(o.id) t
  where o.id = p_order_id;
$$;
revoke all on function public.admin_order_approval_payload(uuid) from public, anon, authenticated;

-- Public, token-gated read for the customer approval page.
create or replace function public.get_order_for_approval(p_token uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select public.admin_order_approval_payload(o.id)
  from public.admin_orders o where o.approval_token = p_token;
$$;

-- Public, token-gated approval. Only orders awaiting approval can be approved.
create or replace function public.approve_order(p_token uuid, p_name text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_total numeric;
begin
  select id into v_id from public.admin_orders
  where approval_token = p_token
    and approval_status = 'pending'
    and status <> 'Cancelled'
  for update;
  if v_id is null then
    return public.get_order_for_approval(p_token);
  end if;
  select total into v_total from public.admin_order_totals(v_id);
  update public.admin_orders
  set approval_status = 'approved',
      approved_at = now(),
      approved_by_name = nullif(btrim(p_name), ''),
      approved_total = v_total
  where id = v_id;
  return public.get_order_for_approval(p_token);
end;
$$;

grant execute on function public.get_order_for_approval(uuid) to anon, authenticated;
grant execute on function public.approve_order(uuid, text) to anon, authenticated;

-- Push the owner's devices when a customer approves an order (requires pg_net).
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_order_approved()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_tokens jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'to', t.token,
    'title', 'Order approved',
    'body', coalesce(nullif(new.approved_by_name, ''), new.customer_name, 'A customer')
      || ' approved order ' || new.order_number || ' for $' || to_char(new.approved_total, 'FM999990.00'),
    'sound', 'default',
    'data', jsonb_build_object('orderId', new.id)
  )), '[]'::jsonb)
  into v_tokens
  from public.admin_push_tokens t where t.owner_id = new.owner_id;

  if jsonb_array_length(v_tokens) > 0 then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_tokens,
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end if;
  return new;
end;
$$;

-- This function is only invoked by the table trigger, never through the Data API.
revoke all on function public.notify_order_approved() from public, anon, authenticated;

drop trigger if exists admin_orders_notify_approved on public.admin_orders;
create trigger admin_orders_notify_approved
  after update of approval_status on public.admin_orders
  for each row
  when (new.approval_status = 'approved' and old.approval_status is distinct from 'approved')
  execute function public.notify_order_approved();
