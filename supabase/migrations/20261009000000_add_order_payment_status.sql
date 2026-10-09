-- Adds payment status and method fields for the mobile order detail workflow.
-- Apply this additive migration to the Supabase project before using payment controls.
alter table public.admin_orders
  add column if not exists paid boolean not null default false,
  add column if not exists payment_method text,
  add column if not exists payment_method_other text;

do $$
begin
  alter table public.admin_orders
    add constraint admin_orders_payment_method_check
    check (
      payment_method is null
      or payment_method in ('cash', 'zelle', 'other')
    );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.admin_orders
    add constraint admin_orders_payment_method_other_check
    check (
      (payment_method = 'other' and nullif(btrim(payment_method_other), '') is not null)
      or (payment_method is distinct from 'other' and payment_method_other is null)
    );
exception
  when duplicate_object then null;
end;
$$;

comment on column public.admin_orders.paid is
  'Owner-managed payment status for this admin order; this does not represent a payment processor transaction.';

comment on column public.admin_orders.payment_method is
  'Payment method recorded by the owner when an admin order is marked paid.';

comment on column public.admin_orders.payment_method_other is
  'Custom payment method text, required when payment_method is other.';
