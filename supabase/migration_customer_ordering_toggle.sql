-- Permite desativar o envio de pedidos pelo cardápio público do cliente
-- (QR da mesa), deixando-o só para consulta/visualização dos produtos.
-- Os garçons continuam lançando pedidos normalmente pelo PDV (/admin/pdv),
-- que grava direto em tab_items e não passa pela RPC abaixo.
-- Execute após migration_customer_menu.sql.

alter table store_settings add column if not exists customer_ordering_enabled boolean not null default true;
comment on column store_settings.customer_ordering_enabled is
  'Quando false, o cardápio público (/cardapio) fica só para visualização: cliente vê os produtos, mas não monta nem envia pedido. Pedidos continuam sendo lançados pelo garçom no PDV.';

-- Reforça o bloqueio dentro da RPC (obrigatório): ela é security definer e é
-- chamada direto pelo cliente anônimo, então esconder o botão na UI não
-- basta — sem este guard, um cliente poderia chamar a RPC manualmente e
-- enviar o pedido mesmo com a opção desativada no painel.
create or replace function submit_table_order(
  p_table_id uuid,
  p_customer_name text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_store_id uuid;
  v_table_name text;
  v_tab_id uuid;
  v_order_id uuid;
  v_service_rate numeric(5,2);
  v_cover_charge numeric(10,2);
  v_item jsonb;
  v_product_id uuid;
  v_product record;
  v_quantity integer;
  v_item_notes text;
  v_options_total numeric(10,2);
  v_options_label text;
  v_option_ids uuid[];
  v_option record;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Selecione ao menos um item do cardápio.';
  end if;

  select store_id, name into v_store_id, v_table_name
  from dining_tables
  where id = p_table_id and is_active = true;

  if v_store_id is null then
    raise exception 'Mesa inválida ou indisponível.';
  end if;

  if not exists (
    select 1 from store_settings
    where id = v_store_id and coalesce(customer_ordering_enabled, true) = true
  ) then
    raise exception 'O cardápio está disponível apenas para consulta neste momento. Peça ao garçom para fazer seu pedido.';
  end if;

  select id into v_tab_id
  from tabs
  where table_id = p_table_id and status in ('open', 'payment', 'attention')
  order by opened_at desc
  limit 1
  for update;

  if v_tab_id is null then
    select coalesce(default_service_rate, 0), coalesce(default_cover_charge, 0)
      into v_service_rate, v_cover_charge
      from store_settings where id = v_store_id;

    insert into tabs (store_id, table_id, identifier, customer_name, service_rate, cover_charge, guest_count)
    values (
      v_store_id,
      p_table_id,
      v_table_name,
      nullif(trim(coalesce(p_customer_name, '')), ''),
      coalesce(v_service_rate, 0),
      coalesce(v_cover_charge, 0),
      1
    )
    returning id into v_tab_id;
  elsif nullif(trim(coalesce(p_customer_name, '')), '') is not null then
    update tabs set customer_name = trim(p_customer_name)
    where id = v_tab_id and (customer_name is null or trim(customer_name) = '');
  end if;

  insert into table_orders (store_id, table_id, table_name, tab_id, customer_name, notes)
  values (
    v_store_id,
    p_table_id,
    v_table_name,
    v_tab_id,
    nullif(trim(coalesce(p_customer_name, '')), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;

    select id, name, price,
           coalesce(cost_price, 0) + coalesce(packaging_cost, 0) + coalesce(other_variable_cost, 0) as unit_cost,
           coalesce(tax_rate, 0) as tax_rate
      into v_product
      from products
      where id = v_product_id and store_id = v_store_id and is_active = true and is_available = true;

    if not found then
      raise exception 'Um dos itens do pedido não está mais disponível.';
    end if;

    v_quantity := greatest(1, least(99, coalesce((v_item->>'quantity')::integer, 1)));
    v_item_notes := nullif(trim(coalesce(v_item->>'notes', '')), '');
    v_options_total := 0;
    v_options_label := null;
    v_option_ids := null;

    if v_item ? 'option_ids' and jsonb_typeof(v_item->'option_ids') = 'array' then
      select array_agg(elem::uuid) into v_option_ids from jsonb_array_elements_text(v_item->'option_ids') as elem;
    end if;

    if v_option_ids is not null and array_length(v_option_ids, 1) > 0 then
      for v_option in
        select po.name, po.price
        from product_options po
        join product_option_groups pog on pog.id = po.group_id
        where po.id = any(v_option_ids) and pog.product_id = v_product_id and po.is_active = true
      loop
        v_options_total := v_options_total + v_option.price;
        v_options_label := coalesce(v_options_label || ', ', '') || v_option.name;
      end loop;
    end if;

    insert into tab_items (tab_id, product_id, product_name, quantity, unit_price, unit_cost, tax_rate, notes, table_order_id)
    values (
      v_tab_id,
      v_product.id,
      v_product.name,
      v_quantity,
      v_product.price + v_options_total,
      v_product.unit_cost,
      v_product.tax_rate,
      nullif(
        trim(
          coalesce(v_options_label, '') ||
          case when v_options_label is not null and v_item_notes is not null then ' — ' else '' end ||
          coalesce(v_item_notes, '')
        ),
        ''
      ),
      v_order_id
    );
  end loop;

  return v_order_id;
end;
$$;
