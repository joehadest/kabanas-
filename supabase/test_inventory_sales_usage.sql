-- Teste da baixa automática do inventário (migration_inventory_sales_usage.sql).
--
-- Rode no SQL Editor do Supabase DEPOIS da migração. Tudo acontece dentro de um
-- bloco que termina com um erro proposital: o Postgres desfaz todas as mudanças,
-- então nada fica gravado (nem produto, nem comanda, nem pedido de teste).
-- Leia o resultado na mensagem do erro:
--   "OK: ..."      -> todos os passos passaram
--   "FALHOU N ..." -> o passo N deu resultado diferente do esperado

do $$
declare
  v_store uuid := (select id from store_settings order by created_at limit 1);
  v_product uuid;
  v_item uuid;
  v_tab uuid;
  v_tab_item uuid;
  v_order uuid;
  v_qty numeric;
  v_log text := '';
begin
  insert into products (store_id, name, price) values (v_store, 'TESTE CHOPP ' || gen_random_uuid(), 10) returning id into v_product;
  insert into inventory_items (store_id, name, unit, quantity)
    values (v_store, 'TESTE BARRIL ' || gen_random_uuid(), 'L', 30) returning id into v_item;
  -- 30 L rendem 90 canecas: cada caneca gasta 1/3 L, então 3 canecas = 1 L.
  insert into inventory_product_usage (inventory_item_id, product_id, base_quantity, sales_count) values (v_item, v_product, 30, 90);

  -- 1) Lança 3 canecas numa comanda aberta.
  insert into tabs (store_id, identifier) values (v_store, 'TESTE') returning id into v_tab;
  insert into tab_items (tab_id, product_id, product_name, quantity, unit_price)
    values (v_tab, v_product, 'TESTE CHOPP', 3, 10) returning id into v_tab_item;
  select quantity into v_qty from inventory_items where id = v_item;
  if v_qty <> 29 then raise exception 'FALHOU 1 (lançar 3 canecas): esperado 29 L, ficou %', v_qty; end if;
  v_log := v_log || '1) lançou 3 → 29 L; ';

  -- 2) Muda a quantidade do item para 6.
  update tab_items set quantity = 6 where id = v_tab_item;
  select quantity into v_qty from inventory_items where id = v_item;
  if v_qty <> 28 then raise exception 'FALHOU 2 (mudar para 6): esperado 28 L, ficou %', v_qty; end if;
  v_log := v_log || '2) mudou para 6 → 28 L; ';

  -- 3) Cancela o item: devolve as 6.
  update tab_items set status = 'cancelled' where id = v_tab_item;
  select quantity into v_qty from inventory_items where id = v_item;
  if v_qty <> 30 then raise exception 'FALHOU 3 (cancelar item): esperado 30 L, ficou %', v_qty; end if;
  v_log := v_log || '3) cancelou item → 30 L; ';

  -- 4) Lança 9 e cancela a comanda inteira (o PDV apaga a comanda aberta).
  insert into tab_items (tab_id, product_id, product_name, quantity, unit_price, status)
    values (v_tab, v_product, 'TESTE CHOPP', 9, 10, 'served');
  select quantity into v_qty from inventory_items where id = v_item;
  if v_qty <> 27 then raise exception 'FALHOU 4a (lançar 9): esperado 27 L, ficou %', v_qty; end if;
  delete from tabs where id = v_tab;
  select quantity into v_qty from inventory_items where id = v_item;
  if v_qty <> 30 then raise exception 'FALHOU 4b (cancelar comanda): esperado 30 L, ficou %', v_qty; end if;
  v_log := v_log || '4) lançou 9 e cancelou a comanda → 30 L; ';

  -- 5) Comanda fechada: a venda fica, mesmo que depois o item seja marcado como cancelado.
  insert into tabs (store_id, identifier) values (v_store, 'TESTE 2') returning id into v_tab;
  insert into tab_items (tab_id, product_id, product_name, quantity, unit_price)
    values (v_tab, v_product, 'TESTE CHOPP', 3, 10) returning id into v_tab_item;
  update tabs set status = 'closed', closed_at = now() where id = v_tab;
  update tab_items set status = 'cancelled' where id = v_tab_item;
  delete from tabs where id = v_tab;
  select quantity into v_qty from inventory_items where id = v_item;
  if v_qty <> 29 then raise exception 'FALHOU 5 (comanda fechada): esperado 29 L, ficou %', v_qty; end if;
  v_log := v_log || '5) comanda fechada mantém a baixa → 29 L; ';

  -- 6) Pedido do cardápio online: baixa ao criar e devolve ao cancelar.
  insert into orders (store_id, guest_id, payment_method, order_code)
    values (v_store, gen_random_uuid(), 'pix', 'TESTE') returning id into v_order;
  insert into order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
    values (v_order, v_product, 'TESTE CHOPP', 6, 10, 60);
  select quantity into v_qty from inventory_items where id = v_item;
  if v_qty <> 27 then raise exception 'FALHOU 6a (pedido online): esperado 27 L, ficou %', v_qty; end if;
  update orders set status = 'cancelled' where id = v_order;
  select quantity into v_qty from inventory_items where id = v_item;
  if v_qty <> 29 then raise exception 'FALHOU 6b (cancelar pedido): esperado 29 L, ficou %', v_qty; end if;
  v_log := v_log || '6) pedido de 6 e cancelamento → 29 L';

  raise exception 'OK: %', v_log;
end $$;
