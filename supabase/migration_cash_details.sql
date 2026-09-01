-- Detalhes operacionais do caixa: contas financeiras, moedas e cédulas.
-- Execute após migration_cash_control.sql. Não remove dados existentes.

alter table store_settings add column if not exists default_currency char(3) not null default 'BRL' check (default_currency = 'BRL');

create table if not exists financial_accounts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references store_settings(id) on delete cascade,
  name text not null,
  account_type text not null check (account_type in ('cash', 'bank', 'digital_wallet', 'card_settlement')),
  currency_code char(3) not null default 'BRL' check (currency_code = 'BRL'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (store_id, name)
);

alter table cash_sessions add column if not exists financial_account_id uuid references financial_accounts(id) on delete set null;
alter table cash_sessions add column if not exists currency_code char(3) not null default 'BRL' check (currency_code = 'BRL');
alter table cash_sessions add column if not exists cash_count jsonb not null default '{}'::jsonb;

create index if not exists idx_financial_accounts_store on financial_accounts(store_id, is_active);

create or replace function close_cash_session_detailed(
  session_to_close uuid,
  physical_cash numeric,
  note text default null,
  note_counts jsonb default '{}'::jsonb
)
returns table(expected_cash numeric, difference numeric)
language plpgsql security definer set search_path = public
as $$
begin
  return query select * from close_cash_session(session_to_close, physical_cash, note);
  update cash_sessions set cash_count = coalesce(note_counts, '{}'::jsonb) where id = session_to_close;
end;
$$;

alter table financial_accounts enable row level security;
drop policy if exists "financial_accounts_staff_all" on financial_accounts;
create policy "financial_accounts_staff_all" on financial_accounts for all
  using (auth_role() in ('admin', 'restaurant')) with check (auth_role() in ('admin', 'restaurant'));