'use client';

import { Receipt, Trash2 } from 'lucide-react';
import { formatCurrency, tableDisplayLabel } from '@/lib/utils/format';
import { ShowMoreToggle, useLimitedList, CollapsibleSection } from '@/components/ui/collapsible-list';
import { EmptyState } from '@/components/ui/page-layout';
import { cn } from '@/lib/utils';

export interface RestaurantSale {
  id: string;
  total_amount: number;
  total_cost: number;
  payment_fee: number;
  tax_amount: number;
  net_profit: number;
  occurred_at: string;
  notes: string | null;
  sale_items: { product_name: string; quantity: number }[];
}

function saleLabel(sale: RestaurantSale): string {
  if (sale.notes?.startsWith('Comanda')) {
    return tableDisplayLabel(sale.notes);
  }
  return sale.notes || 'Venda na mesa';
}

function itemSummary(sale: RestaurantSale): string {
  const items = sale.sale_items ?? [];
  if (!items.length) return 'Sem itens';
  const preview = items.slice(0, 2).map((item) => `${item.quantity}x ${item.product_name}`);
  const extra = items.length > 2 ? ` +${items.length - 2}` : '';
  return preview.join(', ') + extra;
}

export function RestaurantSalesHistory({
  sales,
  onRemoveSale,
  removingSaleId,
}: {
  sales: RestaurantSale[];
  onRemoveSale?: (saleId: string) => void | Promise<void>;
  removingSaleId?: string | null;
}) {
  const list = useLimitedList(sales, 8);

  return (
    <CollapsibleSection
      title="Vendas fechadas"
      subtitle="Registradas automaticamente ao fechar comandas"
      count={sales.length}
      defaultOpen={sales.length > 0 && sales.length <= 5}
    >
      {sales.length ? (
        <>
          <div className="divide-y divide-border rounded-2xl border border-border bg-black/20">
            {list.visible.map((sale) => (
              <div key={sale.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Receipt size={14} className="shrink-0 text-brand-300" />
                    <p className="truncate text-sm font-semibold text-ink">{saleLabel(sale)}</p>
                  </div>
                  <p className="mt-1 truncate text-xs text-neutral-500">{itemSummary(sale)}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {new Date(sale.occurred_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 items-start gap-3 sm:flex-col sm:items-end">
                  <div className="sm:text-right">
                    <p className="font-serif text-lg font-bold text-ink">{formatCurrency(sale.total_amount)}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Custos {formatCurrency(Number(sale.total_cost))} · taxas{' '}
                      {formatCurrency(Number(sale.payment_fee))} · impostos{' '}
                      {formatCurrency(Number(sale.tax_amount))}
                    </p>
                    <p
                      className={cn(
                        'mt-1 text-xs font-bold',
                        Number(sale.net_profit) >= 0 ? 'text-brand-300' : 'text-red-400'
                      )}
                    >
                      Lucro {formatCurrency(sale.net_profit)}
                    </p>
                  </div>
                  {onRemoveSale && (
                    <button
                      type="button"
                      onClick={() => onRemoveSale(sale.id)}
                      disabled={removingSaleId === sale.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                      {removingSaleId === sale.id ? 'Removendo...' : 'Remover'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <ShowMoreToggle
            hiddenCount={list.hiddenCount}
            showingAll={list.showAll}
            onToggle={list.toggle}
            className="mt-3"
          />
        </>
      ) : (
        <EmptyState message="Nenhuma venda fechada ainda. Abra uma mesa, lance itens e feche a comanda para registrar." />
      )}
    </CollapsibleSection>
  );
}
