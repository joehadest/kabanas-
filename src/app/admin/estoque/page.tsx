import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/data/get-store';
import { StockManager } from '@/components/admin/StockManager';
import { PageContainer, PageHeader } from '@/components/ui/page-layout';
import type { Category, Product } from '@/lib/types/database';

export const revalidate = 0;

export default async function EstoquePage() {
  const store = await getActiveStore();
  if (!store) return <p className="p-6 text-sm text-neutral-500">Loja não configurada.</p>;

  const supabase = await createClient();

  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from('categories').select('*').eq('store_id', store.id).order('sort_order').returns<Category[]>(),
    supabase.from('products').select('*').eq('store_id', store.id).order('name').returns<Product[]>(),
  ]);

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        eyebrow="Disponibilidade"
        title="Estoque"
        description="Marque rapidamente o que está em falta — some do cardápio na hora."
      />
      <div className="mt-8">
        <StockManager categories={categories ?? []} products={products ?? []} />
      </div>
    </PageContainer>
  );
}
