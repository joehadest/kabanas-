import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/data/get-store';
import { FinancialDashboard } from '@/components/admin/FinancialDashboard';

export const revalidate = 0;

function currentMonthKey() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

export default async function AdminDashboardPage() {
  const store = await getActiveStore();
  if (!store) return <p className="p-6 text-sm text-neutral-500">Loja não configurada.</p>;

  const supabase = await createClient();
  const month = currentMonthKey();

  const [{ data: sales, error }, { data: expenses }, { data: receivables }, { data: products }, { data: goals }] =
    await Promise.all([
      supabase
        .from('sales')
        .select('total_amount,net_profit,occurred_at')
        .eq('store_id', store.id)
        .order('occurred_at', { ascending: false }),
      supabase.from('expenses').select('amount,paid_at,due_date').eq('store_id', store.id),
      supabase.from('receivables').select('amount,due_date,received_at').eq('store_id', store.id),
      supabase
        .from('products')
        .select('id,name,stock_quantity,reorder_level')
        .eq('store_id', store.id)
        .order('stock_quantity'),
      supabase
        .from('financial_goals')
        .select('goal_type,amount')
        .eq('store_id', store.id)
        .eq('month', month),
    ]);

  if (error) {
    return (
      <p className="p-6 text-sm text-neutral-500">
        Execute as migrações em <code>supabase/</code> no SQL Editor do Supabase para ativar a gestão financeira.
      </p>
    );
  }

  return (
    <FinancialDashboard
      sales={sales ?? []}
      expenses={expenses ?? []}
      receivables={receivables ?? []}
      lowStock={(products ?? []).filter((product) => product.stock_quantity <= product.reorder_level)}
      goals={goals ?? []}
    />
  );
}
