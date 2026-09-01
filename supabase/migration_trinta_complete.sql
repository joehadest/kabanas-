-- Gestão financeira completa. Execute após schema.sql e migration_business_management.sql.

alter table store_settings add column if not exists document text;
alter table store_settings add column if not exists tax_regime text not null default 'MEI';
alter table store_settings add column if not exists default_tax_rate numeric(5, 2) not null default 0;

alter table products add column if not exists sku text;
alter table products add column if not exists cost_price numeric(10, 2) not null default 0;
alter table products add column if not exists packaging_cost numeric(10, 2) not null default 0;
alter table products add column if not exists other_variable_cost numeric(10, 2) not null default 0;
alter table products add column if not exists tax_rate numeric(5, 2) not null default 0;

create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references store_settings(id) on delete cascade,
  name text not null,
  fee_rate numeric(5, 2) not null default 0 check (fee_rate >= 0),
  settlement_days integer not null default 0 check (settlement_days >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (store_id, name)
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references store_settings(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  payment_method_id uuid references payment_methods(id) on delete set null,
  total_amount numeric(10, 2) not null default 0,
  total_cost numeric(10, 2) not null default 0,
  payment_fee numeric(10, 2) not null default 0,
  tax_amount numeric(10, 2) not null default 0,
  net_profit numeric(10, 2) not null default 0,
  installments integer not null default 1 check (installments > 0),
  occurred_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_sales_store_date on sales(store_id, occurred_at desc);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null,
  unit_cost numeric(10, 2) not null default 0,
  payment_fee numeric(10, 2) not null default 0,
  tax_amount numeric(10, 2) not null default 0,
  net_profit numeric(10, 2) not null default 0
);

create table if not exists receivables (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  due_date date not null,
  received_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_receivables_due on receivables(due_date) where received_at is null;

create table if not exists expense_categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references store_settings(id) on delete cascade,
  name text not null,
  color text not null default '#0f766e',
  unique (store_id, name)
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references store_settings(id) on delete cascade,
  category_id uuid references expense_categories(id) on delete set null,
  description text not null,
  amount numeric(10, 2) not null check (amount > 0),
  expense_type text not null default 'variable' check (expense_type in ('fixed', 'variable')),
  recurrence text not null default 'once' check (recurrence in ('once', 'weekly', 'monthly')),
  due_date date not null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_expenses_store_due on expenses(store_id, due_date);

create table if not exists financial_goals (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references store_settings(id) on delete cascade,
  goal_type text not null check (goal_type in ('revenue', 'profit')),
  amount numeric(10, 2) not null check (amount > 0),
  month date not null,
  created_at timestamptz not null default now(),
  unique (store_id, goal_type, month)
);

alter table payment_methods enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table receivables enable row level security;
alter table expense_categories enable row level security;
alter table expenses enable row level security;
alter table financial_goals enable row level security;

create policy "payment_methods_staff_all" on payment_methods for all using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));
create policy "sales_staff_all" on sales for all using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));
create policy "sale_items_staff_all" on sale_items for all using (exists (select 1 from sales where sales.id = sale_id and auth_role() in ('admin', 'restaurant'))) with check (exists (select 1 from sales where sales.id = sale_id and auth_role() in ('admin', 'restaurant')));
create policy "receivables_staff_all" on receivables for all using (exists (select 1 from sales where sales.id = sale_id and auth_role() in ('admin', 'restaurant'))) with check (exists (select 1 from sales where sales.id = sale_id and auth_role() in ('admin', 'restaurant')));
create policy "expense_categories_staff_all" on expense_categories for all using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));
create policy "expenses_staff_all" on expenses for all using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));
create policy "financial_goals_staff_all" on financial_goals for all using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));