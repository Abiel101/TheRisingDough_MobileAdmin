-- Mirror website order items into the signed-in admin workspace. The public
-- site can only create rows in `orders` and `order_items`; the trigger is the
-- bridge into the authenticated mobile admin tables.
create or replace function public.mirror_website_order_item_to_admin()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_owner_id uuid;
  v_admin_order_id uuid;
  v_order_number text;
  v_customer_name text;
  v_phone text;
  v_email text;
  v_due_date date;
  v_order_notes text;
  v_note_prefix text;
  v_notes text;
  v_tokens jsonb;
begin
  if upper(btrim(new.product_name)) <> 'THANKSGIVING ORDER REQUEST' then
    return new;
  end if;

  select o.order_number, o.guest_name, o.phone_number, o.email_address,
         o.requested_pickup_at::date, coalesce(o.order_notes, '')
    into v_order_number, v_customer_name, v_phone, v_email, v_due_date, v_order_notes
  from public.orders o
  where o.id = new.order_id;

  if not found then
    return new;
  end if;

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

  if v_owner_id is null then
    return new;
  end if;

  v_note_prefix := 'THANKSGIVING_REQUEST|';

  select o.id into v_admin_order_id
  from public.admin_orders o
  where o.owner_id = v_owner_id
    and o.notes like v_note_prefix || 'source=' || new.order_id::text || '|%'
  limit 1;

  if v_admin_order_id is null then
    v_notes := v_note_prefix || 'source=' || new.order_id::text || '|' || E'\n'
      || 'Phone: ' || v_phone || E'\n'
      || 'Email: ' || coalesce(v_email, '') || E'\n'
      || 'Customer request: ' || v_order_notes;

    insert into public.admin_orders (
      owner_id, order_number, customer_name, due_date, status, notes, paid
    ) values (
      v_owner_id, v_order_number, v_customer_name, v_due_date, 'Pending', v_notes, false
    )
    returning id into v_admin_order_id;

    select coalesce(jsonb_agg(jsonb_build_object(
      'to', t.token,
      'title', 'New Thanksgiving request',
      'body', coalesce(nullif(v_customer_name, ''), 'A customer') || ' · ' || v_order_number,
      'sound', 'default',
      'data', jsonb_build_object('orderId', v_admin_order_id)
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

  insert into public.admin_order_items (
    owner_id, order_id, catalog_product_id, item_name, unit_price, quantity
  ) values (
    v_owner_id, v_admin_order_id, null, new.product_name,
    new.submitted_unit_price, new.quantity
  );

  return new;
end;
$function$;

revoke all on function public.mirror_website_order_item_to_admin() from public, anon, authenticated;

drop trigger if exists order_items_mirror_website_order_to_admin on public.order_items;
create trigger order_items_mirror_website_order_to_admin
  after insert on public.order_items
  for each row
  execute function public.mirror_website_order_item_to_admin();
