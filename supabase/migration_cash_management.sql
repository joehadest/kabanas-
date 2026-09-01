-- Correção e gerenciamento auditável de caixas. Execute após migration_cash_details.sql.

alter table cash_sessions add column if not exists is_voided boolean not null default false;
alter table cash_sessions add column if not exists voided_at timestamptz;
alter table cash_sessions add column if not exists void_reason text;

create or replace function update_cash_session(
  session_id uuid,
  new_terminal_name text,
  new_opening_balance numeric,
  new_financial_account_id uuid,
  correction_reason text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare current_session cash_sessions%rowtype;
begin
  select * into current_session from cash_sessions where id = session_id for update;
  if not found or current_session.is_voided then raise exception 'Caixa não encontrado'; end if;
  if current_session.operator_id <> auth.uid() and auth_role() <> 'admin' then raise exception 'Você não pode alterar o caixa de outro operador'; end if;
  if trim(coalesce(correction_reason, '')) = '' then raise exception 'Informe o motivo da correção'; end if;
  if new_opening_balance < 0 then raise exception 'O fundo de troco não pode ser negativo'; end if;
  update cash_sessions
  set terminal_name = trim(new_terminal_name),
      opening_balance = new_opening_balance,
      financial_account_id = new_financial_account_id,
      expected_cash = case when status = 'closed' and expected_cash is not null then expected_cash - current_session.opening_balance + new_opening_balance else expected_cash end,
      difference = case when status = 'closed' and counted_cash is not null and expected_cash is not null then counted_cash - (expected_cash - current_session.opening_balance + new_opening_balance) else difference end
  where id = session_id;
  insert into cash_audit_log (cash_session_id, action, actor_id, details)
  values (session_id, 'edited', auth.uid(), jsonb_build_object('reason', correction_reason, 'before', jsonb_build_object('terminal', current_session.terminal_name, 'opening_balance', current_session.opening_balance, 'account_id', current_session.financial_account_id), 'after', jsonb_build_object('terminal', trim(new_terminal_name), 'opening_balance', new_opening_balance, 'account_id', new_financial_account_id)));
end;
$$;

create or replace function void_cash_session(session_id uuid, correction_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare current_session cash_sessions%rowtype;
begin
  select * into current_session from cash_sessions where id = session_id for update;
  if not found or current_session.is_voided then raise exception 'Caixa não encontrado'; end if;
  if current_session.operator_id <> auth.uid() and auth_role() <> 'admin' then raise exception 'Você não pode remover o caixa de outro operador'; end if;
  if trim(coalesce(correction_reason, '')) = '' then raise exception 'Informe o motivo da remoção'; end if;
  if exists (select 1 from sales where cash_session_id = session_id) or exists (select 1 from tab_payments where cash_session_id = session_id) or exists (select 1 from cash_movements where cash_session_id = session_id) then
    raise exception 'Este caixa possui vendas ou movimentações e não pode ser removido. Faça uma correção auditada.';
  end if;
  update cash_sessions set is_voided = true, voided_at = now(), void_reason = correction_reason, status = 'closed', closed_at = now(), closed_by = auth.uid() where id = session_id;
  insert into cash_audit_log (cash_session_id, action, actor_id, details) values (session_id, 'voided', auth.uid(), jsonb_build_object('reason', correction_reason));
end;
$$;