import { createClient } from '@/lib/supabase/server';
import { KanbanBoard } from '@/components/restaurant/KanbanBoard';
import type { Order } from '@/lib/types/database';

export const revalidate = 0;

export default async function PedidosPage() {
  const supabase = await createClient();
  const storeSlug = process.env.NEXT_PUBLIC_STORE_SLUG ?? 'kabanas';

  const { data: store } = await supabase.from('store_settings').select('id').eq('slug', storeSlug).single();

  if (!store) {
    return <p className="p-6 text-sm text-neutral-500">Loja não configurada.</p>;
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('*, items:order_items(*, options:order_item_options(*))')
    .eq('store_id', store.id)
    .in('status', ['received', 'preparing', 'out_for_delivery'])
    .order('created_at', { ascending: false })
    .returns<Order[]>();

  return <KanbanBoard storeId={store.id} initialOrders={orders ?? []} />;
}
