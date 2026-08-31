-- =====================================================================
-- MIGRAÇÃO — checkout de convidado (sem login obrigatório)
-- Não destrutiva: só altera colunas/policies, não apaga dados.
-- Rode uma vez no SQL Editor do Supabase.
-- =====================================================================

alter table orders alter column user_id drop not null;
alter table orders add column if not exists guest_id uuid;
alter table orders add column if not exists guest_name text;
alter table orders add column if not exists guest_phone text;
alter table orders drop constraint if exists orders_owner_check;
alter table orders add constraint orders_owner_check check (
  (user_id is not null and guest_id is null) or (user_id is null and guest_id is not null)
);

alter table addresses alter column user_id drop not null;
alter table addresses add column if not exists guest_id uuid;
alter table addresses drop constraint if exists addresses_owner_check;
alter table addresses add constraint addresses_owner_check check (
  (user_id is not null and guest_id is null) or (user_id is null and guest_id is not null)
);

create index if not exists idx_orders_guest on orders(guest_id);
create index if not exists idx_addresses_guest on addresses(guest_id);

-- Lê o header x-guest-id (enviado pelo app em toda chamada) para identificar
-- o visitante sem conta nas policies de RLS, sem depender do Supabase Auth.
create or replace function requesting_guest_id()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.headers', true)::json->>'x-guest-id', '')::uuid
$$;

drop policy if exists "addresses_owner_all" on addresses;
create policy "addresses_owner_all" on addresses for all
  using (user_id = auth.uid() or (user_id is null and guest_id = requesting_guest_id()))
  with check (user_id = auth.uid() or (user_id is null and guest_id = requesting_guest_id()));

drop policy if exists "orders_select_own_or_staff" on orders;
create policy "orders_select_own_or_staff" on orders for select
  using (
    auth_role() in ('admin', 'restaurant')
    or user_id = auth.uid()
    or (user_id is null and guest_id = requesting_guest_id())
  );

drop policy if exists "orders_insert_own" on orders;
create policy "orders_insert_own" on orders for insert
  with check (
    user_id = auth.uid()
    or (user_id is null and guest_id = requesting_guest_id())
  );

drop policy if exists "orders_update_staff_or_owner_cancel" on orders;
create policy "orders_update_staff_or_owner_cancel" on orders for update
  using (
    auth_role() in ('admin', 'restaurant')
    or user_id = auth.uid()
    or (user_id is null and guest_id = requesting_guest_id())
  );

drop policy if exists "order_items_select" on order_items;
create policy "order_items_select" on order_items for select
  using (exists (
    select 1 from orders o where o.id = order_id and (
      o.user_id = auth.uid()
      or (o.user_id is null and o.guest_id = requesting_guest_id())
      or auth_role() in ('admin','restaurant')
    )
  ));

drop policy if exists "order_items_insert" on order_items;
create policy "order_items_insert" on order_items for insert
  with check (exists (
    select 1 from orders o where o.id = order_id and (
      o.user_id = auth.uid() or (o.user_id is null and o.guest_id = requesting_guest_id())
    )
  ));

drop policy if exists "order_item_options_select" on order_item_options;
create policy "order_item_options_select" on order_item_options for select
  using (exists (
    select 1 from order_items oi join orders o on o.id = oi.order_id
    where oi.id = order_item_id and (
      o.user_id = auth.uid()
      or (o.user_id is null and o.guest_id = requesting_guest_id())
      or auth_role() in ('admin','restaurant')
    )
  ));

drop policy if exists "order_item_options_insert" on order_item_options;
create policy "order_item_options_insert" on order_item_options for insert
  with check (exists (
    select 1 from order_items oi join orders o on o.id = oi.order_id
    where oi.id = order_item_id and (
      o.user_id = auth.uid() or (o.user_id is null and o.guest_id = requesting_guest_id())
    )
  ));

drop policy if exists "status_history_select" on order_status_history;
create policy "status_history_select" on order_status_history for select
  using (exists (
    select 1 from orders o where o.id = order_id and (
      o.user_id = auth.uid()
      or (o.user_id is null and o.guest_id = requesting_guest_id())
      or auth_role() in ('admin','restaurant')
    )
  ));
