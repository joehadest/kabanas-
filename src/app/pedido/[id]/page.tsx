import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OrderTracking } from '@/components/customer/OrderTracking';
import type { Order } from '@/lib/types/database';

export const revalidate = 0;

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('*, items:order_items(*, options:order_item_options(*)), address:addresses(*)')
    .eq('id', id)
    .single<Order>();

  if (!order) notFound();

  return <OrderTracking initialOrder={order} />;
}
