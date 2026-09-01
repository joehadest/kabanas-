'use client';

import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ChevronDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export const DEFAULT_LIST_LIMIT = 8;

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  count?: number;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  subtitle,
  count,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  actions,
  children,
  className,
}: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const toggle = () => {
    const next = !open;
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };

  return (
    <section className={cn('overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-card', className)}>
      <div className="flex items-start gap-2 border-b border-border bg-black/40 p-4">
        <button
          type="button"
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <ChevronDown
            size={18}
            className={clsx('shrink-0 text-neutral-400 transition-transform', open && 'rotate-180')}
          />
          <div className="min-w-0">
            <h2 className="truncate font-serif text-lg font-bold text-ink">{title}</h2>
            {(subtitle || count !== undefined) && (
              <p className="text-xs text-neutral-500">
                {subtitle}
                {subtitle && count !== undefined ? ' · ' : ''}
                {count !== undefined ? `${count} item${count !== 1 ? 's' : ''}` : ''}
              </p>
            )}
          </div>
        </button>
        {actions && <div className="flex shrink-0 gap-1">{actions}</div>}
      </div>
      {open && <div className="p-4">{children}</div>}
    </section>
  );
}

export function ListSearchBar({
  value,
  onChange,
  placeholder = 'Buscar...',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative max-w-md flex-1', className)}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
  );
}

export function ExpandCollapseControls({
  onExpandAll,
  onCollapseAll,
  className,
}: {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-2 text-xs font-bold uppercase tracking-wide', className)}>
      <button type="button" onClick={onExpandAll} className="text-brand-300 hover:underline">
        Expandir tudo
      </button>
      <span className="text-neutral-300">·</span>
      <button type="button" onClick={onCollapseAll} className="text-neutral-500 hover:underline">
        Recolher
      </button>
    </div>
  );
}

export function ShowMoreToggle({
  hiddenCount,
  showingAll,
  onToggle,
  className,
}: {
  hiddenCount: number;
  showingAll: boolean;
  onToggle: () => void;
  className?: string;
}) {
  if (hiddenCount <= 0 && !showingAll) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'col-span-full rounded-xl border border-dashed border-border py-2.5 text-xs font-bold uppercase tracking-wide text-neutral-500 transition-colors hover:border-brand-400 hover:text-brand-300',
        className
      )}
    >
      {showingAll ? 'Mostrar menos' : `Ver mais ${hiddenCount} item${hiddenCount > 1 ? 's' : ''}`}
    </button>
  );
}

/** Retorna itens visíveis e helpers para "ver mais" */
export function useLimitedList<T>(items: T[], limit = DEFAULT_LIST_LIMIT, forceShowAll = false) {
  const [showAll, setShowAll] = useState(false);
  const expanded = forceShowAll || showAll;
  const visible = expanded ? items : items.slice(0, limit);
  const hiddenCount = Math.max(0, items.length - limit);

  return {
    visible,
    showAll: expanded,
    hiddenCount,
    toggle: () => setShowAll((v) => !v),
    hasMore: items.length > limit,
  };
}
