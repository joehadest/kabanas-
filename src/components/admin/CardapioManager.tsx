'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { ChevronDown, Plus, Search } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { FloatingToast, useFloatingToast } from '@/components/ui/floating-toast';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-layout';
import { CategoryEditor } from './CategoryEditor';
import { ProductEditor } from './ProductEditor';
import type { Category, Product } from '@/lib/types/database';

interface Props {
  storeId: string;
  defaultTaxRate: number;
  initialCategories: Category[];
  initialProducts: Product[];
}

type CategoryModalState = { mode: 'new' } | { mode: 'edit'; category: Category } | null;
type ProductModalState = { mode: 'new'; categoryId: string | null } | { mode: 'edit'; product: Product } | null;

const COLLAPSED_LIMIT = 8;

function productStatus(product: Product) {
  if (!product.is_active) {
    return { label: 'Oculto', className: 'bg-neutral-800 text-neutral-400' };
  }
  if (!product.is_available) {
    return { label: 'Off', className: 'bg-red-500/10 text-red-400' };
  }
  return { label: 'Ativo', className: 'bg-brand-400/10 text-brand-300' };
}

function ProductRow({ product, onClick }: { product: Product; onClick: () => void }) {
  const status = productStatus(product);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-left transition-all hover:border-brand-400 hover:shadow-card active:scale-[0.99]"
    >
      {product.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-[10px] font-bold uppercase text-neutral-500">
          {product.name.slice(0, 2)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{product.name}</p>
        <p className="text-xs font-bold text-brand-300">{formatCurrency(product.price)}</p>
      </div>
      <span
        className={clsx(
          'shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
          status.className
        )}
      >
        {status.label}
      </span>
    </button>
  );
}

export function CardapioManager({ storeId, defaultTaxRate, initialCategories, initialProducts }: Props) {
  const router = useRouter();
  const { toast, showToast, clearToast } = useFloatingToast();
  const [categories, setCategories] = useState(initialCategories);
  const [products, setProducts] = useState(initialProducts);
  const [categoryModal, setCategoryModal] = useState<CategoryModalState>(null);
  const [productModal, setProductModal] = useState<ProductModalState>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initialCategories.slice(0, 2).map((c) => c.id)));
  const [showAllInCategory, setShowAllInCategory] = useState<Set<string>>(new Set());

  const normalizedSearch = search.trim().toLowerCase();

  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const cat of categories) map.set(cat.id, []);
    const uncategorized: Product[] = [];

    for (const product of products) {
      if (normalizedSearch && !product.name.toLowerCase().includes(normalizedSearch)) continue;
      if (!product.category_id) uncategorized.push(product);
      else map.get(product.category_id)?.push(product);
    }

    return { map, uncategorized };
  }, [categories, products, normalizedSearch]);

  const visibleCategories = useMemo(() => {
    if (!normalizedSearch) return categories;
    return categories.filter((cat) => (productsByCategory.map.get(cat.id)?.length ?? 0) > 0);
  }, [categories, normalizedSearch, productsByCategory.map]);

  const toggleCategory = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleShowAll = (id: string) => {
    setShowAllInCategory((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set([...categories.map((c) => c.id), '__none__']));
  const collapseAll = () => setExpanded(new Set());

  const handleCategorySaved = (category: Category, isNew: boolean) => {
    setCategories((prev) => {
      const exists = prev.some((c) => c.id === category.id);
      return exists ? prev.map((c) => (c.id === category.id ? category : c)) : [...prev, category];
    });
    setExpanded((prev) => new Set(prev).add(category.id));
    setCategoryModal(null);
    showToast(isNew ? 'Categoria criada.' : 'Categoria atualizada.', 'success');
    router.refresh();
  };

  const handleCategoryDeleted = (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setProducts((prev) => prev.map((p) => (p.category_id === id ? { ...p, category_id: null } : p)));
    setCategoryModal(null);
    showToast('Categoria excluída.', 'success');
    router.refresh();
  };

  const handleProductSaved = (product: Product, isNew: boolean) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      return exists ? prev.map((p) => (p.id === product.id ? product : p)) : [...prev, product];
    });
    if (product.category_id) setExpanded((prev) => new Set(prev).add(product.category_id!));
    setProductModal(null);
    showToast(isNew ? 'Produto criado.' : 'Produto atualizado.', 'success');
    router.refresh();
  };

  const handleProductDeleted = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setProductModal(null);
    showToast('Produto excluído.', 'success');
    router.refresh();
  };

  const renderProductList = (items: Product[], categoryKey: string) => {
    if (items.length === 0) {
      return <p className="py-3 text-sm text-neutral-400">Nenhum produto nesta categoria.</p>;
    }

    const showAll = showAllInCategory.has(categoryKey) || normalizedSearch.length > 0;
    const visible = showAll ? items : items.slice(0, COLLAPSED_LIMIT);
    const hiddenCount = items.length - COLLAPSED_LIMIT;

    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((product) => (
          <ProductRow key={product.id} product={product} onClick={() => setProductModal({ mode: 'edit', product })} />
        ))}
        {!showAll && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => toggleShowAll(categoryKey)}
            className="col-span-full rounded-xl border border-dashed border-border py-2.5 text-xs font-bold uppercase tracking-wide text-neutral-500 transition-colors hover:border-brand-400 hover:text-brand-300"
          >
            Ver mais {hiddenCount} produto{hiddenCount > 1 ? 's' : ''}
          </button>
        )}
        {showAll && !normalizedSearch && items.length > COLLAPSED_LIMIT && (
          <button
            type="button"
            onClick={() => toggleShowAll(categoryKey)}
            className="col-span-full rounded-xl border border-dashed border-border py-2.5 text-xs font-bold uppercase tracking-wide text-neutral-500 transition-colors hover:border-brand-400 hover:text-brand-300"
          >
            Mostrar menos
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestão de produtos"
        title="Cardápio"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="md" onClick={() => setCategoryModal({ mode: 'new' })}>
              + Categoria
            </Button>
            <Button variant="brand" size="md" onClick={() => setProductModal({ mode: 'new', categoryId: categories[0]?.id ?? null })}>
              <Plus size={16} />
              Novo produto
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="pl-9"
          />
        </div>
        {!normalizedSearch && categories.length > 1 && (
          <div className="flex gap-2 text-xs font-bold uppercase tracking-wide">
            <button type="button" onClick={expandAll} className="text-brand-300 hover:underline">
              Expandir tudo
            </button>
            <span className="text-neutral-300">·</span>
            <button type="button" onClick={collapseAll} className="text-neutral-500 hover:underline">
              Recolher
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {visibleCategories.map((cat) => {
          const catProducts = productsByCategory.map.get(cat.id) ?? [];
          const isOpen = normalizedSearch.length > 0 || expanded.has(cat.id);

          return (
            <section key={cat.id} className="overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-card">
              <div className="flex items-start gap-2 border-b border-border bg-black/40 p-4">
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  aria-expanded={isOpen}
                >
                  <ChevronDown
                    size={18}
                    className={clsx('shrink-0 text-neutral-400 transition-transform', isOpen && 'rotate-180')}
                  />
                  <div className="min-w-0">
                    <h2 className="truncate font-serif text-lg font-bold text-ink">
                      {cat.name}
                      {!cat.is_active && <span className="ml-2 text-xs font-normal text-neutral-400">(oculta)</span>}
                    </h2>
                    <p className="text-xs text-neutral-500">{catProducts.length} produto{catProducts.length !== 1 ? 's' : ''}</p>
                  </div>
                </button>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setCategoryModal({ mode: 'edit', category: cat })}
                    className="rounded-lg px-2 py-1 text-xs font-bold text-neutral-400 hover:bg-neutral-800 hover:text-brand-300"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductModal({ mode: 'new', categoryId: cat.id })}
                    className="rounded-lg px-2 py-1 text-xs font-bold text-brand-300 hover:bg-brand-400/10"
                  >
                    + Produto
                  </button>
                </div>
              </div>

              {isOpen && <div className="p-4">{renderProductList(catProducts, cat.id)}</div>}
            </section>
          );
        })}

        {productsByCategory.uncategorized.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-card">
            <button
              type="button"
              onClick={() => toggleCategory('__none__')}
              className="flex w-full items-center gap-2 border-b border-border bg-black/40 p-4 text-left"
            >
              <ChevronDown
                size={18}
                className={clsx(
                  'shrink-0 text-neutral-400 transition-transform',
                  (normalizedSearch.length > 0 || expanded.has('__none__')) && 'rotate-180'
                )}
              />
              <div>
                <h2 className="font-serif text-lg font-bold text-ink">Sem categoria</h2>
                <p className="text-xs text-neutral-500">{productsByCategory.uncategorized.length} produtos</p>
              </div>
            </button>
            {(normalizedSearch.length > 0 || expanded.has('__none__')) && (
              <div className="p-4">{renderProductList(productsByCategory.uncategorized, '__none__')}</div>
            )}
          </section>
        )}
      </div>

      {categories.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-neutral-500">
          Nenhuma categoria ainda. Crie uma para começar a montar o cardápio.
        </p>
      )}

      {normalizedSearch && visibleCategories.length === 0 && productsByCategory.uncategorized.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-neutral-500">
          Nenhum produto encontrado para &quot;{search}&quot;.
        </p>
      )}

      {categoryModal && (
        <CategoryEditor
          storeId={storeId}
          category={categoryModal.mode === 'edit' ? categoryModal.category : null}
          sortOrder={categories.length}
          onClose={() => setCategoryModal(null)}
          onSaved={handleCategorySaved}
          onDeleted={handleCategoryDeleted}
        />
      )}

      {productModal && (
        <ProductEditor
          storeId={storeId}
          categories={categories}
          defaultTaxRate={defaultTaxRate}
          product={productModal.mode === 'edit' ? productModal.product : null}
          defaultCategoryId={productModal.mode === 'new' ? productModal.categoryId : undefined}
          sortOrder={products.length}
          onClose={() => setProductModal(null)}
          onSaved={handleProductSaved}
          onDeleted={handleProductDeleted}
        />
      )}

      <FloatingToast toast={toast} onClose={clearToast} />
    </div>
  );
}
