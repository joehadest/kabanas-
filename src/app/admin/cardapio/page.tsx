import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/data/get-store';
import { CardapioManager } from '@/components/admin/CardapioManager';
import type { Category, Product } from '@/lib/types/database';

export const revalidate = 0;

export default async function AdminCardapioPage() {
  const store = await getActiveStore();
  if (!store) return <p className="p-6 text-sm text-neutral-500">Loja não configurada.</p>;

  const supabase = await createClient();

  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from('categories').select('*').eq('store_id', store.id).order('sort_order').returns<Category[]>(),
    supabase
      .from('products')
      .select('*, option_groups:product_option_groups(*, options:product_options(*))')
      .eq('store_id', store.id)
      .order('sort_order')
      .returns<Product[]>(),
  ]);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-7">
      <div className="mx-auto max-w-7xl">
        <CardapioManager storeId={store.id} initialCategories={categories ?? []} initialProducts={products ?? []} />
      </div>
    </div>
  );
}
