'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/format';
import { FloatingToast, useFloatingToast } from '@/components/ui/floating-toast';
import { Input } from '@/components/ui/input';
import type { Category, Product } from '@/lib/types/database';

interface Props {
  categories: Category[];
  products: Product[];
}

export function StockManager({ categories, products: initialProducts }: Props) {
  const supabase = createClient();
  const { toast, showToast, clearToast } = useFloatingToast();
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

    if (error || !data || data.length === 0) {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, is_available: !nextValue } : p)));
      showToast('Não foi possível salvar. Verifique se sua conta tem permissão de administrador.', 'error');
      return;
    }

    showToast(
      nextValue ? `${product.name} disponível no cardápio.` : `${product.name} marcado como indisponível.`,
      'success'
    );
  };

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'Sem categoria';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produto..."
          className="sm:max-w-xs"
        />
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
          <span className="text-brand-300">{availableCount} disponíveis</span> ·{' '}
          <span className="text-red-400">{products.length - availableCount} indisponíveis</span>
        </p>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface-elevated">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-neutral-400">Nenhum produto encontrado.</p>
        ) : (
          filtered.map((product, idx) => (
            <div
              key={product.id}
              style={{ animationDelay: `${Math.min(idx, 12) * 30}ms` }}
              className={clsx(
                'grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-3 overflow-hidden px-4 py-3.5 animate-fade-in-up transition-colors',
                !product.is_available && 'bg-red-500/10'
              )}
            >
              <div className="min-w-0">
                <p className="truncate font-serif text-base font-bold text-ink">{product.name}</p>
                <p className="text-xs text-neutral-500">
                  {categoryName(product.category_id)} · {formatCurrency(product.price)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleAvailability(product)}
                disabled={pendingId === product.id}
                className={clsx(
                  'flex h-9 w-24 items-center justify-center gap-2 justify-self-end rounded-xl border px-2 text-[10px] font-black uppercase tracking-wide transition-all disabled:opacity-50 active:scale-[0.97]',
                  product.is_available
                    ? 'border-brand-400/40 bg-brand-400/15 text-brand-300 hover:bg-brand-400/25'
                    : 'border-border bg-neutral-800 text-neutral-400 hover:border-neutral-600'
                )}
                aria-label={product.is_available ? 'Marcar como indisponível' : 'Marcar como disponível'}
                aria-pressed={product.is_available}
              >
                <span className={clsx('h-2 w-2 rounded-full', product.is_available ? 'bg-brand-300' : 'bg-neutral-500')} />
                {product.is_available ? 'Disponível' : 'Off'}
              </button>
            </div>
          ))
        )}
      </div>

      <FloatingToast toast={toast} onClose={clearToast} />
    </div>
  );
}
