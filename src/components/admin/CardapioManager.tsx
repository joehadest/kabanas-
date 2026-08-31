'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/utils/format';
import { CategoryEditor } from './CategoryEditor';
import { ProductEditor } from './ProductEditor';
import type { Category, Product } from '@/lib/types/database';

interface Props {
  storeId: string;
  initialCategories: Category[];
  initialProducts: Product[];
}

type CategoryModalState = { mode: 'new' } | { mode: 'edit'; category: Category } | null;
type ProductModalState = { mode: 'new'; categoryId: string | null } | { mode: 'edit'; product: Product } | null;

export function CardapioManager({ storeId, initialCategories, initialProducts }: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [products, setProducts] = useState(initialProducts);
  const [categoryModal, setCategoryModal] = useState<CategoryModalState>(null);
  const [productModal, setProductModal] = useState<ProductModalState>(null);

  const handleCategorySaved = (category: Category) => {
    setCategories((prev) => {
      const exists = prev.some((c) => c.id === category.id);
      return exists ? prev.map((c) => (c.id === category.id ? category : c)) : [...prev, category];
    });
    setCategoryModal(null);
  };

  const handleCategoryDeleted = (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setProducts((prev) => prev.map((p) => (p.category_id === id ? { ...p, category_id: null } : p)));
    setCategoryModal(null);
  };

  const handleProductSaved = (product: Product) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      return exists ? prev.map((p) => (p.id === product.id ? product : p)) : [...prev, product];
    });
    setProductModal(null);
  };

  const handleProductDeleted = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setProductModal(null);
  };

  const uncategorized = products.filter((p) => !p.category_id);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-700">Gestao de produtos</p>
          <h1 className="mt-2 font-serif text-3xl font-bold leading-none text-[#1c1d1a]">Cardápio</h1>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            onClick={() => setCategoryModal({ mode: 'new' })}
            className="border border-[#d8d4c9] px-3 py-3 text-xs font-bold text-neutral-700 transition-colors hover:border-brand-500 hover:text-brand-700 sm:px-3.5 sm:text-sm"
          >
            + Categoria
          </button>
          <button
            onClick={() => setProductModal({ mode: 'new', categoryId: categories[0]?.id ?? null })}
            className="bg-brand-400 px-3 py-3 text-xs font-black text-neutral-950 shadow-[0_4px_0_#a16207] transition-all hover:bg-brand-300 active:translate-y-0.5 active:shadow-none sm:px-4 sm:text-sm"
          >
            + Novo produto
          </button>
        </div>
      </div>

      {categories.map((cat, catIdx) => (
        <section key={cat.id} style={{ animationDelay: `${catIdx * 80}ms` }} className="animate-fade-in-up">
          <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="flex items-center gap-2 font-serif text-xl font-bold text-[#1c1d1a]">
              <span className="h-2 w-2 bg-brand-400" />
              {cat.name}
              {!cat.is_active && <span className="text-xs font-normal text-neutral-400">(oculta)</span>}
            </h2>
            <button
              onClick={() => setCategoryModal({ mode: 'edit', category: cat })}
              className="text-xs font-bold text-neutral-400 hover:text-brand-700"
            >
              editar
            </button>
            <button
              onClick={() => setProductModal({ mode: 'new', categoryId: cat.id })}
              className="w-full border-t border-[#dedad0] pt-2 text-left text-xs font-bold text-brand-700 hover:underline sm:ml-auto sm:w-auto sm:border-0 sm:pt-0"
            >
              + produto nesta categoria
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products
              .filter((p) => p.category_id === cat.id)
              .map((product) => (
                <button
                  key={product.id}
                  onClick={() => setProductModal({ mode: 'edit', product })}
                  className="flex items-center justify-between gap-3 border border-[#d8d4c9] bg-[#faf9f5] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-[0_8px_18px_rgba(28,29,26,0.1)]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-serif text-lg font-bold text-[#1c1d1a]">{product.name}</p>
                    <p className="mt-1 text-sm font-bold text-brand-800">{formatCurrency(product.price)}</p>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      product.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {product.is_available ? 'Disponível' : 'Indisponível'}
                  </span>
                </button>
              ))}
            {products.filter((p) => p.category_id === cat.id).length === 0 && (
              <p className="text-sm text-neutral-400">Nenhum produto nesta categoria ainda.</p>
            )}
          </div>
        </section>
      ))}

      {uncategorized.length > 0 && (
        <section className="animate-fade-in-up">
          <h2 className="mb-3 flex items-center gap-2 font-serif text-xl font-bold text-[#1c1d1a]">
            <span className="h-2 w-2 bg-neutral-400" />
            Sem categoria
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {uncategorized.map((product) => (
              <button
                key={product.id}
                onClick={() => setProductModal({ mode: 'edit', product })}
                className="flex items-center justify-between gap-3 border border-[#d8d4c9] bg-[#faf9f5] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-[0_8px_18px_rgba(28,29,26,0.1)]"
              >
                <div className="min-w-0">
                  <p className="truncate font-serif text-lg font-bold text-[#1c1d1a]">{product.name}</p>
                  <p className="mt-1 text-sm font-bold text-brand-800">{formatCurrency(product.price)}</p>
                </div>
                <span
                  className={`shrink-0 px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    product.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {product.is_available ? 'Disponível' : 'Indisponível'}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {categories.length === 0 && (
        <p className="border border-dashed border-[#d8d4c9] p-8 text-center text-sm text-neutral-500">
          Nenhuma categoria ainda. Crie uma para começar a montar o cardápio.
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
          product={productModal.mode === 'edit' ? productModal.product : null}
          defaultCategoryId={productModal.mode === 'new' ? productModal.categoryId : undefined}
          sortOrder={products.length}
          onClose={() => setProductModal(null)}
          onSaved={handleProductSaved}
          onDeleted={handleProductDeleted}
        />
      )}
    </div>
  );
}
