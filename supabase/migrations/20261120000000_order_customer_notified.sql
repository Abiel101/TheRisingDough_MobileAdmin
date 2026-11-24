-- Tracks the delivery time shared with a customer and when they were notified their order is due.
alter table public.admin_orders
  add column if not exists delivery_time text,
  add column if not exists customer_notified_at timestamptz;
