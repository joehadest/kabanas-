'use client';

import clsx from 'clsx';
import { formatCurrency, formatOrderTime } from '@/lib/utils/format';
import type { Order, OrderStatus } from '@/lib/types/database';
import { ORDER_STATUS_FLOW } from '@/lib/types/database';

const PAYMENT_LABEL: Record<Order['payment_method'], string> = {
  pix: 'PIX',
  card_on_delivery: 'Cartão na entrega',
  cash: 'Dinheiro',
};

const STATUS_BORDER: Record<OrderStatus, string> = {
  received: 'border-l-status-received',
  preparing: 'border-l-status-preparing',
  out_for_delivery: 'border-l-status-out_for_delivery',
  delivered: 'border-l-status-delivered',
  cancelled: 'border-l-status-cancelled',
};

interface Props {
  order: Order;
  onAdvance: (orderId: string, nextStatus: OrderStatus) => void;
  onCancel: (orderId: string) => void;
  index?: number;
}

export function OrderCard({ order, onAdvance, onCancel, index = 0 }: Props) {
  const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
  const nextStatus = ORDER_STATUS_FLOW[currentIndex + 1];

  return (
    <div
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className={clsx(
        'space-y-3 border border-[#dfdbd0] border-l-4 bg-white p-4 shadow-[0_2px_0_rgba(28,29,26,0.06)] transition-shadow animate-fade-in-up hover:shadow-[0_8px_18px_rgba(28,29,26,0.12)]',
        STATUS_BORDER[order.status]
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-serif text-lg font-bold text-[#1c1d1a]">#{order.order_code}</span>
        <span className="text-xs text-neutral-400">{formatOrderTime(order.created_at)}</span>
      </div>

      <ul className="text-xs text-neutral-600 space-y-0.5">
        {order.items?.map((item) => (
          <li key={item.id} className="flex justify-between gap-2">
            <span className="line-clamp-1">
              {item.quantity}x {item.product_name}
            </span>
            <span className="shrink-0">{formatCurrency(item.total_price)}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-[#e7e4dc] pt-2 text-xs">
        <span className={clsx('px-2 py-1 text-[10px] font-bold uppercase tracking-wide', PAYMENT_BADGE_CLASS)}>
          {PAYMENT_LABEL[order.payment_method]}
        </span>
        <span className="font-bold text-[#1c1d1a]">{formatCurrency(order.total)}</span>
      </div>

      {order.status !== 'delivered' && order.status !== 'cancelled' && (
        <div className="flex gap-2 pt-1">
          {nextStatus && (
            <button
              onClick={() => onAdvance(order.id, nextStatus)}
              className="h-9 flex-1 bg-brand-400 text-xs font-black text-neutral-950 transition-all hover:bg-brand-300 active:scale-[0.98]"
            >
              {ADVANCE_LABEL[nextStatus]}
            </button>
          )}
          <button
            onClick={() => onCancel(order.id)}
            className="h-9 border border-[#d8d4c9] px-3 text-xs font-bold text-neutral-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

const PAYMENT_BADGE_CLASS = 'bg-[#e7e4dc] text-neutral-600';

const ADVANCE_LABEL: Record<OrderStatus, string> = {
  received: 'Confirmar recebido',
  preparing: 'Iniciar preparo',
  out_for_delivery: 'Saiu para entrega',
  delivered: 'Marcar entregue',
  cancelled: 'Cancelado',
};
