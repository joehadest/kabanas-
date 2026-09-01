'use client';

import clsx from 'clsx';
import type { Category } from '@/lib/types/database';

interface Props {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}

const TAB_BASE =
  'shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-all duration-200 active:scale-95';
const TAB_ACTIVE = 'bg-brand-400 text-neutral-950 shadow-sm';
const TAB_INACTIVE = 'bg-white/10 text-neutral-300 hover:bg-white/15 hover:text-white';

export function CategoryTabs({ categories, activeId, onSelect }: Props) {
  return (
    <div className="relative border-b border-white/10 bg-black">
      {/* Fade nas bordas — indica scroll horizontal */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-black to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-black to-transparent" />

      <div
        className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 sm:px-8 scrollbar-none snap-x snap-mandatory"
        role="tablist"
        aria-label="Categorias do cardápio"
      >
        <button
          role="tab"
          aria-selected={activeId === null}
          onClick={() => onSelect(null)}
          className={clsx(TAB_BASE, 'snap-start', activeId === null ? TAB_ACTIVE : TAB_INACTIVE)}
        >
          Tudo
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            role="tab"
            aria-selected={activeId === cat.id}
            onClick={() => onSelect(cat.id)}
            className={clsx(TAB_BASE, 'snap-start', activeId === cat.id ? TAB_ACTIVE : TAB_INACTIVE)}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}
