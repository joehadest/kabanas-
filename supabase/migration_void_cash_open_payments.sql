-- Pagamentos de comandas já fechadas não bloqueiam void do caixa (a venda já foi registrada).
-- Execute após migration_cash_management.sql.

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
  if exists (select 1 from sales where cash_session_id = session_id)
     or exists (
       select 1
       from tab_payments tp
       join tabs t on t.id = tp.tab_id
       where tp.cash_session_id = session_id
         and t.status not in ('closed', 'cancelled')
     )
     or exists (select 1 from cash_movements where cash_session_id = session_id) then
    raise exception 'Este caixa possui vendas ou movimentações e não pode ser removido. Faça uma correção auditada.';
  end if;
  update cash_sessions set is_voided = true, voided_at = now(), void_reason = correction_reason, status = 'closed', closed_at = now(), closed_by = auth.uid() where id = session_id;
  insert into cash_audit_log (cash_session_id, action, actor_id, details) values (session_id, 'voided', auth.uid(), jsonb_build_object('reason', correction_reason));
end;
$$;
