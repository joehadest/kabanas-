-- Teste do saldo nas movimentações (migration_inventory_movement_balance.sql).
--
-- Rode no SQL Editor do Supabase. O bloco termina com um erro proposital e o
-- Postgres desfaz tudo: nada fica gravado. Colado logo abaixo do texto da
-- migração, na mesma execução, também desfaz a própria migração (ensaio).
-- Leia o resultado na mensagem do erro: "OK: ..." ou "FALHOU N ...".

do $$
declare
  v_store uuid := (select id from store_settings order by created_at limit 1);
  v_product uuid;
  v_item uuid;
  v_tab uuid;
  v_got text;
begin
  insert into products (store_id, name, price) values (v_store, 'TESTE CHOPP ' || gen_random_uuid(), 10) returning id into v_product;
  insert into inventory_items (store_id, name, unit, quantity)
    values (v_store, 'TESTE BARRIL ' || gen_random_uuid(), 'L', 30) returning id into v_item;
  insert into inventory_product_usage (inventory_item_id, product_id, base_quantity, sales_count) values (v_item, v_product, 30, 90);

  -- 1) Vendas pela comanda: cada movimentação guarda o saldo que ficou.
  insert into tabs (store_id, identifier) values (v_store, 'TESTE') returning id into v_tab;
  insert into tab_items (tab_id, product_id, product_name, quantity, unit_price) values (v_tab, v_product, 'TESTE CHOPP', 3, 10);
  insert into tab_items (tab_id, product_id, product_name, quantity, unit_price) values (v_tab, v_product, 'TESTE CHOPP', 6, 10);
  select string_agg(trim_scale(quantity_after)::text, ',' order by created_at) into v_got from inventory_movements where inventory_item_id = v_item;
  if v_got is distinct from '29,27' then raise exception 'FALHOU 1 (duas vendas): esperado 29,27, ficou %', v_got; end if;

  -- 2) Cancelar a comanda devolve os dois itens, em ordem, até voltar a 30.
  delete from tabs where id = v_tab;
  select trim_scale(quantity_after)::text into v_got from inventory_movements where inventory_item_id = v_item order by created_at desc limit 1;
  if v_got is distinct from '30' then raise exception 'FALHOU 2 (cancelar comanda): esperado 30, ficou %', v_got; end if;
  select count(distinct created_at)::text into v_got from inventory_movements where inventory_item_id = v_item;
  if v_got is distinct from '4' then raise exception 'FALHOU 2b (ordem): esperado 4 horários diferentes, ficou %', v_got; end if;

  -- 3) Saída maior que o estoque: o saldo para em zero.
  insert into inventory_movements (inventory_item_id, movement_type, quantity_change, reason) values (v_item, 'loss', -50, 'TESTE');
  select trim_scale(quantity_after)::text into v_got from inventory_movements where inventory_item_id = v_item order by created_at desc limit 1;
  if v_got is distinct from '0' then raise exception 'FALHOU 3 (parar em zero): esperado 0, ficou %', v_got; end if;

  -- 4) Entrada continua atualizando o custo médio.
  insert into inventory_movements (inventory_item_id, movement_type, quantity_change, unit_cost, reason) values (v_item, 'entry', 50, 4.65, 'TESTE');
  select trim_scale(quantity)::text || '/' || average_cost::text into v_got from inventory_items where id = v_item;
  if v_got is distinct from '50/4.65' then raise exception 'FALHOU 4 (entrada): esperado 50/4.65, ficou %', v_got; end if;

  raise exception 'OK: saldos gravados (vendas, cancelamento, zero e entrada)';
end $$;
