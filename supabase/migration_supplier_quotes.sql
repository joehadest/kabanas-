-- Cotação de fornecedores: planilha de preços por produto x fornecedor, com histórico.

create table if not exists purchase_suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references store_settings(id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  unique (store_id, name)
);
create index if not exists idx_purchase_suppliers_store on purchase_suppliers(store_id);

create table if not exists purchase_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references store_settings(id) on delete cascade,
  name text not null,
  unit text not null default 'un' check (unit in ('un', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'dz', 'fardo')),
  created_at timestamptz not null default now(),
  unique (store_id, name)
);
create index if not exists idx_purchase_items_store on purchase_items(store_id);

-- Cada preço informado vira uma linha nova; a planilha mostra o mais recente e o histórico mostra a variação.
create table if not exists purchase_quotes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references purchase_items(id) on delete cascade,
  supplier_id uuid not null references purchase_suppliers(id) on delete cascade,
  price numeric(10, 2) not null check (price >= 0),
  created_by uuid references profiles(id) on delete set null,
  quoted_at timestamptz not null default now()
);
create index if not exists idx_purchase_quotes_item on purchase_quotes(item_id, supplier_id, quoted_at desc);

alter table purchase_suppliers enable row level security;
alter table purchase_items enable row level security;
alter table purchase_quotes enable row level security;
drop policy if exists "purchase_suppliers_staff_all" on purchase_suppliers;
create policy "purchase_suppliers_staff_all" on purchase_suppliers for all using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));
drop policy if exists "purchase_items_staff_all" on purchase_items;
create policy "purchase_items_staff_all" on purchase_items for all using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));
drop policy if exists "purchase_quotes_staff_all" on purchase_quotes;
create policy "purchase_quotes_staff_all" on purchase_quotes for all using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));
