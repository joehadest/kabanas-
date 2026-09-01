'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { OrderCard } from './OrderCard';
import { ORDER_STATUS_LABEL, type Order, type OrderStatus } from '@/lib/types/database';

const COLUMNS: OrderStatus[] = ['received', 'preparing', 'out_for_delivery', 'delivered'];

const COLUMN_DOT: Record<OrderStatus, string> = {
  received: 'bg-status-received',
  preparing: 'bg-status-preparing',
  out_for_delivery: 'bg-status-out_for_delivery',
  delivered: 'bg-status-delivered',
  cancelled: 'bg-status-cancelled',
};

interface Props {
  storeId: string;
  initialOrders: Order[];
}

export function KanbanBoard({ storeId, initialOrders }: Props) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const { orders, updateStatus } = useRealtimeOrders({ storeId, initialOrders, soundEnabled });
  const [flashNewOrder, setFlashNewOrder] = useState(false);
  const prevCount = useRef(orders.length);

  useEffect(() => {
    if (orders.length > prevCount.current) {
      setFlashNewOrder(true);
      const t = setTimeout(() => setFlashNewOrder(false), 1500);
      prevCount.current = orders.length;
      return () => clearTimeout(t);
    }
    prevCount.current = orders.length;
  }, [orders.length]);

  const activeOrders = orders.filter((o) => o.status !== 'cancelled');

  return (
    <div className="flex h-full flex-col bg-black">
      <div className="flex items-center justify-between border-b border-border bg-surface-elevated px-4 py-4 sm:px-7">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-300">Fila ao vivo</p>
          <h1 className="mt-1 flex items-center gap-2 font-serif text-2xl font-bold leading-none text-ink">
            Pedidos
            <span className="h-2 w-2 rounded-full bg-status-delivered animate-pulse" />
          </h1>
        </div>
        <button
          onClick={() => setSoundEnabled((v) => !v)}
          className={clsx(
            'border px-3 py-2 text-xs font-bold transition-all active:scale-95',
            soundEnabled ? 'border-brand-500 bg-brand-400 text-neutral-950' : 'border-[#bcb7aa] text-neutral-400 hover:border-neutral-600'
          )}
        >
          {soundEnabled ? '🔔 Som ativado' : '🔕 Som desativado'}
        </button>
      </div>

      {flashNewOrder && (
        <div className="bg-brand-400 py-2 text-center text-xs font-bold text-neutral-950 animate-slide-down">
          Novo pedido recebido!
        </div>
      )}

      <div className="flex-1 overflow-x-auto">
          <div className="flex h-full min-w-max gap-4 p-4 sm:p-6">
          {COLUMNS.map((status) => {
            const columnOrders = activeOrders.filter((o) => o.status === status);
            return (
              <div key={status} className="flex w-80 shrink-0 flex-col border border-border bg-surface-elevated shadow-[0_4px_0_rgba(28,29,26,0.06)]">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <span className={clsx('h-2 w-2 rounded-full', COLUMN_DOT[status])} />
                  <h2 className="font-serif text-lg font-bold text-ink">{ORDER_STATUS_LABEL[status]}</h2>
                  <span className="ml-auto flex h-6 min-w-6 items-center justify-center bg-[#e5e2d8] px-1.5 text-xs font-bold text-neutral-400">
                    {columnOrders.length}
                  </span>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
                  {columnOrders.length === 0 ? (
                    <p className="text-xs text-neutral-400 text-center py-6">Nenhum pedido</p>
                  ) : (
                    columnOrders.map((order, idx) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        index={idx}
                        onAdvance={updateStatus}
                        onCancel={(id) => updateStatus(id, 'cancelled')}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
