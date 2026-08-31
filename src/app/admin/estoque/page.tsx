import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/data/get-store';
import { StockManager } from '@/components/admin/StockManager';
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
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-700">Disponibilidade</p>
      <h1 className="mb-1 mt-2 font-serif text-3xl font-bold leading-none text-[#1c1d1a]">Estoque</h1>
      <p className="mb-7 text-sm text-neutral-500">Marque rapidamente o que está em falta — some do cardápio na hora.</p>
      <StockManager categories={categories ?? []} products={products ?? []} />
    </div>
  );
}
