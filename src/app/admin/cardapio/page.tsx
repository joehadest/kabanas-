import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/data/get-store';
import { CardapioManager } from '@/components/admin/CardapioManager';
import { PageContainer } from '@/components/ui/page-layout';
import type { Category, Product } from '@/lib/types/database';

export const revalidate = 0;

export default async function AdminCardapioPage() {
  const store = await getActiveStore();
  if (!store) return <p className="p-6 text-sm text-neutral-500">Loja não configurada.</p>;

  const supabase = await createClient();

  const [{ data: categories }, { data: products }, { data: storeRow }] = await Promise.all([
    supabase.from('categories').select('*').eq('store_id', store.id).order('sort_order').returns<Category[]>(),
    supabase
      .from('products')
      .select('*, option_groups:product_option_groups(*, options:product_options(*))')
      .eq('store_id', store.id)
      .order('sort_order')
      .returns<Product[]>(),
    supabase.from('store_settings').select('default_tax_rate').eq('id', store.id).single(),
  ]);

  return (
    <PageContainer>
      <CardapioManager
        storeId={store.id}
        defaultTaxRate={Number(storeRow?.default_tax_rate ?? 0)}
        initialCategories={categories ?? []}
        initialProducts={products ?? []}
      />
    </PageContainer>
  );
}
