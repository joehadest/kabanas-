import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/data/get-store';
import { CashRegisterNormal } from '@/components/admin/CashRegisterNormal';

export const revalidate = 0;

export default async function CaixaPage() {
  const store = await getActiveStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!store || !user) {
    return <p className="p-6">Empresa ou usuário não configurado.</p>;
  }

  const { data: sessions, error } = await supabase
    .from('cash_sessions')
    .select(
      'id,operator_id,terminal_name,opening_balance,opened_at,status,expected_cash,counted_cash,difference,cash_movements(movement_type,amount,reason,created_at),sales(id,total_amount,occurred_at,notes,payment_methods(name)),tab_payments(id,amount,created_at,payment_methods(name),tabs(identifier,status))'
    )
    .eq('store_id', store.id)
    .eq('is_voided', false)
    .order('opened_at', { ascending: false })
    .limit(30);

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm font-semibold text-red-400">Não foi possível carregar o controle de caixa.</p>
        <p className="mt-2 text-sm text-neutral-400">{error.message}</p>
        <p className="mt-2 text-xs text-neutral-500">
          Código Supabase: {error.code || 'não informado'}. Execute{' '}
          <code>supabase/migration_cash_management.sql</code> e atualize a página.
        </p>
      </div>
    );
  }

  return (
    <CashRegisterNormal
      storeId={store.id}
      operatorId={user.id}
      sessions={sessions ?? []}
    />
  );
}
