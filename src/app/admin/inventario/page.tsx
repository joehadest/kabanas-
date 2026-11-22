import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/data/get-store';
import { InventoryManager } from '@/components/admin/InventoryManager';

export const revalidate = 0;

export default async function InventarioPage() {
  const store = await getActiveStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!store || !user) {
    return <p className="p-6">Empresa ou usuário não configurado.</p>;
  }

  const [{ data: items, error }, { data: products }, { data: usages, error: usageError }] = await Promise.all([
    supabase
      .from('inventory_items')
      .select('id,name,sku,unit,quantity,minimum_quantity,average_cost,location,notes,is_active')
      .eq('store_id', store.id)
      .order('name'),
    supabase.from('products').select('id,name').eq('store_id', store.id).order('name'),
    supabase
      .from('inventory_product_usage')
      .select('inventory_item_id,product_id,base_quantity,sales_count,inventory_items!inner(store_id)')
      .eq('inventory_items.store_id', store.id),
  ]);

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm font-semibold text-red-400">Não foi possível carregar o inventário.</p>
        <p className="mt-2 text-sm text-neutral-400">{error.message}</p>
        <p className="mt-2 text-xs text-neutral-500">
          Execute <code>supabase/migration_inventory.sql</code> e atualize a página.
        </p>
      </div>
    );
  }

  return (
    <InventoryManager
      storeId={store.id}
      operatorId={user.id}
      items={(items ?? []).map((item) => ({ ...item, quantity: Number(item.quantity) }))}
      products={products ?? []}
      usageEnabled={!usageError}
      usages={(usages ?? []).map(({ inventory_item_id, product_id, base_quantity, sales_count }) => ({
        inventory_item_id,
        product_id,
        base_quantity: Number(base_quantity),
        sales_count: Number(sales_count),
      }))}
    />
  );
}
