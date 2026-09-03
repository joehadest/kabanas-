-- Sincroniza a Cozinha (KDS) com o estado real das mesas.
--
-- O KDS lê tab_items com status in ('new','preparing','ready'). Até aqui, ao
-- fechar uma comanda (close_tab_to_sale) só a tab virava 'closed' — os itens
-- que a cozinha ainda não tinha marcado como servidos ficavam "presos" na
-- tela, mostrando pedido de mesa já paga e liberada. Esta migração redefine a
-- função para também marcar esses itens como 'served' ao fechar a venda.
--
-- Cancelar item (cancelItem) e cancelar comanda (voidOpenComanda) já
-- funcionavam corretamente; excluir a mesa é sincronizado no código da
-- aplicação (TableManager.remove), pois FK de tab_id não é apagada ao
-- excluir a mesa.
--
-- Também liga o Realtime em tab_items para o KDS refletir qualquer mudança
-- na hora (sem depender só do polling de 15s).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tab_items'
  ) then
    alter publication supabase_realtime add table tab_items;
  end if;
end $$;

create or replace function close_tab_to_sale(tab_to_close uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  tab_row tabs%rowtype;
  subtotal numeric(10,2);
  payment_fees numeric(10,2);
  tax_total numeric(10,2);
  cost_total numeric(10,2);
  total numeric(10,2);
  sale_id uuid;
begin
  select * into tab_row from tabs where id = tab_to_close for update;
  if not found or tab_row.status = 'closed' then raise exception 'Comanda inválida ou já fechada'; end if;
  select coalesce(sum(quantity * unit_price), 0), coalesce(sum(quantity * unit_cost), 0), coalesce(sum(quantity * unit_price * tax_rate / 100), 0)
  into subtotal, cost_total, tax_total from tab_items where tab_id = tab_to_close and status <> 'cancelled';
  total := subtotal + subtotal * tab_row.service_rate / 100 + tab_row.cover_charge * tab_row.guest_count - tab_row.discount_amount;
  select coalesce(sum(p.amount * coalesce(pm.fee_rate, 0) / 100), 0) into payment_fees from tab_payments p left join payment_methods pm on pm.id = p.payment_method_id where p.tab_id = tab_to_close;
  if total < 0 then raise exception 'O desconto não pode superar o total da comanda'; end if;
  if abs(coalesce((select sum(amount) from tab_payments where tab_id = tab_to_close), 0) - total) > 0.01 then raise exception 'Os pagamentos precisam totalizar o valor da comanda'; end if;
  insert into sales (store_id, total_amount, total_cost, payment_fee, tax_amount, net_profit, installments, occurred_at, notes)
  values (tab_row.store_id, total, cost_total, payment_fees, tax_total, total - cost_total - payment_fees - tax_total, 1, now(), 'Comanda ' || coalesce(tab_row.identifier, tab_row.id::text)) returning id into sale_id;
  insert into sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, payment_fee, tax_amount, net_profit)
  select sale_id, product_id, product_name, quantity, unit_price, unit_cost, quantity * unit_price * tab_row.service_rate / 100, quantity * unit_price * tax_rate / 100, quantity * unit_price - quantity * unit_cost - quantity * unit_price * tax_rate / 100 from tab_items where tab_id = tab_to_close and status <> 'cancelled';
  update tab_items set status = 'served' where tab_id = tab_to_close and status in ('new', 'preparing', 'ready');
  update tabs set status = 'closed', closed_at = now() where id = tab_to_close;
  return sale_id;
end;
$$;
