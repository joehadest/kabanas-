import { createClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils/format';
import type { Category, Product } from '@/lib/types/database';

export const revalidate = 0;

// CRUD completo (criar/editar/excluir produto e categoria, upload de imagem,
// grupos de adicionais) segue o mesmo padrão de mutation usado em
// CheckoutForm.tsx (supabase.from(...).insert/update/delete) — aqui está a
// listagem base sobre a qual esses formulários se conectam.
export default async function CardapioPage() {
  const supabase = await createClient();
  const storeSlug = process.env.NEXT_PUBLIC_STORE_SLUG ?? 'kabanas';

  const { data: store } = await supabase.from('store_settings').select('id').eq('slug', storeSlug).single();
  if (!store) return <p className="p-6 text-sm text-neutral-500">Loja não configurada.</p>;

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('store_id', store.id)
    .order('sort_order')
    .returns<Category[]>();

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', store.id)
    .order('sort_order')
    .returns<Product[]>();

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-7">
      <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-300">Gestao de produtos</p>
          <h1 className="mt-2 font-serif text-3xl font-bold leading-none text-ink">Cardápio</h1>
        </div>
        <button className="bg-brand-400 px-4 py-3 text-sm font-black text-neutral-950 shadow-[0_4px_0_#a16207] transition-all hover:bg-brand-300 active:translate-y-0.5 active:shadow-none">
          + Novo produto
        </button>
      </div>

      {(categories ?? []).map((cat, catIdx) => (
        <section key={cat.id} style={{ animationDelay: `${catIdx * 80}ms` }} className="animate-fade-in-up">
          <h2 className="mb-3 flex items-center gap-2 font-serif text-xl font-bold text-ink">
            <span className="h-2 w-2 bg-brand-400" />
            {cat.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(products ?? [])
              .filter((p) => p.category_id === cat.id)
              .map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between border border-border bg-surface-elevated p-4 transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-[0_8px_18px_rgba(28,29,26,0.1)]"
                >
                  <div>
                    <p className="font-serif text-lg font-bold text-ink">{product.name}</p>
                    <p className="mt-1 text-sm font-bold text-brand-800">{formatCurrency(product.price)}</p>
                  </div>
                  <span
                    className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      product.is_available ? 'bg-brand-400/15 text-brand-400' : 'bg-red-100 text-red-400'
                    }`}
                  >
                    {product.is_available ? 'Disponível' : 'Indisponível'}
                  </span>
                </div>
              ))}
          </div>
        </section>
      ))}
      </div>
    </div>
  );
}
