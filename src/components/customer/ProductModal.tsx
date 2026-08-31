'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import { formatCurrency } from '@/lib/utils/format';
import { useCartStore, type CartItemOption } from '@/lib/store/cart-store';
import type { Product } from '@/lib/types/database';

interface Props {
  product: Product;
  onClose: () => void;
}

export function ProductModal({ product, onClose }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState<Record<string, string[]>>({}); // groupId -> optionIds

  const groups = product.option_groups ?? [];

  const toggleOption = (groupId: string, optionId: string, max: number) => {
    setSelected((prev) => {
      const current = prev[groupId] ?? [];
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      const next = max === 1 ? [optionId] : [...current, optionId];
      return { ...prev, [groupId]: next.slice(-max) };
    });
  };

  const missingRequired = groups.some((g) => g.is_required && (selected[g.id]?.length ?? 0) < g.min_select);

  const selectedOptions: CartItemOption[] = useMemo(
    () =>
      groups.flatMap((g) =>
        (selected[g.id] ?? []).map((optId) => {
          const opt = g.options.find((o) => o.id === optId)!;
          return { optionId: opt.id, name: opt.name, price: opt.price };
        })
      ),
    [groups, selected]
  );

  const basePrice = product.promo_price ?? product.price;
  const unitTotal = basePrice + selectedOptions.reduce((sum, o) => sum + o.price, 0);

  const handleAdd = () => {
    if (missingRequired) return;
    addItem(product, selectedOptions, quantity, notes || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-[#171612]/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full flex-col overflow-y-auto bg-[#fcfaf5] shadow-[0_24px_60px_rgba(0,0,0,0.42)] animate-slide-up sm:max-w-md sm:animate-scale-in">
        <div className="relative h-56 w-full shrink-0 bg-[#e7dfd0]">
          {product.image_url ? (
            <Image src={product.image_url} alt={product.name} fill className="object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_center,#facc15_0,transparent_2%),radial-gradient(circle_at_center,#e7dfd0_0,transparent_24%,#d8cdbb_25%,#d8cdbb_27%,transparent_28%),linear-gradient(135deg,#f5f0e5,#ded3c1)]">
              <span className="font-serif text-7xl font-bold text-[#171612]/80">+</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#fcfaf5]/95 text-lg text-[#171612] shadow-lg transition-colors hover:bg-brand-400"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 p-5">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-700">Prepare do seu jeito</p>
            <h2 className="font-serif text-3xl font-bold leading-none text-[#171612]">{product.name}</h2>
            {product.description && <p className="mt-3 text-sm leading-relaxed text-neutral-600">{product.description}</p>}
            <p className="mt-3 inline-block border-b-2 border-brand-400 pb-1 text-lg font-black text-[#171612]">
              {formatCurrency(basePrice)}
            </p>
          </div>

          {groups.map((group) => (
            <div key={group.id}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-serif text-lg font-bold text-[#171612]">{group.name}</h3>
                {group.is_required && (
                  <span className="bg-brand-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-900">
                    Obrigatório
                  </span>
                )}
              </div>
              <div className="space-y-2 border-t border-[#ded6c6] pt-2">
                {group.options.map((opt) => {
                  const isSelected = (selected[group.id] ?? []).includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      disabled={!opt.is_active}
                      onClick={() => toggleOption(group.id, opt.id, group.max_select)}
                      className={clsx(
                        'flex w-full items-center justify-between border px-3 py-3 text-sm transition-all duration-150',
                        isSelected ? 'border-brand-500 bg-brand-50' : 'border-[#ded6c6] hover:border-brand-400',
                        !opt.is_active && 'opacity-40'
                      )}
                    >
                      <span className="text-neutral-800">{opt.name}</span>
                      <span className="flex items-center gap-2">
                        {opt.price > 0 && <span className="text-neutral-500">+ {formatCurrency(opt.price)}</span>}
                        <span
                          className={clsx(
                            'flex h-5 w-5 items-center justify-center rounded-full border',
                            isSelected ? 'border-brand-500 bg-brand-500' : 'border-neutral-300'
                          )}
                        >
                          {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" />}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <h3 className="mb-2 font-serif text-lg font-bold text-[#171612]">Alguma observacao?</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: sem cebola, ponto da carne, etc."
              rows={2}
              className="w-full resize-none border border-[#ded6c6] bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-brand-500"
            />
          </div>
          <div className="sticky bottom-0 flex items-center gap-3 border-t border-[#ded6c6] bg-[#fcfaf5] pt-4">
            <div className="flex items-center border border-[#171612] bg-white">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-10 w-9 text-lg text-neutral-600 transition-colors hover:bg-brand-200 hover:text-neutral-900"
                aria-label="Diminuir"
              >
                −
              </button>
              <span className="w-8 text-center font-medium">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="h-10 w-9 text-lg text-neutral-600 transition-colors hover:bg-brand-200 hover:text-neutral-900"
                aria-label="Aumentar"
              >
                +
              </button>
            </div>
            <button
              onClick={handleAdd}
              disabled={missingRequired}
              className="h-11 flex-1 bg-brand-400 text-sm font-black text-neutral-950 transition-all hover:bg-brand-300 hover:shadow-glow disabled:opacity-40 active:scale-[0.98]"
            >
              Adicionar · {formatCurrency(unitTotal * quantity)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
