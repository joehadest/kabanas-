'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { CategoryTabs } from './CategoryTabs';
import { ProductCard } from './ProductCard';
import { ProductModal } from './ProductModal';
import { FloatingCart } from './FloatingCart';
import { InstallPWAPrompt } from './InstallPWAPrompt';
import { StoreLogo } from '@/components/shared/StoreLogo';
import type { Category, Product, StoreSettings } from '@/lib/types/database';

interface Props {
  storeName: string;
  storeSettings: StoreSettings;
  categories: Category[];
  products: Product[];
  hero: ReactNode;
}

export function CatalogView({ storeName, storeSettings, categories, products, hero }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = !activeCategory || p.category_id === activeCategory;
      const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, search]);

  return (
    <div className="min-h-screen pb-32 paper-surface">
      {hero}

      <div className="sticky top-0 z-30 shadow-[0_10px_20px_rgba(23,22,18,0.08)]">
        <header className="border-b border-white/10 bg-[#171612]/95 px-4 py-3 backdrop-blur-xl safe-top">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <StoreLogo logoUrl={storeSettings.logo_url} name={storeName} size="sm" className="hidden sm:flex" />
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-brand-300">⌕</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="O que voce esta com vontade de comer?"
                className="w-full min-w-0 rounded-xl border border-white/10 bg-white/10 py-2.5 pl-9 pr-3.5 text-sm text-white placeholder:text-neutral-400 outline-none transition-colors focus:border-brand-400 focus:bg-white/15"
              />
            </div>
            <Link
              href="/entrar"
              className="shrink-0 border border-white/20 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:border-brand-400 hover:bg-brand-400 hover:text-neutral-950"
            >
              Entrar
            </Link>
          </div>
        </header>

        <CategoryTabs categories={categories} activeId={activeCategory} onSelect={setActiveCategory} />
      </div>

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">Escolha seu momento</p>
            <h2 className="mt-1 font-serif text-2xl font-bold leading-none text-[#171612]">No cardapio</h2>
          </div>
          <p className="pb-0.5 text-xs font-medium text-neutral-500">{filtered.length} opcoes</p>
        </div>
        {filtered.length === 0 ? (
          <p className="border-y border-neutral-300 py-12 text-center text-sm text-neutral-500">Nenhum produto encontrado.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product, index) => (
              <ProductCard key={product.id} product={product} onSelect={setSelectedProduct} index={index} />
            ))}
          </div>
        )}
      </main>

      {selectedProduct && <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />}

      <FloatingCart storeSettings={storeSettings} />
      <InstallPWAPrompt storeName={storeSettings.name} logoUrl={storeSettings.logo_url} />
    </div>
  );
}
