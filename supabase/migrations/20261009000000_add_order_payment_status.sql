-- Adds a simple payment flag for the mobile order detail workflow.
-- Apply this additive migration to the Supabase project before using payment controls.
alter table public.admin_orders
  add column if not exists paid boolean not null default false;

comment on column public.admin_orders.paid is
  'Owner-managed payment status for this admin order; this does not represent a payment processor transaction.';
