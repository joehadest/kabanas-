import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/data/get-store';
import { fetchAllRows } from '@/lib/data/fetch-all-rows';
import { SupplierQuoteSheet, type Quote } from '@/components/admin/SupplierQuoteSheet';

export const revalidate = 0;

export default async function CotacaoPage() {
  const store = await getActiveStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!store || !user) {
    return <p className="p-6">Empresa ou usuário não configurado.</p>;
  }

  const [{ data: suppliers, error: suppliersError }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from('purchase_suppliers').select('id,name,phone').eq('store_id', store.id).order('name'),
    supabase.from('purchase_items').select('id,name,unit').eq('store_id', store.id).order('name'),
  ]);

  let quotes: Quote[] = [];
  let quotesError: string | null = null;
  if (items?.length) {
    try {
      quotes = await fetchAllRows<Quote>((from, to) =>
        supabase
          .from('purchase_quotes')
          .select('id,item_id,supplier_id,price,quoted_at,purchase_items!inner(store_id)', { count: 'exact' })
          .eq('purchase_items.store_id', store.id)
          .order('quoted_at', { ascending: false })
          .range(from, to)
      );
    } catch (error) {
      quotesError = error instanceof Error ? error.message : 'Erro ao carregar preços.';
    }
  }

  const errorMessage = suppliersError?.message || itemsError?.message || quotesError;
  if (errorMessage) {
    return (
      <div className="p-6">
        <p className="text-sm font-semibold text-red-400">Não foi possível carregar a cotação.</p>
        <p className="mt-2 text-sm text-neutral-400">{errorMessage}</p>
        <p className="mt-2 text-xs text-neutral-500">
          Execute <code>supabase/migration_supplier_quotes.sql</code> e atualize a página.
        </p>
      </div>
    );
  }

  return (
    <SupplierQuoteSheet
      storeId={store.id}
      operatorId={user.id}
      suppliers={suppliers ?? []}
      items={items ?? []}
      quotes={quotes.map(({ id, item_id, supplier_id, price, quoted_at }) => ({ id, item_id, supplier_id, price: Number(price), quoted_at }))}
    />
  );
}
