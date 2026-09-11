-- Login restrito para garçons (role waiter) — PASSO 2/2.
-- Pré-requisito: execute antes supabase/migration_waiter_role_enum.sql
-- (e confirme commit). Depois rode este arquivo.
--
-- Setup da conta compartilhada (manual):
-- 1. Authentication → Users → Add user: funcionariokabanas@gmail.com + senha forte
-- 2. Rode:
--    update public.profiles
--    set role = 'waiter', full_name = 'Garçom'
--    where id = '<uuid do usuário criado>';
-- 3. Login em /entrar?redirect=/admin → deve ir para /admin/pdv

-- ---------------------------------------------------------------------------
-- Dining areas / tables: waiter só lê; admin/restaurant escrevem
-- ---------------------------------------------------------------------------
drop policy if exists "staff_all" on dining_areas;
drop policy if exists "dining_areas_staff_all" on dining_areas;
drop policy if exists "dining_areas_waiter_select" on dining_areas;
create policy "dining_areas_staff_all" on dining_areas for all
  using (auth_role() in ('admin', 'restaurant'))
  with check (auth_role() in ('admin', 'restaurant'));
create policy "dining_areas_waiter_select" on dining_areas for select
  using (auth_role() = 'waiter');

drop policy if exists "staff_all" on dining_tables;
drop policy if exists "dining_tables_staff_all" on dining_tables;
drop policy if exists "dining_tables_waiter_select" on dining_tables;
create policy "dining_tables_staff_all" on dining_tables for all
  using (auth_role() in ('admin', 'restaurant'))
  with check (auth_role() in ('admin', 'restaurant'));
create policy "dining_tables_waiter_select" on dining_tables for select
  using (auth_role() = 'waiter');

-- ---------------------------------------------------------------------------
-- 3) Comandas / itens / pagamentos / print_jobs: waiter opera
-- ---------------------------------------------------------------------------
drop policy if exists "staff_all" on tabs;
drop policy if exists "tabs_staff_all" on tabs;
create policy "tabs_staff_all" on tabs for all
  using (auth_role() in ('admin', 'restaurant', 'waiter'))
  with check (auth_role() in ('admin', 'restaurant', 'waiter'));

drop policy if exists "staff_all" on tab_items;
drop policy if exists "tab_items_staff_all" on tab_items;
create policy "tab_items_staff_all" on tab_items for all
  using (auth_role() in ('admin', 'restaurant', 'waiter'))
  with check (auth_role() in ('admin', 'restaurant', 'waiter'));

drop policy if exists "staff_all" on tab_payments;
drop policy if exists "tab_payments_staff_all" on tab_payments;
create policy "tab_payments_staff_all" on tab_payments for all
  using (auth_role() in ('admin', 'restaurant', 'waiter'))
  with check (auth_role() in ('admin', 'restaurant', 'waiter'));

drop policy if exists "staff_all" on print_jobs;
drop policy if exists "print_jobs_staff_all" on print_jobs;
create policy "print_jobs_staff_all" on print_jobs for all
  using (auth_role() in ('admin', 'restaurant', 'waiter'))
  with check (auth_role() in ('admin', 'restaurant', 'waiter'));

-- Impressoras: waiter só precisa ler (enfileirar job não exige write em thermal_printers)
drop policy if exists "staff_all" on thermal_printers;
drop policy if exists "thermal_printers_staff_all" on thermal_printers;
drop policy if exists "thermal_printers_waiter_select" on thermal_printers;
create policy "thermal_printers_staff_all" on thermal_printers for all
  using (auth_role() in ('admin', 'restaurant'))
  with check (auth_role() in ('admin', 'restaurant'));
create policy "thermal_printers_waiter_select" on thermal_printers for select
  using (auth_role() = 'waiter');

-- ---------------------------------------------------------------------------
-- 4) Leitura necessária ao PDV (formas de pagamento, vendas recentes, caixa aberto)
-- ---------------------------------------------------------------------------
drop policy if exists "payment_methods_waiter_select" on payment_methods;
create policy "payment_methods_waiter_select" on payment_methods for select
  using (auth_role() = 'waiter');

drop policy if exists "sales_waiter_select" on sales;
create policy "sales_waiter_select" on sales for select
  using (auth_role() = 'waiter');

drop policy if exists "sale_items_waiter_select" on sale_items;
create policy "sale_items_waiter_select" on sale_items for select
  using (auth_role() = 'waiter');

drop policy if exists "cash_sessions_waiter_select" on cash_sessions;
create policy "cash_sessions_waiter_select" on cash_sessions for select
  using (auth_role() = 'waiter');

-- Produtos/categorias inativos: staff full já vê; waiter usa select público (ativos).
-- Profiles: waiter lê o próprio via profiles_select_own_or_staff — inclui só admin/restaurant.
-- Garantir que waiter continue lendo o próprio perfil (já coberto por id = auth.uid()).

-- ---------------------------------------------------------------------------
-- 5) Caixa: garçom usa qualquer turno aberto da loja (não o próprio)
-- ---------------------------------------------------------------------------
create or replace function assign_tab_payment_cash_session()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  tab_store_id uuid;
  role_now user_role;
begin
  select store_id into tab_store_id from tabs where id = new.tab_id;
  role_now := auth_role();

  if role_now = 'waiter' then
    select id into new.cash_session_id from cash_sessions
    where store_id = tab_store_id and status = 'open' and operator_id = auth.uid()
    order by opened_at desc limit 1;

    if new.cash_session_id is null then
      select id into new.cash_session_id from cash_sessions
      where store_id = tab_store_id and status = 'open'
      order by opened_at desc limit 1;
    end if;
  else
    select id into new.cash_session_id from cash_sessions
    where store_id = tab_store_id and operator_id = auth.uid() and status = 'open'
    order by opened_at desc limit 1;
  end if;

  if new.cash_session_id is null then
    raise exception 'Abra o caixa antes de registrar um pagamento';
  end if;
  return new;
end;
$$;

create or replace function require_open_cash_session()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  active_session uuid;
  role_now user_role;
begin
  if new.cash_session_id is not null then
    return new;
  end if;

  role_now := auth_role();

  if role_now = 'waiter' then
    select id into active_session from cash_sessions
    where store_id = new.store_id and status = 'open' and operator_id = auth.uid()
    order by opened_at desc limit 1;

    if active_session is null then
      select id into active_session from cash_sessions
      where store_id = new.store_id and status = 'open'
      order by opened_at desc limit 1;
    end if;
  else
    select id into active_session from cash_sessions
    where store_id = new.store_id and operator_id = auth.uid() and status = 'open'
    order by opened_at desc limit 1;
  end if;

  if active_session is null then
    raise exception 'Abra o caixa antes de registrar uma venda';
  end if;

  new.cash_session_id := active_session;
  return new;
end;
$$;

-- close_tab_to_sale é SECURITY DEFINER — waiter pode chamar; insert em sales
-- passa pelo trigger acima (auth_role() = waiter → qualquer caixa aberto).

grant execute on function close_tab_to_sale(uuid) to authenticated;
