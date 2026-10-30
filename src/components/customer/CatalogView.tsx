'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Search, SearchX, X } from 'lucide-react';
import { CategoryTabs } from './CategoryTabs';
import { ProductCard } from './ProductCard';
import { ProductModal } from './ProductModal';
import { FloatingCart } from './FloatingCart';
import { InstallPWAPrompt } from './InstallPWAPrompt';
import { ShareMenuButton } from './ShareMenuButton';
import { KabanasLogo } from '@/components/shared/KabanasLogo';
import { StoreLogo } from '@/components/shared/StoreLogo';
import type { Category, Product, StoreSettings } from '@/lib/types/database';

interface Props {
  storeName: string;
  storeSettings: StoreSettings;
  categories: Category[];
  products: Product[];
  hero: ReactNode;
  cart?: ReactNode;
  headerLink?: { href: string; label: string } | null;
  orderingEnabled?: boolean;
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function CatalogView({
  storeName, storeSettings, categories, products, hero, cart,
  headerLink = { href: '/entrar', label: 'Entrar' }, orderingEnabled = true,
}: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [navigationHeight, setNavigationHeight] = useState(128);
  const navigationRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const normalizedSearch = normalize(search.trim());
  const isSearching = normalizedSearch.length > 0;
  const showGrouped = !isSearching;

  useEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    const observer = new ResizeObserver(() => setNavigationHeight(navigation.getBoundingClientRect().height));
    observer.observe(navigation);
    return () => observer.disconnect();
  }, []);

  const showResults = () => requestAnimationFrame(() => mainRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }));

  const filtered = useMemo(() => products.filter((product) => {
    const matchesSearch = !isSearching || normalize(`${product.name} ${product.description ?? ''}`).includes(normalizedSearch);
    return matchesSearch;
  }), [products, isSearching, normalizedSearch]);

  const grouped = useMemo(() => {
    const groups = categories.map((category) => ({
      id: category.id, name: category.name, description: category.description,
      products: products.filter((product) => product.category_id === category.id),
    })).filter((group) => group.products.length > 0);
    const categoryIds = new Set(categories.map((category) => category.id));
    const others = products.filter((product) => !product.category_id || !categoryIds.has(product.category_id));
    if (others.length) groups.push({ id: 'other', name: 'Outros', description: null, products: others });
    return groups;
  }, [categories, products]);

  useEffect(() => {
    if (isSearching) return;
    let frame = 0;
    const updateCategory = () => {
      frame = 0;
      const activationLine = navigationHeight + 24;
      let currentId: string | null = null;
      for (const group of grouped) {
        const section = sectionRefs.current.get(group.id);
        if (section && section.getBoundingClientRect().top <= activationLine) currentId = group.id;
      }
      // Uma seção curta no final pode não alcançar a linha abaixo do menu fixo.
      if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        currentId = grouped[grouped.length - 1]?.id ?? null;
      }
      setActiveCategory(currentId === 'other' ? null : currentId);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = requestAnimationFrame(updateCategory);
    };
    updateCategory();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    // Atualiza a posição das seções quando fotos e fontes alteram sua altura.
    const observer = new ResizeObserver(scheduleUpdate);
    if (mainRef.current) observer.observe(mainRef.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [grouped, isSearching, navigationHeight]);

  const selectCategory = (id: string | null) => {
    setActiveCategory(id);
    setSearch('');
    requestAnimationFrame(() => {
      const target = id ? sectionRefs.current.get(id) : mainRef.current;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      (target ?? mainRef.current)?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'instant' : 'smooth' });
    });
  };

  const renderProducts = (items: Product[]) => (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
      {items.map((product) => (
        <ProductCard key={product.id} product={product} onSelect={setSelectedProduct} orderingEnabled={orderingEnabled} />
      ))}
    </div>
  );

  const heading = isSearching ? 'Resultados da busca' : 'Nosso cardápio';

  return (
    <div className={clsx('min-h-screen bg-surface font-sans', orderingEnabled ? 'pb-32' : 'pb-10')}>
      {hero}
      <div ref={navigationRef} className="sticky top-0 z-30 border-b border-white/[0.08] bg-surface/95 shadow-lg backdrop-blur-xl">
        <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-1 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] sm:px-8 sm:pt-4">
          <div className="hidden shrink-0 sm:block">
            {storeSettings.logo_url ? <StoreLogo logoUrl={storeSettings.logo_url} name={storeName} size="sm" /> : <KabanasLogo variant="mark" size="sm" />}
          </div>
          <div className="relative min-w-0 flex-1">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              aria-label="Buscar no cardápio"
              value={search}
              onChange={(event) => { setSearch(event.target.value); showResults(); }}
              placeholder="O que você quer hoje?"
              className="h-12 w-full min-w-0 rounded-xl border border-white/10 bg-white/5 pl-11 pr-12 text-base text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/10 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {search && (
              <button type="button" onClick={() => { setSearch(''); searchRef.current?.focus(); showResults(); }} aria-label="Limpar busca" className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
                <X size={18} />
              </button>
            )}
          </div>
          <ShareMenuButton storeName={storeName} storeSlug={storeSettings.slug} />
          {headerLink && <Link href={headerLink.href} className="flex min-h-12 shrink-0 items-center rounded-xl border border-white/15 px-3 text-sm font-semibold text-neutral-200 hover:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">{headerLink.label}</Link>}
        </header>
        <CategoryTabs categories={categories} activeId={isSearching ? null : activeCategory} onSelect={selectCategory} />
      </div>

      <main ref={mainRef} style={{ scrollMarginTop: navigationHeight + 8 }} className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{heading}</h2>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400 sm:text-sm">{isSearching ? `Buscando por “${search.trim()}”` : 'Toque em um item para ver os detalhes.'}</p>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-neutral-400" role="status">{filtered.length} {filtered.length === 1 ? 'item' : 'itens'}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-5 py-12 text-center">
            <SearchX size={32} className="mb-4 text-neutral-500" aria-hidden="true" />
            <p className="text-base font-semibold text-ink">Nenhum item encontrado</p>
            <p className="mt-2 text-sm text-neutral-400">Tente outro nome ou explore as categorias.</p>
            <button type="button" onClick={() => selectCategory(null)} className="mt-5 min-h-11 rounded-xl bg-brand-400 px-5 text-sm font-semibold text-neutral-950">Ver cardápio completo</button>
          </div>
        ) : showGrouped ? (
          <div className="space-y-8 sm:space-y-10">
            {grouped.map((group) => (
              <section
                key={group.id}
                ref={(element) => {
                  if (element) sectionRefs.current.set(group.id, element);
                  else sectionRefs.current.delete(group.id);
                }}
                style={{ scrollMarginTop: navigationHeight + 16 }}
                aria-labelledby={`category-${group.id}`}
              >
                <div className="mb-3 flex items-center gap-3">
                  <h3 id={`category-${group.id}`} className="text-base font-semibold text-ink sm:text-lg">{group.name}</h3>
                  <span className="text-xs tabular-nums text-neutral-500">{group.products.length}</span>
                  <div className="h-px flex-1 bg-white/[0.08]" aria-hidden="true" />
                </div>
                {group.description && <p className="mb-3 text-sm text-neutral-400">{group.description}</p>}
                {renderProducts(group.products)}
              </section>
            ))}
          </div>
        ) : renderProducts(filtered)}
      </main>

      {selectedProduct && <ProductModal key={selectedProduct.id} product={selectedProduct} orderingEnabled={orderingEnabled} onClose={() => setSelectedProduct(null)} />}
      {orderingEnabled && (cart ?? <FloatingCart storeSettings={storeSettings} />)}
      <InstallPWAPrompt storeName={storeSettings.name} logoUrl={storeSettings.logo_url} />
    </div>
  );
}
