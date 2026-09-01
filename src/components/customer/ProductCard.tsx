'use client';

import Image from 'next/image';
import clsx from 'clsx';
import { formatCurrency } from '@/lib/utils/format';
import type { Product } from '@/lib/types/database';

interface Props {
  product: Product;
  onSelect: (product: Product) => void;
  index?: number;
  variant?: 'grid' | 'carousel';
}

const CARD_CLASS =
  'group overflow-hidden rounded-2xl border border-border bg-surface-elevated text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-400/40 hover:shadow-glow disabled:opacity-50';

export function ProductCard({ product, onSelect, index = 0, variant = 'grid' }: Props) {
  const hasPromo = product.promo_price != null && product.promo_price < product.price;
  const displayPrice = hasPromo ? product.promo_price! : product.price;

  if (variant === 'carousel') {
    return (
      <button
        onClick={() => onSelect(product)}
        disabled={!product.is_available}
        style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
        className={clsx(CARD_CLASS, 'w-[9.5rem] shrink-0 snap-start animate-fade-in-up sm:w-[10.5rem]')}
      >
        <div className="relative h-28 w-full overflow-hidden bg-neutral-900">
          {product.image_url ? (
            <Image src={product.image_url} alt={product.name} fill sizes="168px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <span className="flex h-full items-center justify-center font-serif text-2xl text-brand-400">+</span>
          )}
        </div>
        <div className="space-y-1 p-3">
          <h3 className="line-clamp-2 min-h-[2.5rem] font-serif text-sm font-bold leading-tight text-ink">{product.name}</h3>
          <div className="flex items-center justify-between gap-1">
            <span className="text-sm font-black text-brand-300">{formatCurrency(displayPrice)}</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-400 text-sm font-bold text-neutral-950">+</span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() => onSelect(product)}
      disabled={!product.is_available}
      style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}
      className={clsx(
        CARD_CLASS,
        'relative flex w-full gap-3 p-2 duration-200 animate-fade-in-up active:scale-[0.99] disabled:hover:translate-y-0'
      )}
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-900 sm:h-24 sm:w-24">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(min-width: 640px) 96px, 80px"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <span className="flex h-full items-center justify-center font-serif text-2xl text-brand-400">+</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col py-0.5 pr-1">
        <h3 className="line-clamp-1 font-serif text-base font-bold leading-tight text-ink">{product.name}</h3>
        {product.description && (
          <p className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-neutral-400">{product.description}</p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
          <div className="min-w-0">
            {hasPromo && <span className="mr-1 text-xs text-neutral-500 line-through">{formatCurrency(product.price)}</span>}
            <span className="text-sm font-black text-brand-300">{formatCurrency(displayPrice)}</span>
          </div>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-400 text-lg leading-none text-neutral-950 transition-transform group-hover:rotate-90">
            +
          </span>
        </div>
        {!product.is_available && <span className="mt-1 block text-xs font-medium text-red-400">Indisponível</span>}
      </div>
    </button>
  );
}
