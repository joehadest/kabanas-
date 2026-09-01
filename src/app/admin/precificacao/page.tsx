import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/data/get-store';
import { ProductProfitManager } from '@/components/admin/ProductProfitManager';

export const revalidate = 0;

export default async function PrecificacaoPage() {
  const store = await getActiveStore();
  if (!store) return <p className="p-6 text-sm text-neutral-500">Empresa não configurada.</p>;

  const supabase = await createClient();

  const [{ data: products }, { data: categories }, { data: payments }] = await Promise.all([
    supabase
      .from('products')
      .select(
        'id,name,sku,description,image_url,price,cost_price,packaging_cost,other_variable_cost,tax_rate,stock_quantity,reorder_level,category_id,is_active,is_available'
      )
      .eq('store_id', store.id)
      .order('name'),
    supabase.from('categories').select('id,name').eq('store_id', store.id).order('name'),
    supabase.from('payment_methods').select('fee_rate').eq('store_id', store.id).eq('is_active', true).order('fee_rate').limit(1),
  ]);

  return (
    <ProductProfitManager
      storeId={store.id}
      products={products ?? []}
      categories={categories ?? []}
      paymentFeeRate={payments?.[0]?.fee_rate ?? 0}
    />
  );
}
