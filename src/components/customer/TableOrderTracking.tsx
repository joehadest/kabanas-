'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils/format';
import { useRealtimeTableOrder } from '@/hooks/useRealtimeTableOrder';
import { TAB_ITEM_STATUS_FLOW, TAB_ITEM_STATUS_LABEL, type TableOrder, type TabItemStatus } from '@/lib/types/database';

const STEP_DESCRIPTION: Record<Exclude<TabItemStatus, 'cancelled'>, string> = {
  new: 'A cozinha recebeu seu pedido.',
  preparing: 'Seu pedido está sendo preparado.',
  ready: 'Pronto! A equipe já está levando até a mesa.',
  served: 'Pedido servido. Bom apetite!',
};

interface Props {
  order: TableOrder;
  menuUrl: string;
}

export function TableOrderTracking({ order, menuUrl }: Props) {
  const items = useRealtimeTableOrder(order.id, order.items ?? []);

  const activeItems = items.filter((item) => item.status !== 'cancelled');
  const cancelledItems = items.filter((item) => item.status === 'cancelled');
  const total = activeItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  const overallIndex = useMemo(() => {
    if (activeItems.length === 0) return 0;
    return Math.min(...activeItems.map((item) => TAB_ITEM_STATUS_FLOW.indexOf(item.status)));
  }, [activeItems]);

  const statusLabel =
    activeItems.length > 0 ? TAB_ITEM_STATUS_LABEL[TAB_ITEM_STATUS_FLOW[overallIndex]] : 'Pedido cancelado';

  return (
    <div className="min-h-screen bg-black pb-10 text-ink paper-surface">
      <header className="relative overflow-hidden border-b border-white/10 bg-kabanas-charcoal px-4 pb-10 pt-7 text-white safe-top">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(212,175,55,0.14)_0,transparent_55%)]" />
        <div className="relative mx-auto max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-300">{order.table_name}</p>
          <h1 className="mt-2 font-display text-3xl leading-none tracking-wide text-white sm:text-4xl">{statusLabel}</h1>
          {order.customer_name && (
            <p className="mt-2 text-sm text-neutral-300">Pedido de {order.customer_name}</p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-neutral-400">
            {activeItems.length > 0
              ? STEP_DESCRIPTION[TAB_ITEM_STATUS_FLOW[overallIndex] as keyof typeof STEP_DESCRIPTION]
              : 'Este pedido foi cancelado pela equipe.'}
          </p>
        </div>
      </header>

      <div className="mx-auto -mt-5 max-w-xl px-4">
        <div className="rounded-2xl border border-border bg-surface-elevated p-4 shadow-card animate-fade-in-up">
          <ol className="space-y-0">
            {TAB_ITEM_STATUS_FLOW.map((status, idx) => {
              const isDone = idx <= overallIndex;
              const isCurrent = idx === overallIndex;
              const isLast = idx === TAB_ITEM_STATUS_FLOW.length - 1;
              return (
                <li key={status} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={clsx(
                        'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold transition-colors duration-300',
                        isDone ? 'bg-brand-400 text-neutral-950' : 'bg-neutral-800 text-neutral-400',
                        isCurrent && 'ring-4 ring-brand-400/25'
                      )}
                    >
                      {isDone ? '✓' : idx + 1}
                    </span>
                    {!isLast && (
                      <span
                        className={clsx(
                          'min-h-[28px] w-0.5 flex-1 transition-colors duration-300',
                          isDone ? 'bg-brand-400' : 'bg-neutral-800'
                        )}
                      />
                    )}
                  </div>
                  <div className="pb-6 pt-0.5">
                    <p className={clsx('text-sm font-medium', isDone ? 'text-ink' : 'text-neutral-400')}>
                      {TAB_ITEM_STATUS_LABEL[status]}
                    </p>
                    {isCurrent && activeItems.length > 0 && (
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {STEP_DESCRIPTION[status as keyof typeof STEP_DESCRIPTION]}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-surface-elevated p-4 shadow-card animate-fade-in-up [animation-delay:80ms]">
          <h2 className="mb-3 font-serif text-base font-bold text-ink">Itens do pedido</h2>
          <ul className="space-y-2.5">
            {activeItems.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 text-sm">
                <span className="text-neutral-300">
                  <span className="font-medium text-ink">
                    {item.quantity}x {item.product_name}
                  </span>
                  {item.notes && <span className="mt-0.5 block text-xs text-neutral-500">{item.notes}</span>}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-bold text-brand-300">{formatCurrency(item.unit_price * item.quantity)}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                    {TAB_ITEM_STATUS_LABEL[item.status]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {cancelledItems.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-border pt-3">
              {cancelledItems.map((item) => (
                <li key={item.id} className="flex justify-between text-xs text-neutral-600 line-through">
                  <span>
                    {item.quantity}x {item.product_name}
                  </span>
                  <span>{formatCurrency(item.unit_price * item.quantity)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex justify-between border-t border-border pt-3 font-serif text-base font-bold text-ink">
            <span>Total deste pedido</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {order.notes && (
          <div className="mt-4 rounded-2xl border border-border bg-surface-elevated p-4 shadow-card animate-fade-in-up [animation-delay:140ms]">
            <h2 className="mb-1 font-serif text-base font-bold text-ink">Observações</h2>
            <p className="text-sm text-neutral-400">{order.notes}</p>
          </div>
        )}

        <Link
          href={menuUrl}
          className="mt-6 flex min-h-12 items-center justify-center rounded-2xl border border-brand-300/50 bg-brand-400 px-4 text-sm font-bold text-neutral-950 transition-colors hover:bg-brand-300"
        >
          Fazer outro pedido
        </Link>
      </div>
    </div>
  );
}
