import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/data/get-store';
import { fetchAllRows } from '@/lib/data/fetch-all-rows';
import { ReportsAndSimulator } from '@/components/admin/ReportsAndSimulator';

export const revalidate = 0;

export default async function RelatoriosPage() {
  const store = await getActiveStore();
  if (!store) return <p className="p-6">Empresa não configurada.</p>;

  const supabase = await createClient();
  const [sales, expenses, { data: payments }, { data: storeRow }] = await Promise.all([
    fetchAllRows((from, to) => supabase
      .from('sales')
      .select('id,total_amount,total_cost,payment_fee,tax_amount,net_profit,occurred_at', { count: 'exact' })
      .eq('store_id', store.id)
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)),
    fetchAllRows((from, to) => supabase
      .from('expenses')
      .select('description,amount,paid_at,due_date,expense_categories(name)', { count: 'exact' })
      .eq('store_id', store.id)
      .order('due_date', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)),
    supabase
      .from('payment_methods')
      .select('name,fee_rate')
      .eq('store_id', store.id)
      .eq('is_active', true)
      .order('name'),
    supabase.from('store_settings').select('name,default_tax_rate').eq('id', store.id).single(),
  ]);

  return (
    <ReportsAndSimulator
      sales={sales}
      expenses={expenses}
      payments={payments ?? []}
      defaultTaxRate={Number(storeRow?.default_tax_rate ?? 0)}
      storeName={storeRow?.name ?? store.name}
    />
  );
}
