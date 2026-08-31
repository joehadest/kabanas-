'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { formatCurrency, calculateDeliveryFee } from '@/lib/utils/format';
import { useCartStore } from '@/lib/store/cart-store';
import type { StoreSettings } from '@/lib/types/database';

interface Props {
  storeSettings: Pick<StoreSettings, 'delivery_fee_type' | 'delivery_fee_fixed' | 'delivery_fee_per_km' | 'min_order_value'>;
}

/** Botão flutuante que abre o drawer do carrinho (item 4 do briefing: catálogo + carrinho flutuante). */
export function FloatingCart({ storeSettings }: Props) {
  const [open, setOpen] = useState(false);
  const itemCount = useCartStore((s) => s.itemCount());
  const subtotal = useCartStore((s) => s.subtotal());

  if (itemCount === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 right-4 z-40 mx-auto flex h-14 max-w-md items-center justify-between border border-brand-300 bg-brand-400 px-4 text-neutral-950 shadow-[0_12px_28px_rgba(23,22,18,0.3)] transition-all animate-bounce-in hover:bg-brand-300 active:scale-[0.98] safe-bottom"
      >
        <span className="flex items-center gap-2 font-bold text-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-xs text-brand-300 animate-pop">
            {itemCount}
          </span>
          Ver carrinho
        </span>
        <span className="font-bold text-sm">{formatCurrency(subtotal)}</span>
      </button>

      {open && <CartDrawer storeSettings={storeSettings} onClose={() => setOpen(false)} />}
    </>
  );
}

function CartDrawer({ storeSettings, onClose }: Props & { onClose: () => void }) {
  const router = useRouter();
  const { items, updateQuantity, couponCode, couponDiscount, removeCoupon, subtotal } = useCartStore();
  const [couponInput, setCouponInput] = useState(couponCode ?? '');
  const [couponError, setCouponError] = useState<string | null>(null);

  const cartSubtotal = subtotal();
  const deliveryFee = calculateDeliveryFee({
    feeType: storeSettings.delivery_fee_type,
    fixedFee: storeSettings.delivery_fee_fixed,
    perKmFee: storeSettings.delivery_fee_per_km,
    // distanceKm real é calculado no checkout, após o endereço ser escolhido
  });
  const belowMinimum = cartSubtotal < storeSettings.min_order_value;
  const total = Math.max(0, cartSubtotal + deliveryFee - couponDiscount);

  const handleApplyCoupon = () => {
    // TODO: validar via Supabase (tabela coupons) — aqui fica o placeholder de integração
    setCouponError('Cupom inválido ou expirado.');
  };

  const goToCheckout = () => {
    onClose();
    router.push('/checkout');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-[#171612]/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-md flex-col bg-[#fcfaf5] shadow-[0_-16px_50px_rgba(0,0,0,0.32)] animate-slide-up">
        <div className="flex items-center justify-between border-b border-[#ded6c6] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-700">Seu pedido</p>
            <h2 className="mt-1 font-serif text-2xl font-bold leading-none text-[#171612]">Carrinho</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-neutral-600 transition-colors hover:bg-brand-200"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {items.map((item) => (
            <div key={item.cartItemId} className="flex gap-3 border-b border-[#e7dfd0] pb-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden bg-[#e7dfd0]">
                {item.imageUrl && <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-serif text-base font-bold text-[#171612] line-clamp-1">{item.name}</p>
                {item.options.length > 0 && (
                  <p className="text-xs text-neutral-500 line-clamp-1">{item.options.map((o) => o.name).join(', ')}</p>
                )}
                <p className="mt-1 text-sm font-bold text-[#171612]">{formatCurrency(item.unitPrice * item.quantity)}</p>
              </div>
              <div className="flex items-center gap-1.5 h-fit">
                <button
                  onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                  className="h-7 w-7 border border-[#ded6c6] text-sm transition-colors hover:border-brand-500 hover:bg-brand-100"
                >
                  −
                </button>
                <span className="w-5 text-center text-sm">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                  className="h-7 w-7 border border-[#ded6c6] text-sm transition-colors hover:border-brand-500 hover:bg-brand-100"
                >
                  +
                </button>
              </div>
            </div>
          ))}

          <div className="pt-2">
            <div className="flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => {
                  setCouponInput(e.target.value.toUpperCase());
                  setCouponError(null);
                }}
                placeholder="Cupom de desconto"
                className="flex-1 border border-[#ded6c6] bg-white px-3 py-2 text-sm uppercase outline-none transition-colors focus:border-brand-500"
              />
              {couponCode ? (
                <button
                  onClick={removeCoupon}
                  className="border border-[#ded6c6] px-3 text-sm text-neutral-600 transition-colors hover:bg-brand-100"
                >
                  Remover
                </button>
              ) : (
                <button
                  onClick={handleApplyCoupon}
                  className="bg-[#171612] px-4 text-sm font-bold text-white transition-colors hover:bg-neutral-800"
                >
                  Aplicar
                </button>
              )}
            </div>
            {couponError && <p className="text-xs text-red-500 mt-1 animate-fade-in">{couponError}</p>}
          </div>
        </div>

        <div className="space-y-1.5 border-t border-[#ded6c6] bg-[#f5f0e5] px-5 py-4">
          <div className="flex justify-between text-sm text-neutral-500">
            <span>Subtotal</span>
            <span>{formatCurrency(cartSubtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-neutral-500">
            <span>Taxa de entrega</span>
            <span>{formatCurrency(deliveryFee)}</span>
          </div>
          {couponDiscount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Desconto ({couponCode})</span>
              <span>− {formatCurrency(couponDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-[#ded6c6] pt-3 font-serif text-lg font-bold text-[#171612]">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>

          {belowMinimum && (
            <p className="text-xs text-amber-600 pt-1">
              Pedido mínimo de {formatCurrency(storeSettings.min_order_value)}. Adicione mais itens para continuar.
            </p>
          )}

          <button
            onClick={goToCheckout}
            disabled={belowMinimum}
            className="mt-3 h-12 w-full bg-brand-400 font-black text-neutral-950 transition-all hover:bg-brand-300 hover:shadow-glow disabled:opacity-40 active:scale-[0.98] safe-bottom"
          >
            Continuar para finalizar
          </button>
        </div>
      </div>
    </div>
  );
}
