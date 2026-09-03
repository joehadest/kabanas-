-- Cardápio público (cliente escaneia um QR Code geral e escolhe a mesa).
-- Sem delivery: o pedido do cliente vira um item de comanda (tab_items) na
-- mesa escolhida, reaproveitando o PDV/KDS que já existe.
-- Execute após migration_pos_and_printing.sql e migration_restaurant_defaults.sql.

alter table dining_tables add column if not exists is_active boolean not null default true;
alter table dining_tables add column if not exists sort_order integer not null default 0;
create index if not exists idx_dining_tables_store_active on dining_tables(store_id, is_active, sort_order);

-- Cabeçalho de cada envio de pedido pelo cliente (mesa + nome + observações),
-- separado da comanda (tabs) porque uma mesa pode receber vários envios
-- diferentes antes de fechar a conta.
create table if not exists table_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references store_settings(id) on delete cascade,
  table_id uuid not null references dining_tables(id) on delete cascade,
  table_name text not null,
  tab_id uuid not null references tabs(id) on delete cascade,
  customer_name text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_table_orders_tab on table_orders(tab_id);
create index if not exists idx_table_orders_store on table_orders(store_id, created_at desc);

alter table tab_items add column if not exists table_order_id uuid references table_orders(id) on delete set null;
create index if not exists idx_tab_items_table_order on tab_items(table_order_id);

-- RPC pública chamada pelo cardápio do cliente. Roda como security definer
-- porque o cliente (anônimo) não tem — e não deve ter — permissão de escrita
-- direta em tabs/tab_items. Preço, custo e imposto são sempre recalculados a
-- partir de `products`/`product_options` aqui dentro; nunca confiamos em
-- valores vindos do navegador.
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

alter table table_orders enable row level security;
drop policy if exists "table_orders_staff_all" on table_orders;
create policy "table_orders_staff_all" on table_orders for all
  using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));
-- Leitura pública por id (mesma lógica de /pedido/[id]: o id é um UUID
-- não-enumerável, funciona como o "código" da página de acompanhamento).
drop policy if exists "table_orders_select_public" on table_orders;
create policy "table_orders_select_public" on table_orders for select using (true);

-- Leitura pública das mesas/ambientes ativos, para o dropdown do cardápio.
drop policy if exists "dining_areas_select_public" on dining_areas;
create policy "dining_areas_select_public" on dining_areas for select using (true);

drop policy if exists "dining_tables_select_public" on dining_tables;
create policy "dining_tables_select_public" on dining_tables for select using (is_active = true);

-- Leitura pública de comandas/itens em aberto, para a página de acompanhamento
-- do pedido (via realtime) — necessário porque o Realtime do Supabase avalia
-- as mesmas políticas de RLS da tabela, não dá pra restringir por RPC.
drop policy if exists "tabs_select_public_open" on tabs;
create policy "tabs_select_public_open" on tabs for select using (status in ('open', 'payment', 'attention'));

drop policy if exists "tab_items_select_public_open" on tab_items;
create policy "tab_items_select_public_open" on tab_items for select using (
  exists (select 1 from tabs t where t.id = tab_items.tab_id and t.status in ('open', 'payment', 'attention'))
);
