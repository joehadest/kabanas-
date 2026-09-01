import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/data/get-store';
import { PaymentSettings } from '@/components/admin/PaymentSettings';

export const revalidate = 0;

function currentMonthKey() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

export default async function ConfiguracoesPage() {
  const store = await getActiveStore();

  if (!store) {
    return <p className="p-6 text-sm text-neutral-500">Loja não configurada.</p>;
  }

  const supabase = await createClient();
  const month = currentMonthKey();

  const [{ data: storeRow }, { data: payments }, { data: goals }] = await Promise.all([
    supabase
      .from('store_settings')
      .select('tax_regime,default_tax_rate,default_service_rate,default_cover_charge')
      .eq('id', store.id)
      .single(),
    supabase
      .from('payment_methods')
      .select('id,name,fee_rate,settlement_days,is_active')
      .eq('store_id', store.id)
      .order('fee_rate'),
    supabase
      .from('financial_goals')
      .select('goal_type,amount')
      .eq('store_id', store.id)
      .eq('month', month),
  ]);

  const revenueGoal = goals?.find((goal) => goal.goal_type === 'revenue')?.amount ?? 0;
  const profitGoal = goals?.find((goal) => goal.goal_type === 'profit')?.amount ?? 0;

  return (
    <PaymentSettings
      storeId={store.id}
      taxRegime={storeRow?.tax_regime ?? 'MEI'}
      defaultTaxRate={Number(storeRow?.default_tax_rate ?? 0)}
      defaultServiceRate={Number(storeRow?.default_service_rate ?? 10)}
      defaultCoverCharge={Number(storeRow?.default_cover_charge ?? 0)}
      revenueGoal={Number(revenueGoal)}
      profitGoal={Number(profitGoal)}
      initialPayments={payments ?? []}
    />
  );
}
