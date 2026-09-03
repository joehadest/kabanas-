'use client';

import clsx from 'clsx';
import type { Category } from '@/lib/types/database';

interface Props {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}

const TAB_BASE =
  'shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold transition-all duration-200 active:scale-95 sm:px-4 sm:py-2';
const TAB_ACTIVE = 'bg-brand-400 text-neutral-950 shadow-sm';
const TAB_INACTIVE = 'bg-white/10 text-neutral-300 hover:bg-white/15 hover:text-white';

export function CategoryTabs({ categories, activeId, onSelect }: Props) {
  return (
    <div className="border-b border-white/10 bg-kabanas-charcoal/95 backdrop-blur-xl">
      {/*
        Inset à esquerda no container FIXO (não no overflow).
        Padding dentro de overflow-x é ignorado em vários browsers mobile.
      */}
      <div className="mx-auto max-w-6xl pl-4 sm:pl-8">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-kabanas-charcoal to-transparent" />

          <div
            className="overflow-x-auto scrollbar-none snap-x snap-mandatory"
            role="tablist"
            aria-label="Categorias do cardápio"
          >
            <div className="flex w-max gap-2 py-2.5 pr-6 sm:py-3 sm:pr-8">
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
        </div>
      </div>
    </div>
  );
}
