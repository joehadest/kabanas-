-- Controle de caixa. Execute após as migrações financeiras e do PDV.

alter table sales add column if not exists cash_session_id uuid;

create table if not exists cash_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references store_settings(id) on delete cascade,
  operator_id uuid not null references profiles(id) on delete restrict,
  terminal_name text not null default 'Caixa principal',
  opening_balance numeric(10, 2) not null default 0 check (opening_balance >= 0),
  expected_cash numeric(10, 2),
  counted_cash numeric(10, 2),
  difference numeric(10, 2),
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references profiles(id) on delete set null,
  closing_note text
);
create unique index if not exists idx_one_open_cash_per_operator_terminal on cash_sessions(store_id, operator_id, terminal_name) where status = 'open';
create index if not exists idx_cash_sessions_store_date on cash_sessions(store_id, opened_at desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sales_cash_session_id_fkey') then
    alter table sales add constraint sales_cash_session_id_fkey foreign key (cash_session_id) references cash_sessions(id) on delete set null;
  end if;
end;
$$;
alter table tab_payments add column if not exists cash_session_id uuid references cash_sessions(id) on delete set null;

create table if not exists cash_movements (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid not null references cash_sessions(id) on delete cascade,
  movement_type text not null check (movement_type in ('cash_in', 'cash_out', 'refund')),
  amount numeric(10, 2) not null check (amount > 0),
  reason text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_cash_movements_session on cash_movements(cash_session_id, created_at desc);

create table if not exists cash_audit_log (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid not null references cash_sessions(id) on delete cascade,
  action text not null,
  actor_id uuid references profiles(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function require_open_cash_session()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare active_session uuid;
begin
  if new.cash_session_id is null then
    select id into active_session from cash_sessions
    where store_id = new.store_id and operator_id = auth.uid() and status = 'open'
    order by opened_at desc limit 1;
    if active_session is null then
      raise exception 'Abra o caixa antes de registrar uma venda';
    end if;
    new.cash_session_id := active_session;
  end if;
  return new;
end;
$$;

create or replace function assign_tab_payment_cash_session()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare tab_store_id uuid;
begin
  select store_id into tab_store_id from tabs where id = new.tab_id;
  select id into new.cash_session_id from cash_sessions
  where store_id = tab_store_id and operator_id = auth.uid() and status = 'open'
  order by opened_at desc limit 1;
  if new.cash_session_id is null then raise exception 'Abra o caixa antes de registrar um pagamento'; end if;
  return new;
end;
$$;

drop trigger if exists trg_tab_payments_require_open_cash_session on tab_payments;
create trigger trg_tab_payments_require_open_cash_session
  before insert on tab_payments for each row execute function assign_tab_payment_cash_session();

drop trigger if exists trg_sales_require_open_cash_session on sales;
create trigger trg_sales_require_open_cash_session
  before insert on sales for each row execute function require_open_cash_session();

create or replace function close_cash_session(session_to_close uuid, physical_cash numeric, note text default null)
returns table(expected_cash numeric, difference numeric)
language plpgsql security definer set search_path = public
as $$
declare session_row cash_sessions%rowtype;
declare cash_sales numeric;
declare cash_in numeric;
declare cash_out numeric;
begin
  select * into session_row from cash_sessions where id = session_to_close for update;
  if not found or session_row.status <> 'open' then raise exception 'Caixa inválido ou já fechado'; end if;
  if session_row.operator_id <> auth.uid() and auth_role() <> 'admin' then raise exception 'Você não pode fechar o caixa de outro operador'; end if;
  select coalesce(sum(s.total_amount), 0) into cash_sales from sales s left join payment_methods pm on pm.id = s.payment_method_id where s.cash_session_id = session_to_close and lower(coalesce(pm.name, '')) like '%dinheiro%';
  select cash_sales + coalesce(sum(tp.amount), 0) into cash_sales from tab_payments tp join payment_methods pm on pm.id = tp.payment_method_id where tp.cash_session_id = session_to_close and lower(pm.name) like '%dinheiro%';
  select coalesce(sum(amount) filter (where movement_type = 'cash_in'), 0), coalesce(sum(amount) filter (where movement_type in ('cash_out', 'refund')), 0) into cash_in, cash_out from cash_movements where cash_session_id = session_to_close;
  expected_cash := session_row.opening_balance + cash_sales + cash_in - cash_out;
  difference := physical_cash - expected_cash;
  update cash_sessions set status = 'closed', expected_cash = close_cash_session.expected_cash, counted_cash = physical_cash, difference = close_cash_session.difference, closed_at = now(), closed_by = auth.uid(), closing_note = note where id = session_to_close;
  insert into cash_audit_log (cash_session_id, action, actor_id, details) values (session_to_close, 'closed', auth.uid(), jsonb_build_object('expected_cash', expected_cash, 'counted_cash', physical_cash, 'difference', difference));
  return next;
end;
$$;

alter table cash_sessions enable row level security;
alter table cash_movements enable row level security;
alter table cash_audit_log enable row level security;
do $$ declare table_name text; begin
  foreach table_name in array array['cash_sessions','cash_movements','cash_audit_log'] loop
    execute format('drop policy if exists "cash_staff_all" on %I', table_name);
    execute format('create policy "cash_staff_all" on %I for all using (auth_role() in (''admin'', ''restaurant'')) with check (auth_role() in (''admin'', ''restaurant''))', table_name);
  end loop;
end $$;