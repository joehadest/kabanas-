'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import type { Category } from '@/lib/types/database';

interface Props {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}

const TAB_BASE = 'relative flex min-h-12 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-300 sm:px-3.5 sm:text-[13px]';

export function CategoryTabs({ categories, activeId, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const items = [{ id: null, name: 'Tudo' }, ...categories];

  const updateScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    setCanScrollLeft(container.scrollLeft > 2);
    setCanScrollRight(container.scrollWidth - container.clientWidth - container.scrollLeft > 2);
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const observer = new ResizeObserver(updateScroll);
    observer.observe(container);
    updateScroll();
    return () => observer.disconnect();
  }, [categories]);

  useEffect(() => {
    const container = scrollRef.current;
    const selected = container?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!container || !selected) return;
    const offset = selected.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft;
    container.scrollTo({ left: offset - (container.clientWidth - selected.offsetWidth) / 2, behavior: 'instant' });
  }, [activeId]);

  const scroll = (direction: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.scrollBy({ left: direction * container.clientWidth * 0.7, behavior: reducedMotion ? 'instant' : 'smooth' });
  };

  return (
    <>
      <nav className="mx-auto flex max-w-6xl items-center gap-2 px-4 pt-2 sm:px-8" aria-label="Categorias do cardápio">
        <button type="button" onClick={() => setPickerOpen(true)} aria-label="Ver todas as categorias" aria-expanded={pickerOpen} aria-haspopup="dialog" title="Ver todas as categorias" className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-brand-300 transition-colors hover:border-brand-400/40 hover:bg-brand-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300">
          <LayoutGrid size={18} strokeWidth={1.75} />
        </button>
        <div className="relative min-w-0 flex-1">
          {canScrollLeft && <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-surface to-transparent" />}
          <div ref={scrollRef} onScroll={updateScroll} className="overflow-x-auto scrollbar-none">
            <div className="flex w-max gap-1">
              {items.map((item) => <button key={item.id ?? 'all'} type="button" aria-pressed={activeId === item.id} onClick={() => onSelect(item.id)} className={clsx(TAB_BASE, activeId === item.id ? 'border-brand-400 bg-brand-400/5 text-brand-300' : 'border-transparent text-neutral-400 hover:border-white/20 hover:text-ink')}>
                {item.name}
              </button>)}
            </div>
          </div>
          {canScrollRight && <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-surface to-transparent" />}
        </div>
        {(canScrollLeft || canScrollRight) && <div className="mb-1 hidden shrink-0 items-center gap-1 sm:flex">
          <button type="button" onClick={() => scroll(-1)} disabled={!canScrollLeft} aria-label="Categorias anteriores" className="flex h-11 w-9 items-center justify-center rounded-lg text-neutral-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:opacity-25"><ChevronLeft size={18} /></button>
          <button type="button" onClick={() => scroll(1)} disabled={!canScrollRight} aria-label="Próximas categorias" className="flex h-11 w-9 items-center justify-center rounded-lg text-neutral-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:opacity-25"><ChevronRight size={18} /></button>
        </div>}
      </nav>
      {pickerOpen && <Modal title="Categorias" subtitle="Explore o cardápio" onClose={() => setPickerOpen(false)} trapFocus size="md" headerClassName="[&_h2]:font-sans" bodyClassName="space-y-2">
        {items.map((item) => <button key={item.id ?? 'all'} type="button" aria-pressed={activeId === item.id} onClick={() => { setPickerOpen(false); onSelect(item.id); }} className={clsx('flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300', activeId === item.id ? 'border-brand-400/40 bg-brand-400/10 text-brand-300' : 'border-white/10 bg-white/[0.03] text-neutral-200 hover:bg-white/5')}>
          <span>{item.id === null ? 'Cardápio completo' : item.name}</span>
          {activeId === item.id ? <Check size={18} aria-hidden="true" /> : <ChevronRight size={16} className="text-neutral-500" aria-hidden="true" />}
        </button>)}
      </Modal>}
    </>
  );
}
