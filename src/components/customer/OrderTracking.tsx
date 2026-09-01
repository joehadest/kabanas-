'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/format';
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABEL, type Order, type OrderStatus } from '@/lib/types/database';

const STEP_DESCRIPTION: Record<Exclude<OrderStatus, 'cancelled'>, string> = {
  received: 'A loja recebeu o seu pedido.',
  preparing: 'Sua comida está sendo preparada com carinho.',
  out_for_delivery: 'O entregador está a caminho do seu endereço.',
  delivered: 'Pedido entregue. Bom apetite!',
};

export function OrderTracking({ initialOrder }: { initialOrder: Order }) {
  const [order, setOrder] = useState(initialOrder);
  const [justUpdated, setJustUpdated] = useState(false);
  const supabase = useRef(createClient()).current;

  useEffect(() => {
    const channel = supabase
      .channel(`order-${initialOrder.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${initialOrder.id}` },
        (payload) => {
          setOrder((prev) => ({ ...prev, ...(payload.new as Order) }));
          setJustUpdated(true);
          setTimeout(() => setJustUpdated(false), 1000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialOrder.id, supabase]);

  if (order.status === 'cancelled') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center animate-fade-in">
        <p className="text-lg font-bold text-red-500 mb-1">Pedido cancelado</p>
        <p className="text-sm text-neutral-500">O pedido #{order.order_code} foi cancelado.</p>
      </div>
    );
  }

  const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);

  return (
    <div className="min-h-screen bg-black pb-8 text-ink">
      <header className="border-b border-white/10 bg-black px-4 pb-8 pt-6 safe-top">
        <div className="max-w-xl mx-auto">
          <p className="text-xs text-neutral-400">Pedido #{order.order_code}</p>
          <h1
            key={order.status}
            className={clsx('text-xl font-bold mt-1 text-brand-400', justUpdated && 'animate-pop')}
          >
            {ORDER_STATUS_LABEL[order.status]}
          </h1>
          <p className="text-sm text-neutral-300 mt-1">{STEP_DESCRIPTION[order.status as keyof typeof STEP_DESCRIPTION]}</p>
        </div>
      </header>

      <div className="px-4 -mt-4 max-w-xl mx-auto">
        <div className="card p-4 animate-fade-in-up">
          <ol className="space-y-0">
            {ORDER_STATUS_FLOW.map((status, idx) => {
              const isDone = idx <= currentIndex;
              const isCurrent = idx === currentIndex;
              const isLast = idx === ORDER_STATUS_FLOW.length - 1;
              return (
                <li key={status} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={clsx(
                        'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors duration-300',
                        isDone ? 'bg-brand-500 text-ink' : 'bg-neutral-800 text-neutral-400',
                        isCurrent && 'ring-4 ring-brand-400/25'
                      )}
                    >
                      {isDone ? '✓' : idx + 1}
                    </span>
                    {!isLast && (
                      <span
                        className={clsx('w-0.5 flex-1 min-h-[28px] transition-colors duration-300', isDone ? 'bg-brand-500' : 'bg-neutral-800')}
                      />
                    )}
                  </div>
                  <div className="pb-6">
                    <p className={clsx('text-sm font-medium', isDone ? 'text-ink' : 'text-neutral-400')}>
                      {ORDER_STATUS_LABEL[status]}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="card mt-4 p-4 animate-fade-in-up [animation-delay:80ms]">
          <h2 className="font-semibold text-sm text-neutral-200 mb-2">Itens do pedido</h2>
          <ul className="space-y-1.5">
            {order.items?.map((item) => (
              <li key={item.id} className="flex justify-between text-sm">
                <span className="text-neutral-400">
                  {item.quantity}x {item.product_name}
                </span>
                <span className="text-ink font-medium">{formatCurrency(item.total_price)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between text-sm font-bold text-ink pt-3 mt-2 border-t border-border">
            <span>Total</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>

        {order.address && (
          <div className="card mt-4 p-4 animate-fade-in-up [animation-delay:140ms]">
            <h2 className="font-semibold text-sm text-neutral-200 mb-1">Endereço de entrega</h2>
            <p className="text-sm text-neutral-500">
              {order.address.street}, {order.address.number} — {order.address.neighborhood}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
