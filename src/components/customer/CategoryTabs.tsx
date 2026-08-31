'use client';

import clsx from 'clsx';
import type { Category } from '@/lib/types/database';

interface Props {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}

const TAB_BASE =
  'shrink-0 border-b-2 px-1 py-2 text-sm font-bold transition-all duration-200 active:scale-95';
const TAB_ACTIVE = 'border-brand-400 text-brand-400';
const TAB_INACTIVE = 'border-transparent text-neutral-400 hover:border-white/30 hover:text-white';

export function CategoryTabs({ categories, activeId, onSelect }: Props) {
  return (
    <div className="border-b border-white/10 bg-[#171612]">
      <div className="mx-auto flex max-w-6xl gap-6 overflow-x-auto px-4 sm:px-8 scrollbar-none">
        <button onClick={() => onSelect(null)} className={clsx(TAB_BASE, activeId === null ? TAB_ACTIVE : TAB_INACTIVE)}>
          Tudo
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={clsx(TAB_BASE, activeId === cat.id ? TAB_ACTIVE : TAB_INACTIVE)}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}
