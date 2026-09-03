import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getStoreBySlug } from '@/lib/data/get-store';
import { isStoreOpenNow } from '@/lib/utils/format';
import { CatalogView } from '@/components/customer/CatalogView';
import { DineInHero } from '@/components/customer/DineInHero';
import { DineInCart } from '@/components/customer/DineInCart';
import type { Category, Product } from '@/lib/types/database';

export const revalidate = 0;

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CardapioPage({ params }: Props) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();

  const supabase = await createClient();

  const [{ data: categories }, { data: products }, { data: tables }] = await Promise.all([
    supabase.from('categories').select('*').eq('store_id', store.id).eq('is_active', true).order('sort_order').returns<Category[]>(),
    supabase
      .from('products')
      .select('*, option_groups:product_option_groups(*, options:product_options(*))')
      .eq('store_id', store.id)
      .eq('is_active', true)
      .eq('is_available', true)
      .order('sort_order')
      .returns<Product[]>(),
    supabase
      .from('dining_tables')
      .select('id,name,seats,dining_areas(name)')
      .eq('store_id', store.id)
      .eq('is_active', true)
      .order('sort_order')
      .order('name'),
  ]);

  const dineInTables = (tables ?? []).map((table) => ({
    id: table.id,
    name: table.name,
    seats: table.seats,
    areaName: Array.isArray(table.dining_areas) ? table.dining_areas[0]?.name ?? null : (table.dining_areas as { name: string } | null)?.name ?? null,
  }));

  return (
    <CatalogView
      storeName={store.name}
      storeSettings={store}
      categories={categories ?? []}
      products={products ?? []}
      hero={<DineInHero key="hero" store={store} />}
      headerLink={null}
      cart={<DineInCart key="cart" tables={dineInTables} isStoreOpen={isStoreOpenNow(store)} />}
    />
  );
}
