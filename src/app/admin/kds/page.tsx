import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/data/get-store';
import { KitchenDisplay } from '@/components/admin/KitchenDisplay';

export const revalidate = 0;

export default async function KdsPage() {
  const store = await getActiveStore();
  if (!store) return <p className="p-6">Empresa não configurada.</p>;

  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from('tab_items')
    .select('id,product_name,quantity,notes,station,status,created_at,tabs!inner(identifier,dining_tables(name))')
    .in('status', ['new', 'preparing', 'ready'])
    .eq('tabs.store_id', store.id)
    .order('created_at');

  if (error) {
    return <p className="p-6">Execute a migração do PDV para ativar a cozinha.</p>;
  }

  return <KitchenDisplay storeId={store.id} items={items ?? []} />;
}
