-- Allow admin orders to be cancelled while preserving all current statuses.
alter table public.admin_orders
  drop constraint if exists admin_orders_status_check;

alter table public.admin_orders
  add constraint admin_orders_status_check
  check (status in ('Pending', 'In progress', 'Ready', 'Fulfilled', 'Cancelled'));
