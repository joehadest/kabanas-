'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/lib/store/cart-store';
import { formatCurrency, calculateDeliveryFee } from '@/lib/utils/format';
import { AddressForm } from './AddressForm';
import type { Address, PaymentMethod, StoreSettings } from '@/lib/types/database';

interface Props {
  store: StoreSettings;
  addresses: Address[];
  userId: string | null;
  guestId: string | null;
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; hint: string }[] = [
  { value: 'pix', label: 'PIX', hint: 'Chave enviada após a confirmação' },
  { value: 'card_on_delivery', label: 'Cartão na entrega', hint: 'Débito ou crédito com a maquininha' },
  { value: 'cash', label: 'Dinheiro', hint: 'Informe se precisa de troco' },
];

export function CheckoutForm({ store, addresses, userId, guestId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { items, couponCode, couponDiscount, subtotal, clear } = useCartStore();

  const [addressList, setAddressList] = useState(addresses);
  const [addressId, setAddressId] = useState<string | null>(addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? null);
  const [showAddressForm, setShowAddressForm] = useState(addresses.length === 0);
  const [payment, setPayment] = useState<PaymentMethod>('pix');
  const [changeFor, setChangeFor] = useState('');
  const [notes, setNotes] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cartSubtotal = subtotal();
  const deliveryFee = calculateDeliveryFee({
    feeType: store.delivery_fee_type,
    fixedFee: store.delivery_fee_fixed,
    perKmFee: store.delivery_fee_per_km,
  });
  const total = Math.max(0, cartSubtotal + deliveryFee - couponDiscount);

  const generateOrderCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();

  const handleAddressSaved = (address: Address) => {
    setAddressList((prev) => [address, ...prev]);
    setAddressId(address.id);
    setShowAddressForm(false);
  };

  const handleSubmit = async () => {
    if (!addressId) {
      setError('Selecione um endereço de entrega.');
      return;
    }
    if (!userId && (!guestName.trim() || !guestPhone.trim())) {
      setError('Informe seu nome e telefone para contato.');
      return;
    }
    if (items.length === 0) {
      setError('Seu carrinho está vazio.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        store_id: store.id,
        user_id: userId,
        guest_id: userId ? null : guestId,
        guest_name: userId ? null : guestName.trim(),
        guest_phone: userId ? null : guestPhone.trim(),
        address_id: addressId,
        status: 'received',
        payment_method: payment,
        change_for: payment === 'cash' && changeFor ? Number(changeFor) : null,
        subtotal: cartSubtotal,
        delivery_fee: deliveryFee,
        discount: couponDiscount,
        total,
        notes: notes || null,
        order_code: generateOrderCode(),
      })
      .select('id')
      .single();

    if (orderError || !order) {
      setError('Não foi possível criar o pedido. Tente novamente.');
      setSubmitting(false);
      return;
    }

    const { data: insertedItems, error: itemsError } = await supabase
      .from('order_items')
      .insert(
        items.map((item) => ({
          order_id: order.id,
          product_id: item.productId,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.unitPrice * item.quantity,
          notes: item.notes ?? null,
        }))
      )
      .select('id');

    if (itemsError || !insertedItems) {
      setError('Pedido criado, mas houve um erro ao salvar os itens. Contate o suporte.');
      setSubmitting(false);
      return;
    }

    const optionRows = items.flatMap((item, idx) =>
      item.options.map((opt) => ({
        order_item_id: insertedItems[idx].id,
        option_name: opt.name,
        option_price: opt.price,
      }))
    );
    if (optionRows.length > 0) {
      await supabase.from('order_item_options').insert(optionRows);
    }

    clear();
    router.push(`/pedido/${order.id}`);
  };

  return (
    <div className="min-h-screen bg-[#f5f0e5] pb-36 text-[#171612]">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#171612]/95 px-4 pb-7 pt-[calc(env(safe-area-inset-top)+4rem)] text-white backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-300">Quase la</p>
            <h1 className="mt-1 font-serif text-2xl font-bold leading-none">Finalizar pedido</h1>
          </div>
          <span className="border border-brand-400/50 bg-brand-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-300">
            {items.length} {items.length === 1 ? 'item' : 'itens'}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-7 px-4 py-7">
        {!userId && (
          <section className="border-b border-[#ded6c6] pb-6 animate-fade-in-up">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-serif text-xl font-bold">Seus dados</h2>
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-700">Contato</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Seu nome"
                className="w-full border border-[#ded6c6] bg-[#fcfaf5] px-3.5 py-3 text-sm outline-none transition-colors focus:border-brand-500"
              />
              <input
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="Telefone (WhatsApp)"
                className="w-full border border-[#ded6c6] bg-[#fcfaf5] px-3.5 py-3 text-sm outline-none transition-colors focus:border-brand-500"
              />
            </div>
            <p className="mt-2 text-xs text-neutral-500">Usado somente para contato sobre este pedido.</p>
          </section>
        )}

        <section className="border-b border-[#ded6c6] pb-6 animate-fade-in-up">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-serif text-xl font-bold">Onde entregar?</h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-700">Entrega</span>
          </div>

          {addressList.length > 0 && (
            <div className="space-y-2 mb-2">
              {addressList.map((addr) => (
                <label
                  key={addr.id}
                  className={clsx(
                    'flex cursor-pointer items-start gap-3 border px-3.5 py-3.5 text-sm transition-colors',
                    addressId === addr.id && !showAddressForm
                      ? 'border-brand-500 bg-brand-100/50'
                      : 'border-[#ded6c6] bg-[#fcfaf5] hover:border-brand-400'
                  )}
                >
                  <input
                    type="radio"
                    name="address"
                    className="mt-1"
                    checked={addressId === addr.id && !showAddressForm}
                    onChange={() => {
                      setAddressId(addr.id);
                      setShowAddressForm(false);
                    }}
                  />
                  <span>
                    <span className="font-medium text-neutral-900 block">{addr.label}</span>
                    <span className="text-neutral-500">
                      {addr.street}, {addr.number} — {addr.neighborhood}, {addr.city}/{addr.state}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {showAddressForm ? (
            <AddressForm
              userId={userId}
              guestId={guestId}
              onSaved={handleAddressSaved}
              onCancel={addressList.length > 0 ? () => setShowAddressForm(false) : undefined}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowAddressForm(true)}
              className="w-full border border-dashed border-[#bcb19e] bg-[#fcfaf5] px-3.5 py-3 text-sm font-bold text-[#171612] transition-colors hover:border-brand-500 hover:bg-brand-100"
            >
              + Adicionar novo endereço
            </button>
          )}
        </section>

        <section className="border-b border-[#ded6c6] pb-6 animate-fade-in-up [animation-delay:60ms]">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-serif text-xl font-bold">Como prefere pagar?</h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-700">Pagamento</span>
          </div>
          <div className="space-y-2">
            {PAYMENT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={clsx(
                  'flex cursor-pointer items-center justify-between border px-3.5 py-3.5 text-sm transition-colors',
                  payment === opt.value ? 'border-brand-500 bg-brand-100/50' : 'border-[#ded6c6] bg-[#fcfaf5] hover:border-brand-400'
                )}
              >
                <span>
                  <span className="font-medium text-neutral-900 block">{opt.label}</span>
                  <span className="text-xs text-neutral-500">{opt.hint}</span>
                </span>
                <input type="radio" name="payment" checked={payment === opt.value} onChange={() => setPayment(opt.value)} />
              </label>
            ))}
          </div>
          {payment === 'cash' && (
            <input
              type="number"
              min={total}
              step="0.01"
              value={changeFor}
              onChange={(e) => setChangeFor(e.target.value)}
              placeholder={`Troco para quanto? (mín. ${formatCurrency(total)})`}
              className="mt-2 w-full border border-[#ded6c6] bg-[#fcfaf5] px-3.5 py-3 text-sm outline-none transition-colors animate-fade-in focus:border-brand-500"
            />
          )}
        </section>

        <section className="animate-fade-in-up [animation-delay:120ms]">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-serif text-xl font-bold">Algum recado?</h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-700">Opcional</span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Ex: interfone quebrado, deixar na portaria..."
            className="w-full resize-none border border-[#ded6c6] bg-[#fcfaf5] px-3.5 py-3 text-sm outline-none transition-colors focus:border-brand-500"
          />
        </section>

        <section className="space-y-2 border-y-2 border-[#171612] bg-brand-100/50 px-4 py-4 animate-fade-in-up [animation-delay:180ms]">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-700">Resumo do pedido</p>
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
          <div className="flex justify-between border-t border-[#bcb19e] pt-3 font-serif text-xl font-bold text-[#171612]">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </section>

        {error && <p className="text-sm text-red-500 animate-fade-in">{error}</p>}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-[#ded6c6]/70 bg-[#fcfaf5]/72 px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-5 backdrop-blur-xl">
        <div className="max-w-xl mx-auto">
          <button
            onClick={handleSubmit}
            disabled={submitting || !addressId || showAddressForm}
            className="h-13 w-full bg-brand-400 px-4 py-3 font-black text-neutral-950 shadow-[0_5px_0_#a16207] transition-all hover:bg-brand-300 hover:shadow-glow disabled:opacity-40 active:translate-y-0.5 active:shadow-none"
          >
            {submitting ? 'Enviando pedido...' : `Fazer meu pedido · ${formatCurrency(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
