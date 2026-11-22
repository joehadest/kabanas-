-- Baixa automática do inventário nas vendas.
--
-- Cada item do inventário pode ser ligado a produtos do cardápio com a regra
-- "base_quantity da unidade do item rende sales_count vendas" (ex.: 30 L de
-- barril rendem 90 canecas de CHOPP HEINEKEN). Ao vender o produto, o item
-- perde base_quantity / sales_count por unidade vendida; ao cancelar, volta.
--
-- Onde a venda acontece:
--   * comanda/mesa (tab_items): baixa quando o item é lançado, porque a comanda
--     de bar fica aberta por horas; devolve se o item for cancelado ou a
--     comanda for cancelada enquanto aberta. Comanda fechada não devolve nada
--     (o PDV marca itens presos da cozinha como cancelados ao excluir a mesa).
--   * pedido do cardápio online (order_items): baixa ao criar o pedido e
--     devolve se o pedido for cancelado.
-- Fechar a comanda (close_tab_to_sale -> sale_items) não baixa de novo.

create table if not exists inventory_product_usage (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  base_quantity numeric(12, 3) not null default 1 check (base_quantity > 0),
  sales_count numeric(12, 3) not null default 1 check (sales_count > 0),
  created_at timestamptz not null default now(),
  unique (inventory_item_id, product_id)
);
create index if not exists idx_inventory_product_usage_product on inventory_product_usage(product_id);

alter table inventory_product_usage enable row level security;
drop policy if exists "inventory_product_usage_staff_all" on inventory_product_usage;
create policy "inventory_product_usage_staff_all" on inventory_product_usage for all
  using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));

-- p_quantity > 0 baixa (venda); p_quantity < 0 devolve (cancelamento).
create or replace function apply_product_sale_to_inventory(p_product_id uuid, p_quantity numeric, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_product_id is null or p_quantity is null or p_quantity = 0 then
    return;
  end if;
  insert into inventory_movements (inventory_item_id, movement_type, quantity_change, reason)
  select usage.inventory_item_id,
         case when p_quantity > 0 then 'exit' else 'adjustment' end,
         -round(p_quantity * usage.base_quantity / usage.sales_count, 3),
         p_reason
  from inventory_product_usage usage
  join inventory_items item on item.id = usage.inventory_item_id and item.is_active
  where usage.product_id = p_product_id
    and round(p_quantity * usage.base_quantity / usage.sales_count, 3) <> 0;
end;
$$;

create or replace function sync_tab_item_inventory()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  tab_is_open boolean;
begin
  select status <> 'closed' into tab_is_open
  from tabs
  where id = case when tg_op = 'DELETE' then old.tab_id else new.tab_id end;

  -- Comanda fechada (ou já apagada, no cancelamento da comanda inteira): nada muda.
  if not coalesce(tab_is_open, false) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'cancelled' then
      perform apply_product_sale_to_inventory(new.product_id, new.quantity, 'Venda: ' || new.quantity || 'x ' || new.product_name);
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status <> 'cancelled' then
      perform apply_product_sale_to_inventory(old.product_id, -old.quantity, 'Item removido: ' || old.quantity || 'x ' || old.product_name);
    end if;
    return old;
  end if;

  -- UPDATE: só interessa cancelamento, quantidade ou troca de produto.
  if old.status <> 'cancelled' and new.status <> 'cancelled' then
    if old.product_id is not distinct from new.product_id then
      perform apply_product_sale_to_inventory(new.product_id, new.quantity - old.quantity, 'Quantidade alterada: ' || new.product_name);
    else
      perform apply_product_sale_to_inventory(old.product_id, -old.quantity, 'Item trocado: ' || old.product_name);
      perform apply_product_sale_to_inventory(new.product_id, new.quantity, 'Venda: ' || new.quantity || 'x ' || new.product_name);
    end if;
  elsif old.status <> 'cancelled' and new.status = 'cancelled' then
    perform apply_product_sale_to_inventory(old.product_id, -old.quantity, 'Cancelado: ' || old.quantity || 'x ' || old.product_name);
  elsif old.status = 'cancelled' and new.status <> 'cancelled' then
    perform apply_product_sale_to_inventory(new.product_id, new.quantity, 'Venda: ' || new.quantity || 'x ' || new.product_name);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tab_items_inventory on tab_items;
create trigger trg_tab_items_inventory
  after insert or update of status, quantity, product_id or delete on tab_items
  for each row execute function sync_tab_item_inventory();

-- Cancelar comanda aberta apaga a tab e, em cascata, os itens: devolve antes de apagar.
create or replace function return_open_tab_inventory()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.status <> 'closed' then
    perform apply_product_sale_to_inventory(product_id, -quantity, 'Comanda cancelada: ' || quantity || 'x ' || product_name)
    from tab_items
    where tab_id = old.id and status <> 'cancelled';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_tabs_return_inventory on tabs;
create trigger trg_tabs_return_inventory
  before delete on tabs
  for each row execute function return_open_tab_inventory();

create or replace function sync_order_item_inventory()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  order_row orders%rowtype;
begin
  select * into order_row from orders where id = new.order_id;
  if found and order_row.status <> 'cancelled' then
    perform apply_product_sale_to_inventory(new.product_id, new.quantity, 'Pedido ' || order_row.order_code || ': ' || new.quantity || 'x ' || new.product_name);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_items_inventory on order_items;
create trigger trg_order_items_inventory
  after insert on order_items
  for each row execute function sync_order_item_inventory();

create or replace function sync_order_status_inventory()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.status <> 'cancelled' and new.status = 'cancelled' then
    perform apply_product_sale_to_inventory(product_id, -quantity, 'Pedido ' || new.order_code || ' cancelado: ' || quantity || 'x ' || product_name)
    from order_items
    where order_id = new.id;
  elsif old.status = 'cancelled' and new.status <> 'cancelled' then
    perform apply_product_sale_to_inventory(product_id, quantity, 'Pedido ' || new.order_code || ' reaberto: ' || quantity || 'x ' || product_name)
    from order_items
    where order_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_inventory on orders;
create trigger trg_orders_inventory
  after update of status on orders
  for each row execute function sync_order_status_inventory();
