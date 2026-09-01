-- PDV, comandas, KDS e fila de impressão. Execute após as migrações financeiras.

create table if not exists dining_areas (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references store_settings(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  unique (store_id, name)
);

create table if not exists dining_tables (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references store_settings(id) on delete cascade,
  area_id uuid references dining_areas(id) on delete set null,
  name text not null,
  seats integer not null default 4 check (seats > 0),
  position_x integer not null default 0,
  position_y integer not null default 0,
  created_at timestamptz not null default now(),
  unique (store_id, name)
);

create table if not exists tabs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references store_settings(id) on delete cascade,
  table_id uuid references dining_tables(id) on delete set null,
  identifier text,
  customer_name text,
  waiter_name text,
  guest_count integer not null default 1 check (guest_count > 0),
  status text not null default 'open' check (status in ('open', 'payment', 'attention', 'closed', 'cancelled')),
  service_rate numeric(5, 2) not null default 0 check (service_rate >= 0),
  cover_charge numeric(10, 2) not null default 0 check (cover_charge >= 0),
  discount_amount numeric(10, 2) not null default 0 check (discount_amount >= 0),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index if not exists idx_one_open_tab_per_table on tabs(table_id) where status in ('open', 'payment', 'attention');
create index if not exists idx_tabs_store_status on tabs(store_id, status);

create table if not exists tab_items (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references tabs(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null,
  unit_cost numeric(10, 2) not null default 0,
  tax_rate numeric(5, 2) not null default 0,
  notes text,
  station text not null default 'kitchen' check (station in ('kitchen', 'bar')),
  status text not null default 'new' check (status in ('new', 'preparing', 'ready', 'served', 'cancelled')),
  cancellation_reason text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create index if not exists idx_tab_items_status on tab_items(status, created_at);

create table if not exists tab_payments (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references tabs(id) on delete cascade,
  payment_method_id uuid references payment_methods(id) on delete set null,
  amount numeric(10, 2) not null check (amount > 0),
  installments integer not null default 1 check (installments > 0),
  created_at timestamptz not null default now()
);

create table if not exists thermal_printers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references store_settings(id) on delete cascade,
  name text not null,
  connection_type text not null check (connection_type in ('local_agent', 'web_bluetooth', 'web_usb')),
  endpoint text,
  paper_width integer not null default 80 check (paper_width in (58, 80)),
  purpose text not null check (purpose in ('cashier', 'kitchen', 'bar')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists print_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references store_settings(id) on delete cascade,
  printer_id uuid references thermal_printers(id) on delete set null,
  tab_id uuid references tabs(id) on delete set null,
  job_type text not null check (job_type in ('customer_receipt', 'kitchen_ticket', 'cash_report')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'printing', 'printed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  printed_at timestamptz
);
create index if not exists idx_print_jobs_queue on print_jobs(store_id, status, created_at);

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
  update tabs set status = 'closed', closed_at = now() where id = tab_to_close;
  return sale_id;
end;
$$;

alter table dining_areas enable row level security;
alter table dining_tables enable row level security;
alter table tabs enable row level security;
alter table tab_items enable row level security;
alter table tab_payments enable row level security;
alter table thermal_printers enable row level security;
alter table print_jobs enable row level security;

do $$ declare table_name text; begin
  foreach table_name in array array['dining_areas','dining_tables','tabs','tab_items','tab_payments','thermal_printers','print_jobs'] loop
    execute format('drop policy if exists "staff_all" on %I', table_name);
    execute format('create policy "staff_all" on %I for all using (auth_role() in (''admin'', ''restaurant'')) with check (auth_role() in (''admin'', ''restaurant''))', table_name);
  end loop;
end $$;