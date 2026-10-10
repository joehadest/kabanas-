'use client';

import Image from 'next/image';
import { ChevronRight, Plus, UtensilsCrossed } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import type { Product } from '@/lib/types/database';

interface Props {
  product: Product;
  onSelect: (product: Product) => void;
  orderingEnabled?: boolean;
}

export function ProductCard({ product, onSelect, orderingEnabled = true }: Props) {
  const hasPromo = product.promo_price != null && product.promo_price < product.price;
  const displayPrice = hasPromo ? product.promo_price! : product.price;

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      disabled={!product.is_available}
      aria-label={`${product.name}, ${formatCurrency(displayPrice)}. Ver detalhes`}
      className="group flex w-full min-w-0 items-stretch gap-3 rounded-2xl border border-white/[0.08] bg-surface-elevated p-3 text-left transition-colors hover:border-brand-400/40 hover:bg-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:bg-neutral-800 disabled:opacity-50 sm:gap-4 sm:p-4"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="break-words text-sm font-semibold leading-snug text-ink sm:text-base">{product.name}</h3>
        {product.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-400 sm:text-sm">{product.description}</p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-3">
          <span className="text-sm font-bold tabular-nums text-brand-300 sm:text-base">{formatCurrency(displayPrice)}</span>
          {hasPromo && <span className="text-xs text-neutral-500 line-through">{formatCurrency(product.price)}</span>}
        </div>
        {!product.is_available && <span className="mt-1 text-xs text-red-400">Indisponível</span>}
      </div>
      <div className="relative h-24 w-24 shrink-0 self-center overflow-hidden rounded-xl bg-neutral-800 sm:h-28 sm:w-28">
        {product.image_url ? (
          <Image src={product.image_url} alt="" fill sizes="(min-width: 640px) 112px, 96px" className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-400/10 to-neutral-900">
            <UtensilsCrossed size={28} strokeWidth={1.25} className="text-brand-300/50" aria-hidden="true" />
          </div>
        )}
        <span className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-950/90 text-brand-300 shadow-sm backdrop-blur-sm" aria-hidden="true">
          {orderingEnabled ? <Plus size={18} /> : <ChevronRight size={18} />}
        </span>
      </div>
    </button>
  );
}
