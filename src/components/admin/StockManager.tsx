'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/format';
import type { Category, Product } from '@/lib/types/database';

interface Props {
  categories: Category[];
  products: Product[];
}

export function StockManager({ categories, products: initialProducts }: Props) {
  const supabase = createClient();
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );

  const availableCount = products.filter((p) => p.is_available).length;

  const toggleAvailability = async (product: Product) => {
    const nextValue = !product.is_available;
    setPendingId(product.id);
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, is_available: nextValue } : p)));

    const { data, error } = await supabase.from('products').update({ is_available: nextValue }).eq('id', product.id).select('id');
    setPendingId(null);

    // RLS bloqueia silenciosamente (sem erro, 0 linhas afetadas) quando a
    // conta logada não tem role admin/restaurant — sem o .select() acima,
    // isso pareceria ter funcionado mesmo sem gravar nada no banco.
    if (error || !data || data.length === 0) {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, is_available: !nextValue } : p)));
      alert('Não foi possível salvar. Verifique se sua conta tem permissão de administrador.');
    }
  };

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'Sem categoria';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produto..."
          className="w-full border border-[#d8d4c9] bg-[#faf9f5] px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 sm:max-w-xs"
        />
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
          <span className="text-green-700">{availableCount} disponíveis</span> ·{' '}
          <span className="text-red-600">{products.length - availableCount} indisponíveis</span>
        </p>
      </div>

      <div className="border border-[#d8d4c9] bg-[#f7f5ef] divide-y divide-[#d8d4c9]">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-neutral-400">Nenhum produto encontrado.</p>
        ) : (
          filtered.map((product, idx) => (
            <div
              key={product.id}
              style={{ animationDelay: `${Math.min(idx, 12) * 30}ms` }}
              className={clsx(
                'grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-3 overflow-hidden px-4 py-3.5 animate-fade-in-up transition-colors',
                !product.is_available && 'bg-red-50/40'
              )}
            >
              <div className="min-w-0">
                <p className="truncate font-serif text-base font-bold text-[#1c1d1a]">{product.name}</p>
                <p className="text-xs text-neutral-500">
                  {categoryName(product.category_id)} · {formatCurrency(product.price)}
                </p>
              </div>
              <button
                onClick={() => toggleAvailability(product)}
                disabled={pendingId === product.id}
                className={clsx(
                  'flex h-9 w-24 items-center justify-center gap-2 justify-self-end border px-2 text-[10px] font-black uppercase tracking-wide transition-all disabled:opacity-50 active:scale-[0.97]',
                  product.is_available
                    ? 'border-green-700 bg-green-600 text-white shadow-[0_3px_0_#15803d] hover:bg-green-700'
                    : 'border-[#bcb7aa] bg-[#faf9f5] text-neutral-600 hover:border-neutral-600 hover:bg-[#e7e4dc]'
                )}
                aria-label={product.is_available ? 'Marcar como indisponível' : 'Marcar como disponível'}
                aria-pressed={product.is_available}
              >
                <span className={clsx('h-2 w-2 rounded-full', product.is_available ? 'bg-white' : 'bg-neutral-400')} />
                {product.is_available ? 'Disponível' : 'Indisponível'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
