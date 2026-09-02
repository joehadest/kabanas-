'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import { formatCurrency } from '@/lib/utils/format';
import { useCartStore, type CartItemOption } from '@/lib/store/cart-store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Modal, ModalSection } from '@/components/ui/modal';
import type { Product } from '@/lib/types/database';

interface Props {
  product: Product;
  onClose: () => void;
}

export function ProductModal({ product, onClose }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState<Record<string, string[]>>({});

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
    <Modal
      onClose={onClose}
      title={product.name}
      subtitle="Prepare do seu jeito"
      description={product.description ?? undefined}
      size="md"
      bodyClassName="space-y-4 px-0 py-0 sm:px-0"
      hero={
        <div className="relative h-48 w-full shrink-0 bg-neutral-800 sm:h-52">
          {product.image_url ? (
            <Image src={product.image_url} alt={product.name} fill className="object-cover" priority />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
              <span className="font-serif text-5xl font-bold text-ink/20">K</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
          <p className="absolute bottom-3 left-5 rounded-lg bg-brand-400 px-3 py-1.5 text-lg font-black text-neutral-950 shadow-sm">
            {formatCurrency(basePrice)}
          </p>
        </div>
      }
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-sm sm:w-auto">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-11 w-12 items-center justify-center text-lg text-neutral-400 transition-colors hover:bg-brand-400/15"
              aria-label="Diminuir"
            >
              −
            </button>
            <span className="w-10 text-center font-semibold">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-11 w-12 items-center justify-center text-lg text-neutral-400 transition-colors hover:bg-brand-400/15"
              aria-label="Aumentar"
            >
              +
            </button>
          </div>
          <Button variant="brand" size="lg" fullWidth onClick={handleAdd} disabled={missingRequired} className="min-h-11 normal-case">
            Adicionar · {formatCurrency(unitTotal * quantity)}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-5 pb-5 sm:px-6">
        {groups.map((group) => (
          <ModalSection key={group.id} title={group.name}>
            {group.is_required && (
              <p className="mb-3 inline-block rounded-lg bg-brand-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-300">
                Obrigatório
              </p>
            )}
            <div className="space-y-2">
              {group.options.map((opt) => {
                const isSelected = (selected[group.id] ?? []).includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    disabled={!opt.is_active}
                    onClick={() => toggleOption(group.id, opt.id, group.max_select)}
                    className={clsx(
                      'option-chip',
                      isSelected ? 'option-chip-selected' : 'option-chip-default',
                      !opt.is_active && 'opacity-40'
                    )}
                  >
                    <span className="text-neutral-200">{opt.name}</span>
                    <span className="flex items-center gap-2">
                      {opt.price > 0 && <span className="text-xs text-neutral-500">+ {formatCurrency(opt.price)}</span>}
                      <span
                        className={clsx(
                          'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors',
                          isSelected ? 'border-brand-500 bg-brand-500' : 'border-neutral-600'
                        )}
                      >
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" />}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </ModalSection>
        ))}

        <ModalSection title="Observações">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: sem cebola, ponto da carne, etc."
            rows={2}
          />
        </ModalSection>
      </div>
    </Modal>
  );
}
