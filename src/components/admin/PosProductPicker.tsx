'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus, StickyNote, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { ListSearchBar } from '@/components/ui/collapsible-list';
import { Input } from '@/components/ui/input';
import { useOverlayLock } from '@/lib/ui/use-overlay-lock';

export interface PosProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category_id: string | null;
  is_available?: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface Props {
  products: PosProduct[];
  categories: Category[];
  onSelect: (product: PosProduct, quantity: number) => void | Promise<void>;
  onUnavailable?: (product: PosProduct) => void;
  addingId?: string | null;
  notes: string;
  onNotesChange: (value: string) => void;
  compact?: boolean;
}

const TAP_MOVE_THRESHOLD = 8;

function useTapGuard() {
  const pointer = useRef({ x: 0, y: 0, moved: false });

  return {
    onPointerDown: (event: React.PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY, moved: false };
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (pointer.current.moved) return;
      const dx = Math.abs(event.clientX - pointer.current.x);
      const dy = Math.abs(event.clientY - pointer.current.y);
      if (dx > TAP_MOVE_THRESHOLD || dy > TAP_MOVE_THRESHOLD) {
        pointer.current.moved = true;
      }
    },
    shouldIgnoreTap: () => {
      const ignore = pointer.current.moved;
      pointer.current.moved = false;
      return ignore;
    },
  };
}

function CategoryChip({
  id,
  label,
  active,
  onSelect,
  setRef,
}: {
  id: string | null;
  label: string;
  active: boolean;
  onSelect: (id: string | null) => void;
  setRef: (node: HTMLButtonElement | null) => void;
}) {
  const tap = useTapGuard();

  return (
    <button
      ref={setRef}
      type="button"
      role="tab"
      aria-selected={active}
      onPointerDown={tap.onPointerDown}
      onPointerMove={tap.onPointerMove}
      onClick={(event) => {
        if (tap.shouldIgnoreTap()) {
          event.preventDefault();
          return;
        }
        onSelect(id);
      }}
      className={clsx(
        'shrink-0 snap-start whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-colors select-none touch-manipulation 2xl:px-4 2xl:py-2 2xl:text-sm',
        active
          ? 'bg-brand-600 text-white shadow-sm'
          : 'border border-border bg-surface-elevated text-neutral-400 hover:border-brand-400'
      )}
    >
      {label}
    </button>
  );
}

function CategoryScrollBar({
  categories,
  activeCategory,
  onSelect,
}: {
  categories: Category[];
  activeCategory: string | null;
  onSelect: (id: string | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Map<string | null, HTMLButtonElement>>(new Map());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollHints = () => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(maxScroll > 2 && el.scrollLeft < maxScroll - 2);
  };

  const scrollBy = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  useEffect(() => {
    const chip = chipRefs.current.get(activeCategory);
    chip?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeCategory]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollHints();
    el.addEventListener('scroll', updateScrollHints, { passive: true });

    const observer = new ResizeObserver(updateScrollHints);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', updateScrollHints);
      observer.disconnect();
    };
  }, [categories.length]);

  const setChipRef = (id: string | null) => (node: HTMLButtonElement | null) => {
    if (node) chipRefs.current.set(id, node);
    else chipRefs.current.delete(id);
  };

  const showArrows = canScrollLeft || canScrollRight;

  const arrowButtonClass = (enabled: boolean) =>
    clsx(
      'hidden h-8 w-8 shrink-0 touch-manipulation items-center justify-center self-center rounded-full border border-border bg-surface-elevated text-neutral-400 shadow-sm transition-all hover:border-brand-400 hover:text-ink md:flex',
      !enabled && 'cursor-default opacity-35 hover:border-border hover:text-neutral-400'
    );

  return (
    <div className="flex min-w-0 max-w-full items-stretch gap-1.5 md:gap-2">
      <button
        type="button"
        onClick={() => {
          if (canScrollLeft) scrollBy(-240);
        }}
        aria-disabled={!canScrollLeft}
        aria-label="Categorias anteriores"
        className={clsx(arrowButtonClass(canScrollLeft), !showArrows && 'md:hidden')}
      >
        <ChevronLeft size={18} />
      </button>

      <div className="relative min-w-0 flex-1">
        {canScrollLeft && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-black to-transparent md:from-black" />
        )}
        {canScrollRight && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-black to-transparent md:from-black" />
        )}

        <div
          ref={scrollRef}
          className={clsx(
            'flex gap-2 overflow-x-auto overscroll-x-contain px-0.5 snap-x snap-proximity [-webkit-overflow-scrolling:touch]',
            'max-md:touch-pan-x max-md:scrollbar-none max-md:pb-1',
            'md:pb-2 md:[scrollbar-width:thin] md:[scrollbar-color:#d8d4c9_transparent]'
          )}
          role="tablist"
          aria-label="Categorias do cardápio"
        >
          <CategoryChip
            id={null}
            label="Todos"
            active={activeCategory === null}
            onSelect={onSelect}
            setRef={setChipRef(null)}
          />
          {categories.map((cat) => (
            <CategoryChip
              key={cat.id}
              id={cat.id}
              label={cat.name}
              active={activeCategory === cat.id}
              onSelect={onSelect}
              setRef={setChipRef(cat.id)}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          if (canScrollRight) scrollBy(240);
        }}
        aria-disabled={!canScrollRight}
        aria-label="Próximas categorias"
        className={clsx(arrowButtonClass(canScrollRight), !showArrows && 'md:hidden')}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

function clampQuantity(value: number) {
  return Math.max(1, Math.min(99, value));
}

function QuantityStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        aria-label="Diminuir quantidade"
        onClick={() => onChange(clampQuantity(value - 1))}
        disabled={value <= 1}
        className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800 text-neutral-200 hover:bg-neutral-700 disabled:opacity-40"
      >
        <Minus size={20} />
      </button>
      <span className="min-w-[3rem] text-center font-serif text-3xl font-bold text-white">{value}</span>
      <button
        type="button"
        aria-label="Aumentar quantidade"
        onClick={() => onChange(clampQuantity(value + 1))}
        disabled={value >= 99}
        className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800 text-neutral-200 hover:bg-neutral-700 disabled:opacity-40"
      >
        <Plus size={20} />
      </button>
    </div>
  );
}

function ProductTile({
  product,
  onPick,
  loading,
  compact = false,
}: {
  product: PosProduct;
  onPick: () => void;
  loading: boolean;
  compact?: boolean;
}) {
  const unavailable = product.is_available === false;
  const tap = useTapGuard();

  const handleClick = (event: React.MouseEvent) => {
    if (tap.shouldIgnoreTap()) {
      event.preventDefault();
      return;
    }
    onPick();
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={tap.onPointerDown}
        onPointerMove={tap.onPointerMove}
        disabled={loading}
        className={clsx(
          'group relative flex w-full max-w-full items-center gap-3 overflow-hidden rounded-xl border bg-surface-elevated p-2.5 text-left shadow-sm transition-all touch-manipulation',
          unavailable
            ? 'cursor-not-allowed border-border opacity-50'
            : 'border-border active:scale-[0.99] hover:border-brand-400',
          loading && 'pointer-events-none opacity-70'
        )}
      >
        <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-lg bg-neutral-900 ring-1 ring-white/5">
          {product.image_url ? (
            <Image src={product.image_url} alt={product.name} fill sizes="72px" className="object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center bg-neutral-900 font-serif text-xl text-neutral-600">
              {product.name.charAt(0).toUpperCase()}
            </span>
          )}
          {loading && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 size={18} className="animate-spin text-brand-300" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{product.name}</p>
          <p className="mt-1 text-sm font-bold text-brand-300">{formatCurrency(product.price)}</p>
          {unavailable && <p className="mt-0.5 text-[10px] font-bold uppercase text-red-400">Indisponível</p>}
        </div>
        {!unavailable && !loading && (
          <span className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-400 text-lg font-bold text-neutral-950">
            +
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={tap.onPointerDown}
      onPointerMove={tap.onPointerMove}
      disabled={loading}
      className={clsx(
        'group relative flex max-w-full flex-col overflow-hidden rounded-2xl border bg-surface-elevated text-left shadow-sm transition-all touch-manipulation',
        unavailable
          ? 'cursor-not-allowed border-border opacity-50'
          : 'border-border hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-card active:scale-[0.98]',
        loading && 'pointer-events-none opacity-70'
      )}
    >
      <div className="relative aspect-[5/4] w-full overflow-hidden bg-neutral-900 ring-1 ring-inset ring-white/5">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(min-width: 2560px) 220px, (min-width: 1920px) 200px, (min-width: 1536px) 180px, (min-width: 1280px) 160px, (min-width: 640px) 25vw, 45vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full items-center justify-center bg-neutral-900 font-serif text-3xl text-neutral-600">
            {product.name.charAt(0).toUpperCase()}
          </span>
        )}
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 size={22} className="animate-spin text-brand-300" />
          </span>
        )}
        {!unavailable && !loading && (
          <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-brand-400 text-lg font-bold text-neutral-950 shadow-md">
            +
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <p className="line-clamp-2 min-h-[2.75rem] text-sm font-semibold leading-snug text-ink sm:text-base">{product.name}</p>
        <p className="mt-auto pt-2 text-sm font-bold text-brand-300 sm:text-base">{formatCurrency(product.price)}</p>
        {unavailable && <p className="mt-1 text-[10px] font-bold uppercase text-red-400">Indisponível</p>}
      </div>
    </button>
  );
}

function AddQuantitySheet({
  product,
  quantity,
  onQuantityChange,
  notes,
  onNotesChange,
  onConfirm,
  onClose,
  loading,
  variant = 'sheet',
}: {
  product: PosProduct;
  quantity: number;
  onQuantityChange: (value: number) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
  variant?: 'sheet' | 'popover';
}) {
  const [mounted, setMounted] = useState(false);
  useOverlayLock(true);
  const total = product.price * quantity;

  useEffect(() => setMounted(true), []);

  const content = (
    <>
      {variant === 'sheet' && (
        <div className="flex justify-center pt-2.5 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-neutral-600" />
        </div>
      )}
      <div
        className={clsx(
          'overflow-y-auto overscroll-contain p-5',
          variant === 'sheet' ? 'max-h-[min(58dvh,360px)]' : 'pb-5'
        )}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-neutral-800 ring-1 ring-white/10">
            {product.image_url ? (
              <Image src={product.image_url} alt={product.name} fill sizes="64px" className="object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center bg-neutral-800 font-serif text-2xl text-neutral-500">
                {product.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-lg font-bold leading-snug text-white 2xl:text-xl">{product.name}</p>
            <p className="mt-0.5 text-sm text-neutral-400">{formatCurrency(product.price)} cada</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
          >
            <X size={17} />
          </button>
        </div>

        <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-400">Quantidade</p>
        <QuantityStepper value={quantity} onChange={onQuantityChange} />

        <p className="mt-4 text-center font-serif text-2xl font-bold text-brand-300 2xl:text-3xl">{formatCurrency(total)}</p>

        <div className="relative mt-4">
          <StickyNote size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <Input
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Observação (opcional)"
            className="border-neutral-700 bg-neutral-800 pl-9 text-white placeholder:text-neutral-500"
          />
        </div>

        {variant === 'popover' && (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={loading}
            onClick={onConfirm}
            className="mt-5 min-h-11 normal-case"
          >
            {loading ? 'Adicionando...' : `Adicionar ${quantity}x à comanda`}
          </Button>
        )}
      </div>

      {variant === 'sheet' && (
        <div className="shrink-0 border-t border-neutral-700 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={loading}
            onClick={onConfirm}
            className="min-h-11 normal-case"
          >
            {loading ? 'Adicionando...' : `Adicionar ${quantity}x à comanda`}
          </Button>
        </div>
      )}
    </>
  );

  if (!mounted) return null;

  const panelClass =
    'w-full overflow-hidden rounded-2xl border border-neutral-700 shadow-[0_24px_64px_rgba(0,0,0,0.65)]';
  const panelStyle = { backgroundColor: '#141414' } as const;

  const ui =
    variant === 'popover' ? (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/92 backdrop-blur-[3px]"
          aria-label="Fechar"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: 'spring', damping: 28, stiffness: 360 }}
          className={clsx(panelClass, 'relative z-10 max-w-md 2xl:max-w-lg')}
          style={panelStyle}
        >
          {content}
        </motion.div>
      </div>
    ) : (
      <div className="fixed inset-0 z-[110]">
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/88 backdrop-blur-[2px]"
          aria-label="Fechar"
        />
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 340 }}
          className={clsx(
            panelClass,
            'absolute inset-x-0 bottom-0 rounded-b-none sm:mx-auto sm:max-w-md sm:rounded-t-2xl'
          )}
          style={panelStyle}
        >
          {content}
        </motion.div>
      </div>
    );

  return createPortal(ui, document.body);
}

function ProductGrid({
  products: list,
  gridClass,
  compact,
  addingId,
  onPick,
}: {
  products: PosProduct[];
  gridClass: string;
  compact: boolean;
  addingId?: string | null;
  onPick: (product: PosProduct) => void;
}) {
  return (
    <div className={gridClass}>
      {list.map((product) => (
        <ProductTile
          key={product.id}
          product={product}
          compact={compact}
          loading={addingId === product.id}
          onPick={() => onPick(product)}
        />
      ))}
    </div>
  );
}

export function PosProductPicker({
  products,
  categories,
  onSelect,
  onUnavailable,
  addingId,
  notes,
  onNotesChange,
  compact = false,
}: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [pendingProduct, setPendingProduct] = useState<PosProduct | null>(null);
  const [pickQuantity, setPickQuantity] = useState(1);

  const normalizedSearch = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = !normalizedSearch || product.name.toLowerCase().includes(normalizedSearch);
      const matchesCategory = !activeCategory || product.category_id === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, normalizedSearch, activeCategory]);

  const grouped = useMemo(() => {
    if (activeCategory || normalizedSearch) return null;

    const map = categories
      .map((cat) => ({
        category: cat,
        products: products.filter((p) => p.category_id === cat.id),
      }))
      .filter((g) => g.products.length > 0);

    const uncategorized = products.filter((p) => !p.category_id);
    return { map, uncategorized };
  }, [categories, products, activeCategory, normalizedSearch]);

  const gridClass = compact
    ? 'grid grid-cols-1 gap-2'
    : 'grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 min-[1920px]:grid-cols-4 min-[2560px]:grid-cols-5';

  const openPick = (product: PosProduct) => {
    if (product.is_available === false) {
      onUnavailable?.(product);
      return;
    }
    setPickQuantity(1);
    setPendingProduct(product);
  };

  const closePick = () => {
    setPendingProduct(null);
    setPickQuantity(1);
  };

  const confirmPick = async () => {
    if (!pendingProduct) return;
    await onSelect(pendingProduct, pickQuantity);
    closePick();
  };

  const toolbar = (
    <div className="min-w-0 shrink-0 space-y-3">
      <ListSearchBar value={search} onChange={setSearch} placeholder="Buscar no cardápio..." className="max-w-none w-full" />

      {categories.length > 0 && (
        <CategoryScrollBar
          categories={categories}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />
      )}
    </div>
  );

  const productList = (
    <>
      {grouped ? (
        <div className="space-y-5">
          {grouped.map.map(({ category, products: catProducts }) => (
            <div key={category.id}>
              <h4 className="mb-3 font-serif text-base font-bold text-ink">{category.name}</h4>
              <ProductGrid
                products={catProducts}
                gridClass={gridClass}
                compact={compact}
                addingId={addingId}
                onPick={openPick}
              />
            </div>
          ))}
          {grouped.uncategorized.length > 0 && (
            <div>
              <h4 className="mb-3 font-serif text-base font-bold text-ink">Outros</h4>
              <ProductGrid
                products={grouped.uncategorized}
                gridClass={gridClass}
                compact={compact}
                addingId={addingId}
                onPick={openPick}
              />
            </div>
          )}
        </div>
      ) : (
        <ProductGrid
          products={filtered}
          gridClass={gridClass}
          compact={compact}
          addingId={addingId}
          onPick={openPick}
        />
      )}

      {!filtered.length && (activeCategory || normalizedSearch) && (
        <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-neutral-500">
          Nenhum produto encontrado.
        </p>
      )}

      {!products.length && (
        <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-neutral-500">
          Cadastre produtos no cardápio para lançar na mesa.
        </p>
      )}
    </>
  );

  const sheet = (
    <AnimatePresence mode="wait">
      {pendingProduct && (
        <AddQuantitySheet
          key={pendingProduct.id}
        product={pendingProduct}
        quantity={pickQuantity}
        onQuantityChange={setPickQuantity}
        notes={notes}
        onNotesChange={onNotesChange}
        onConfirm={confirmPick}
        onClose={closePick}
        loading={addingId === pendingProduct.id}
        variant="popover"
        />
      )}
    </AnimatePresence>
  );

  if (compact) {
    return (
      <div className="relative flex h-full min-h-0 max-w-full flex-col overflow-hidden">
        {toolbar}
        <div
          className={clsx(
            'mt-3 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain pb-2 [-webkit-overflow-scrolling:touch]',
            pendingProduct && 'pb-56'
          )}
        >
          {productList}
        </div>
        {sheet}
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {toolbar}
      <div
        className={clsx(
          'mt-3 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain pb-2 [-webkit-overflow-scrolling:touch] xl:mt-4',
          pendingProduct && 'pb-4'
        )}
      >
        {productList}
      </div>
      {sheet}
    </div>
  );
}
