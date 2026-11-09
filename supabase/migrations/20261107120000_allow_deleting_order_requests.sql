-- Let owners delete their own website order requests from the mobile app.
grant delete on public.admin_order_requests to authenticated;

drop policy if exists "Owners can delete their website order requests" on public.admin_order_requests;
create policy "Owners can delete their website order requests"
  on public.admin_order_requests for delete to authenticated
  using ((select auth.uid()) = owner_id);
