'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { formatCurrency, calculateDeliveryFee } from '@/lib/utils/format';
import { useCartStore } from '@/lib/store/cart-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import type { StoreSettings } from '@/lib/types/database';

interface Props {
  storeSettings: Pick<StoreSettings, 'delivery_fee_type' | 'delivery_fee_fixed' | 'delivery_fee_per_km' | 'min_order_value'>;
}

/** Botão flutuante que abre o drawer do carrinho */
export function FloatingCart({ storeSettings }: Props) {
  const [open, setOpen] = useState(false);
  const itemCount = useCartStore((s) => s.itemCount());
  const subtotal = useCartStore((s) => s.subtotal());

  if (itemCount === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 right-4 z-40 mx-auto flex h-14 max-w-md items-center justify-between rounded-2xl border border-brand-300/60 bg-brand-400 px-5 text-neutral-950 shadow-floating transition-all animate-bounce-in hover:bg-brand-300 hover:shadow-glow active:scale-[0.98] safe-bottom sm:bottom-6"
      >
        <span className="flex items-center gap-3 font-bold text-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 text-xs text-brand-300 animate-pop">
            {itemCount}
          </span>
          <ShoppingBag size={18} />
          Ver carrinho
        </span>
        <span className="font-black text-sm">{formatCurrency(subtotal)}</span>
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
  });
  const belowMinimum = cartSubtotal < storeSettings.min_order_value;
  const total = Math.max(0, cartSubtotal + deliveryFee - couponDiscount);

  const handleApplyCoupon = () => {
    setCouponError('Cupom inválido ou expirado.');
  };

  const goToCheckout = () => {
    onClose();
    router.push('/checkout');
  };

  return (
    <Modal
      onClose={onClose}
      title="Carrinho"
      subtitle="Seu pedido"
      description={`${items.length} ${items.length === 1 ? 'item' : 'itens'} no pedido`}
      size="md"
      bodyClassName="space-y-3"
      footer={
        <div className="space-y-3">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-neutral-500">
              <span>Subtotal</span>
              <span>{formatCurrency(cartSubtotal)}</span>
            </div>
            <div className="flex justify-between text-neutral-500">
              <span>Taxa de entrega</span>
              <span>{formatCurrency(deliveryFee)}</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-brand-400">
                <span>Desconto ({couponCode})</span>
                <span>− {formatCurrency(couponDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 font-serif text-lg font-bold text-ink">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {belowMinimum && (
            <p className="text-xs text-amber-700">
              Pedido mínimo de {formatCurrency(storeSettings.min_order_value)}. Adicione mais itens.
            </p>
          )}

          <Button variant="brand" size="lg" fullWidth onClick={goToCheckout} disabled={belowMinimum} className="normal-case">
            Continuar para finalizar
          </Button>
        </div>
      }
    >
      {items.map((item) => (
        <div key={item.cartItemId} className="card-muted flex gap-3 p-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-800">
            {item.imageUrl && <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-base font-bold text-ink">{item.name}</p>
            {item.options.length > 0 && (
              <p className="truncate text-xs text-neutral-500">{item.options.map((o) => o.name).join(', ')}</p>
            )}
            <p className="mt-1 text-sm font-bold text-ink">{formatCurrency(item.unitPrice * item.quantity)}</p>
          </div>
          <div className="flex h-fit items-center gap-1 overflow-hidden rounded-lg border border-border">
            <button
              onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
              className="flex h-8 w-8 items-center justify-center text-sm transition-colors hover:bg-brand-400/15"
            >
              −
            </button>
            <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
            <button
              onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
              className="flex h-8 w-8 items-center justify-center text-sm transition-colors hover:bg-brand-400/15"
            >
              +
            </button>
          </div>
        </div>
      ))}

      <div className="pt-2">
        <div className="flex gap-2">
          <Input
            value={couponInput}
            onChange={(e) => {
              setCouponInput(e.target.value.toUpperCase());
              setCouponError(null);
            }}
            placeholder="Cupom de desconto"
            className="uppercase"
          />
          {couponCode ? (
            <Button variant="secondary" size="md" onClick={removeCoupon}>
              Remover
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={handleApplyCoupon} className="shrink-0 bg-ink hover:bg-neutral-800">
              Aplicar
            </Button>
          )}
        </div>
        {couponError && <p className="mt-1.5 text-xs text-red-500 animate-fade-in">{couponError}</p>}
      </div>
    </Modal>
  );
}
