'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { CategoryTabs } from './CategoryTabs';
import { ProductCard } from './ProductCard';
import { ProductModal } from './ProductModal';
import { FloatingCart } from './FloatingCart';
import { InstallPWAPrompt } from './InstallPWAPrompt';
import { KabanasLogo } from '@/components/shared/KabanasLogo';
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
  const [activeCategory, setActiveCategory] = useState<string | null>(categories[0]?.id ?? null);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const normalizedSearch = search.trim().toLowerCase();
  const isSearching = normalizedSearch.length > 0;
  const showGrouped = !isSearching && activeCategory === null;

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = isSearching || !activeCategory || p.category_id === activeCategory;
      const matchesSearch = !isSearching || p.name.toLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, isSearching, normalizedSearch]);

  const grouped = useMemo(() => {
    if (!showGrouped) return [];

    return categories
      .map((cat) => ({
        category: cat,
        products: products.filter((p) => p.category_id === cat.id),
      }))
      .filter((group) => group.products.length > 0);
  }, [categories, products, showGrouped]);

  const uncategorized = useMemo(() => {
    if (!showGrouped) return [];
    return products.filter((p) => !p.category_id);
  }, [products, showGrouped]);

  return (
    <div className="min-h-screen pb-32 paper-surface">
      {hero}

      <div className="sticky top-0 z-30 shadow-[0_10px_20px_rgba(23,22,18,0.08)]">
        <header className="border-b border-white/10 bg-kabanas-charcoal/95 px-4 py-3 backdrop-blur-xl safe-top">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            {storeSettings.logo_url ? (
              <StoreLogo logoUrl={storeSettings.logo_url} name={storeName} size="sm" className="hidden sm:flex" />
            ) : (
              <KabanasLogo variant="mark" size="sm" className="hidden sm:flex" />
            )}
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-brand-300">⌕</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="O que você está com vontade de comer?"
                className="w-full min-w-0 rounded-xl border border-white/10 bg-white/10 py-2.5 pl-9 pr-3.5 text-sm text-white placeholder:text-neutral-400 outline-none transition-colors focus:border-brand-400 focus:bg-white/15"
              />
            </div>
            <Link
              href="/entrar"
              className="shrink-0 rounded-xl border border-white/20 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:border-brand-400 hover:bg-brand-400 hover:text-neutral-950"
            >
              Entrar
            </Link>
          </div>
        </header>

        {!isSearching && (
          <CategoryTabs categories={categories} activeId={activeCategory} onSelect={setActiveCategory} />
        )}
      </div>

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-300">Escolha seu momento</p>
            <h2 className="mt-1 font-serif text-2xl font-bold leading-none text-ink">
              {isSearching ? 'Resultados' : showGrouped ? 'Cardápio completo' : 'No cardápio'}
            </h2>
          </div>
          <p className="shrink-0 pb-0.5 text-xs font-medium text-neutral-500">{filtered.length} opções</p>
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-neutral-500">
            Nenhum produto encontrado.
          </p>
        ) : showGrouped ? (
          <div className="space-y-8">
            {grouped.map(({ category, products: catProducts }) => (
              <section key={category.id}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-serif text-xl font-bold text-ink">{category.name}</h3>
                  <button
                    type="button"
                    onClick={() => setActiveCategory(category.id)}
                    className="shrink-0 text-xs font-bold uppercase tracking-wide text-brand-300 hover:underline"
                  >
                    Ver todos
                  </button>
                </div>
                <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none snap-x snap-mandatory sm:-mx-0 sm:px-0">
                  {catProducts.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onSelect={setSelectedProduct}
                      index={index}
                      variant="carousel"
                    />
                  ))}
                </div>
              </section>
            ))}

            {uncategorized.length > 0 && (
              <section>
                <h3 className="mb-3 font-serif text-xl font-bold text-ink">Outros</h3>
                <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none snap-x snap-mandatory sm:-mx-0 sm:px-0">
                  {uncategorized.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onSelect={setSelectedProduct}
                      index={index}
                      variant="carousel"
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
