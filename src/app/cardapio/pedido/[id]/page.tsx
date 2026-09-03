import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TableOrderTracking } from '@/components/customer/TableOrderTracking';
import type { TableOrder, TableOrderItem } from '@/lib/types/database';

export const revalidate = 0;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TableOrderPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('table_orders')
    .select(
      'id,store_id,table_id,table_name,tab_id,customer_name,notes,created_at,tab_items(id,product_name,quantity,unit_price,notes,status),store_settings(slug)'
    )
    .eq('id', id)
    .single();

  if (!data) notFound();

  const storeSlug = Array.isArray(data.store_settings) ? data.store_settings[0]?.slug : (data.store_settings as { slug: string } | null)?.slug;

  const order: TableOrder = {
    id: data.id,
    store_id: data.store_id,
    table_id: data.table_id,
    table_name: data.table_name,
    tab_id: data.tab_id,
    customer_name: data.customer_name,
    notes: data.notes,
    created_at: data.created_at,
    items: (data.tab_items ?? []) as TableOrderItem[],
  };

  return <TableOrderTracking order={order} menuUrl={storeSlug ? `/cardapio/${storeSlug}` : '/'} />;
}
