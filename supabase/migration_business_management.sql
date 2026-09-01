-- Migração incremental: gestão de vendas, despesas, fiados e estoque.
-- Execute este arquivo no SQL Editor do Supabase após o schema.sql.

do $$
begin
  create type transaction_kind as enum ('sale', 'expense', 'debt_payment');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type transaction_status as enum ('paid', 'pending');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references store_settings(id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  debt_balance numeric(10, 2) not null default 0 check (debt_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customers_store on customers(store_id);
create index if not exists idx_customers_debt on customers(store_id, debt_balance desc);

create table if not exists financial_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references store_settings(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  kind transaction_kind not null,
  status transaction_status not null default 'paid',
  description text not null,
  amount numeric(10, 2) not null check (amount > 0),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_financial_transactions_store_date on financial_transactions(store_id, occurred_at desc);
create index if not exists idx_financial_transactions_customer on financial_transactions(customer_id);

alter table products add column if not exists stock_quantity integer not null default 0 check (stock_quantity >= 0);
alter table products add column if not exists reorder_level integer not null default 0 check (reorder_level >= 0);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  quantity_change integer not null check (quantity_change <> 0),
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_stock_movements_product on stock_movements(product_id, created_at desc);

create or replace function update_customer_debt_balance()
returns trigger as $$
begin
  if new.customer_id is not null then
    if new.kind = 'sale' and new.status = 'pending' then
      update customers set debt_balance = debt_balance + new.amount, updated_at = now() where id = new.customer_id;
    elsif new.kind = 'debt_payment' and new.status = 'paid' then
      update customers set debt_balance = greatest(0, debt_balance - new.amount), updated_at = now() where id = new.customer_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_financial_transaction_customer_debt on financial_transactions;
create trigger trg_financial_transaction_customer_debt
  after insert on financial_transactions
  for each row execute function update_customer_debt_balance();

drop trigger if exists trg_customers_updated_at on customers;
create trigger trg_customers_updated_at before update on customers
  for each row execute function set_updated_at();

alter table customers enable row level security;
alter table financial_transactions enable row level security;
alter table stock_movements enable row level security;

drop policy if exists "customers_staff_all" on customers;
create policy "customers_staff_all" on customers for all
  using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));
drop policy if exists "financial_transactions_staff_all" on financial_transactions;
create policy "financial_transactions_staff_all" on financial_transactions for all
  using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));
drop policy if exists "stock_movements_staff_all" on stock_movements;
create policy "stock_movements_staff_all" on stock_movements for all
  using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));