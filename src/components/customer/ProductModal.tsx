'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import { Check, Info, Minus, Plus, UtensilsCrossed } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { useCartStore, type CartItemOption } from '@/lib/store/cart-store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import type { Product, ProductOptionGroup } from '@/lib/types/database';

interface Props {
  product: Product;
  onClose: () => void;
  orderingEnabled?: boolean;
}

const minimum = (group: ProductOptionGroup) => group.is_required ? Math.max(1, group.min_select) : group.min_select;

function selectionHint(group: ProductOptionGroup) {
  const min = minimum(group);
  if (group.max_select === 1) return 'Escolha 1 opção';
  if (min === group.max_select) return `Escolha ${min} opções`;
  if (group.is_required && min > 1) return `Escolha de ${min} a ${group.max_select} opções`;
  return `Escolha até ${group.max_select} opções`;
}

export function ProductModal({ product, onClose, orderingEnabled = true }: Props) {
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const groups = product.option_groups ?? [];
  const hasPromo = product.promo_price != null && product.promo_price < product.price;
  const basePrice = hasPromo ? product.promo_price! : product.price;

  const toggleOption = (group: ProductOptionGroup, optionId: string) => {
    setSelected((previous) => {
      const current = previous[group.id] ?? [];
      if (current.includes(optionId)) return { ...previous, [group.id]: current.filter((id) => id !== optionId) };
      if (group.max_select === 1) return { ...previous, [group.id]: [optionId] };
      if (current.length >= group.max_select) return previous;
      return { ...previous, [group.id]: [...current, optionId] };
    });
  };

  const missingGroup = groups.find((group) => {
    const count = selected[group.id]?.length ?? 0;
    return (group.is_required || count > 0) && count < minimum(group);
  });

  const selectedOptions: CartItemOption[] = useMemo(() => groups.flatMap((group) =>
    group.options.filter((option) => option.is_active && (selected[group.id] ?? []).includes(option.id))
      .map((option) => ({ optionId: option.id, name: option.name, price: option.price }))
  ), [groups, selected]);
  const unitTotal = basePrice + selectedOptions.reduce((sum, option) => sum + option.price, 0);

  const handleAdd = () => {
    if (missingGroup || !product.is_available) return;
    // Mantém o preço do carrinho igual ao preço apresentado no cardápio.
    addItem({ ...product, promo_price: hasPromo ? product.promo_price : null }, selectedOptions, quantity, notes.trim() || undefined);
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      title={product.name}
      subtitle={orderingEnabled ? 'Monte seu pedido' : 'Detalhes do item'}
      size="lg"
      trapFocus
      className="font-sans sm:max-h-[90dvh]"
      headerClassName="[&_h2]:font-sans [&_h2]:text-lg [&_h2]:leading-snug sm:[&_h2]:text-xl [&>div:first-child]:pr-10"
      bodyClassName="p-0 sm:p-0"
      footerClassName="px-4 sm:px-5"
      footer={orderingEnabled ? (
        <div className="space-y-2.5">
          {missingGroup && <p id="product-selection-hint" className="text-xs leading-relaxed text-brand-300" role="status">Selecione as opções de “{missingGroup.name}” para continuar.</p>}
          <div className="flex items-center gap-3">
            <div className="flex h-12 shrink-0 items-center rounded-xl border border-white/10 bg-white/5">
              <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity === 1} aria-label="Diminuir quantidade" className="flex h-12 w-11 items-center justify-center rounded-l-xl text-neutral-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:text-neutral-600"><Minus size={16} /></button>
              <span className="min-w-5 text-center text-sm font-semibold tabular-nums" aria-live="polite" aria-label={`Quantidade: ${quantity}`}>{quantity}</span>
              <button type="button" onClick={() => setQuantity((value) => value + 1)} aria-label="Aumentar quantidade" className="flex h-12 w-11 items-center justify-center rounded-r-xl text-neutral-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"><Plus size={16} /></button>
            </div>
            <Button variant="brand" size="lg" fullWidth onClick={handleAdd} disabled={Boolean(missingGroup) || !product.is_available} aria-describedby={missingGroup ? 'product-selection-hint' : undefined} className="min-w-0 flex-1 flex-col gap-0 px-2 normal-case tracking-normal">
              <span className="text-xs">Adicionar ao pedido</span>
              <span className="text-sm tabular-nums">{formatCurrency(unitTotal * quantity)}</span>
            </Button>
          </div>
        </div>
      ) : <Button variant="secondary" size="lg" fullWidth onClick={onClose} className="normal-case tracking-normal">Voltar ao cardápio</Button>}
    >
      {product.image_url ? (
        <Image
          src={product.image_url}
          alt={product.name}
          width={640}
          height={640}
          sizes="(min-width: 640px) 512px, 100vw"
          className="block h-auto w-full"
          loading="eager"
        />
      ) : (
        <div className="flex h-48 items-center justify-center bg-gradient-to-br from-brand-400/10 to-neutral-900 sm:h-56"><UtensilsCrossed size={48} strokeWidth={1} className="text-brand-300/40" aria-hidden="true" /></div>
      )}
      <div className="space-y-5 px-4 py-5 sm:px-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="text-xl font-bold tabular-nums text-brand-300">{formatCurrency(basePrice)}</p>
            {hasPromo && <span className="text-sm text-neutral-500 line-through">{formatCurrency(product.price)}</span>}
            {hasPromo && <span className="rounded-md bg-brand-400/10 px-2 py-1 text-[10px] font-semibold text-brand-300">Oferta</span>}
          </div>
          {product.description && <p className="mt-2 text-sm leading-relaxed text-neutral-300">{product.description}</p>}
        </div>
        {orderingEnabled ? (
          <>
            {groups.map((group) => {
              const count = selected[group.id]?.length ?? 0;
              const complete = count >= minimum(group) && count > 0;
              return (
                <fieldset key={group.id} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4" aria-describedby={`hint-${group.id}`}>
                  <legend className="px-1 text-sm font-semibold text-ink sm:text-base">{group.name}</legend>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p id={`hint-${group.id}`} className="text-xs text-neutral-400">{selectionHint(group)} · {count}/{group.max_select}</p>
                    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold', complete ? 'bg-emerald-400/10 text-emerald-300' : group.is_required ? 'bg-brand-400/10 text-brand-300' : 'bg-white/5 text-neutral-400')}>
                      {complete && <Check size={12} aria-hidden="true" />}{complete ? 'Selecionado' : group.is_required ? 'Obrigatório' : 'Opcional'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.options.map((option) => {
                      const isSelected = (selected[group.id] ?? []).includes(option.id);
                      const atLimit = group.max_select !== 1 && count >= group.max_select && !isSelected;
                      const disabled = !option.is_active || atLimit;
                      return (
                        <label key={option.id} className={clsx('flex min-h-14 items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors', isSelected ? 'border-brand-400/60 bg-brand-400/10' : 'border-white/10 bg-neutral-950 hover:border-white/20', disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer')}>
                          <input type="checkbox" checked={isSelected} disabled={disabled} onChange={() => toggleOption(group, option.id)} className={clsx('h-5 w-5 shrink-0 cursor-inherit accent-brand-400', group.max_select === 1 && 'rounded-full')} />
                          <span className="min-w-0 flex-1 break-words leading-snug text-neutral-200">{option.name}{!option.is_active && <span className="mt-1 block text-xs text-neutral-500">Indisponível</span>}</span>
                          <span className={clsx('shrink-0 text-xs tabular-nums', isSelected ? 'text-brand-300' : 'text-neutral-400')}>{option.price > 0 ? `+ ${formatCurrency(option.price)}` : 'Incluso'}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
            <div className="border-t border-white/10 pt-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="product-notes" className="text-sm font-semibold text-ink">Alguma observação?</label>
                <span className="text-xs text-neutral-500">Opcional</span>
              </div>
              <Textarea id="product-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: sem cebola, molho à parte…" rows={3} maxLength={500} className="text-base sm:text-sm" />
            </div>
          </>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-brand-400/15 bg-brand-400/5 p-4 text-sm leading-relaxed text-neutral-300">
            <Info size={18} className="mt-0.5 shrink-0 text-brand-300" aria-hidden="true" />
            <p>Gostou deste item? Peça ao garçom para adicionar à sua conta.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
