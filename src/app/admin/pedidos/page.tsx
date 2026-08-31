import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/data/get-store';
import { KanbanBoard } from '@/components/restaurant/KanbanBoard';
import type { Order } from '@/lib/types/database';

export const revalidate = 0;

export default async function AdminPedidosPage() {
  const store = await getActiveStore();
  if (!store) return <p className="p-6 text-sm text-neutral-500">Loja não configurada.</p>;

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from('orders')
    .select('*, items:order_items(*, options:order_item_options(*))')
    .eq('store_id', store.id)
    .in('status', ['received', 'preparing', 'out_for_delivery'])
    .order('created_at', { ascending: false })
    .returns<Order[]>();

  return <KanbanBoard storeId={store.id} initialOrders={orders ?? []} />;
}
