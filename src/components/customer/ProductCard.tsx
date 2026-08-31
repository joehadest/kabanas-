'use client';

import Image from 'next/image';
import { formatCurrency } from '@/lib/utils/format';
import type { Product } from '@/lib/types/database';

interface Props {
  product: Product;
  onSelect: (product: Product) => void;
  index?: number;
}

export function ProductCard({ product, onSelect, index = 0 }: Props) {
  const hasPromo = product.promo_price != null && product.promo_price < product.price;
  const displayPrice = hasPromo ? product.promo_price! : product.price;

  return (
    <button
      onClick={() => onSelect(product)}
      disabled={!product.is_available}
      style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}
      className="group relative flex w-full gap-3 overflow-hidden border border-[#ded6c6] bg-[#fcfaf5] p-2 text-left shadow-[0_3px_0_rgba(23,22,18,0.08)] transition-all duration-200 animate-fade-in-up active:scale-[0.99] hover:-translate-y-1 hover:border-brand-500 hover:shadow-[0_13px_24px_rgba(23,22,18,0.15)] disabled:opacity-50 disabled:hover:translate-y-0"
    >
      <div className="relative h-24 w-24 shrink-0 overflow-hidden bg-[#e7dfd0] sm:h-28 sm:w-28">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(min-width: 640px) 112px, 96px"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <span className="flex h-full items-center justify-center font-serif text-3xl text-brand-700">+</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col py-1 pr-1">
        <h3 className="font-serif text-base font-bold leading-tight text-[#171612] line-clamp-1">
          {product.name}
        </h3>
        {product.description && (
          <p className="mt-1 text-xs leading-relaxed text-neutral-500 line-clamp-2">{product.description}</p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          {hasPromo && <span className="text-xs text-neutral-400 line-through">{formatCurrency(product.price)}</span>}
          <span className="text-sm font-black text-[#171612]">
            {formatCurrency(displayPrice)}
          </span>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-brand-400 text-lg leading-none text-neutral-950 transition-transform group-hover:rotate-90">+</span>
        </div>
        {!product.is_available && <span className="text-xs font-medium text-red-500 mt-1 block">Indisponível</span>}
      </div>
    </button>
  );
}
