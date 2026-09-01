-- Inventário geral: produtos para venda e insumos como açúcar, gelo e embalagens.

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references store_settings(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name text not null,
  sku text,
  unit text not null default 'un' check (unit in ('un', 'kg', 'g', 'L', 'ml', 'cx', 'pct')),
  quantity numeric(12, 3) not null default 0 check (quantity >= 0),
  minimum_quantity numeric(12, 3) not null default 0 check (minimum_quantity >= 0),
  average_cost numeric(10, 2) not null default 0 check (average_cost >= 0),
  location text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, name)
);
create index if not exists idx_inventory_items_store on inventory_items(store_id, is_active);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('entry', 'exit', 'adjustment', 'loss')),
  quantity_change numeric(12, 3) not null check (quantity_change <> 0),
  unit_cost numeric(10, 2),
  reason text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_inventory_movements_item on inventory_movements(inventory_item_id, created_at desc);

create or replace function apply_inventory_movement()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update inventory_items
  set quantity = greatest(0, quantity + new.quantity_change),
      average_cost = case when new.movement_type = 'entry' and new.unit_cost is not null and new.unit_cost >= 0 then new.unit_cost else average_cost end,
      updated_at = now()
  where id = new.inventory_item_id;
  return new;
end;
$$;

drop trigger if exists trg_apply_inventory_movement on inventory_movements;
create trigger trg_apply_inventory_movement after insert on inventory_movements for each row execute function apply_inventory_movement();

alter table inventory_items enable row level security;
alter table inventory_movements enable row level security;
drop policy if exists "inventory_items_staff_all" on inventory_items;
create policy "inventory_items_staff_all" on inventory_items for all using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));
drop policy if exists "inventory_movements_staff_all" on inventory_movements;
create policy "inventory_movements_staff_all" on inventory_movements for all using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));