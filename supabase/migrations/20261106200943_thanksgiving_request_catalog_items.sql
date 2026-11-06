alter table public.admin_order_requests
  add column if not exists requested_items jsonb not null default '[]'::jsonb;

-- Keep the original free-text item list from the first version while removing
-- customer/date metadata that is already stored in dedicated columns.
update public.admin_order_requests
set request_notes = coalesce(substring(request_notes from 'Items: (.*)$'), request_notes)
where request_notes like 'THANKSGIVING_REQUEST|%Items:%';

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
