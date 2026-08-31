import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/data/get-store';
import { CatalogView } from '@/components/customer/CatalogView';
import { Hero } from '@/components/customer/Hero';
import type { Category, Product } from '@/lib/types/database';

export const revalidate = 0; // catálogo é dinâmico (disponibilidade muda o dia todo)

export default async function HomePage() {
  const store = await getActiveStore();

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <p className="text-sm text-neutral-500">
          Loja não configurada. Rode <code>supabase/schema.sql</code> e cadastre um registro em{' '}
          <code>store_settings</code>.
        </p>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('*')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .order('sort_order')
    .returns<Category[]>();

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*, option_groups:product_option_groups(*, options:product_options(*))')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .order('sort_order')
    .returns<Product[]>();

  const queryError = categoriesError || productsError;
  if (queryError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <p className="text-sm text-neutral-500">
          Erro ao carregar o cardápio.
          <span className="block mt-2 text-xs text-red-500">{queryError.message}</span>
        </p>
      </div>
    );
  }

  return (
    <CatalogView
      storeName={store.name}
      storeSettings={store}
      categories={categories ?? []}
      products={products ?? []}
      hero={<Hero store={store} />}
    />
  );
}
