-- Delivery / pick-up confirmation with an optional photo, shown on the public customer link.
alter table public.admin_orders
  add column if not exists delivered_at timestamptz,
  add column if not exists delivery_method text,
  add column if not exists delivery_photo_path text;

alter table public.admin_orders
  drop constraint if exists admin_orders_delivery_method_check;
alter table public.admin_orders
  add constraint admin_orders_delivery_method_check
    check (delivery_method is null or delivery_method in ('delivery', 'pickup'));

-- Photos are public by URL (the path is unguessable) so the customer link can show them.
-- Each signed-in owner may only write inside a folder named after their user id.
insert into storage.buckets (id, name, public)
values ('delivery-photos', 'delivery-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Owners upload delivery photos" on storage.objects;
create policy "Owners upload delivery photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'delivery-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Owners replace delivery photos" on storage.objects;
create policy "Owners replace delivery photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'delivery-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Owners delete delivery photos" on storage.objects;
create policy "Owners delete delivery photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'delivery-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- The customer link now also exposes the delivery time, delivery confirmation and what is
-- needed to print an invoice.
create or replace function public.admin_order_approval_payload(p_order_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'order_number', o.order_number,
    'customer_name', o.customer_name,
    'due_date', o.due_date,
    'delivery_time', o.delivery_time,
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
    'paid', coalesce(o.paid, false),
    'payment_method', o.payment_method,
    'payment_method_other', o.payment_method_other,
    'fulfilled_date', o.fulfilled_date,
    'delivered_at', o.delivered_at,
    'delivery_method', o.delivery_method,
    'delivery_photo_path', o.delivery_photo_path,
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
