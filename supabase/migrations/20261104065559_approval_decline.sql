-- Record a customer's refusal of an order approval request.
alter table public.admin_orders
  add column if not exists declined_at timestamptz;

alter table public.admin_orders
  drop constraint if exists admin_orders_approval_status_check;
alter table public.admin_orders
  add constraint admin_orders_approval_status_check
    check (approval_status in ('draft', 'pending', 'approved', 'declined'));

create or replace function public.decline_order(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.admin_orders
  where approval_token = p_token
    and approval_status = 'pending'
    and status <> 'Cancelled'
  for update;

  if v_id is null then
    return public.get_order_for_approval(p_token);
  end if;

  update public.admin_orders
  set approval_status = 'declined',
      declined_at = now(),
      approved_at = null,
      approved_by_name = null,
      approved_total = null
  where id = v_id;

  return public.get_order_for_approval(p_token);
end;
$$;

revoke all on function public.decline_order(uuid) from public;
grant execute on function public.decline_order(uuid) to anon, authenticated;

-- Send an owner push alert when a customer declines. The function is trigger-only.
create or replace function public.notify_order_declined()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_tokens jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'to', t.token,
    'title', 'Order declined',
    'body', coalesce(nullif(new.customer_name, ''), 'A customer')
      || ' declined order ' || new.order_number,
    'sound', 'default',
    'data', jsonb_build_object('orderId', new.id, 'approvalStatus', 'declined')
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

revoke all on function public.notify_order_declined() from public, anon, authenticated;

drop trigger if exists admin_orders_notify_declined on public.admin_orders;
create trigger admin_orders_notify_declined
  after update of approval_status on public.admin_orders
  for each row
  when (new.approval_status = 'declined' and old.approval_status is distinct from 'declined')
  execute function public.notify_order_declined();
