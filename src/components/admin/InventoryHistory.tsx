'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fetchAllRows } from '@/lib/data/fetch-all-rows';
import {
  formatQty,
  formatSigned,
  groupByDay,
  isAutomatic,
  parseSale,
  salesLeft,
  salesNoun,
  summarizeMovements,
  type InventoryMovement,
  type MovementType,
  type NamedSalesRule,
} from '@/lib/inventory/movements';
import { Button } from '@/components/ui/button';
import { Modal, ModalAlert, ModalFooter } from '@/components/ui/modal';
import { cn } from '@/lib/utils';

const PERIODS = [
  { id: 'today', label: 'Hoje', days: 0 },
  { id: 'week', label: '7 dias', days: 6 },
  { id: 'month', label: '30 dias', days: 29 },
  { id: 'all', label: 'Tudo', days: null },
] as const;
type PeriodId = (typeof PERIODS)[number]['id'];

const TYPE_LABELS: Record<MovementType, string> = {
  entry: 'Entrada',
  exit: 'Saída',
  loss: 'Perda',
  adjustment: 'Ajuste',
};

const PAGE = 100;
const COLUMNS = 'id,movement_type,quantity_change,reason,created_by,created_at';

function periodStart(id: PeriodId): string | null {
  const days = PERIODS.find((period) => period.id === id)?.days;
  if (days == null) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days);
  return start.toISOString();
}

async function loadMovements(itemId: string, period: PeriodId): Promise<InventoryMovement[]> {
  const since = periodStart(period);
  const load = (columns: string) =>
    fetchAllRows<InventoryMovement>((from, to) => {
      let query = createClient()
        .from('inventory_movements')
        .select(columns, { count: 'exact' })
        .eq('inventory_item_id', itemId);
      if (since) query = query.gte('created_at', since);
      return query.order('created_at', { ascending: false }).order('id').range(from, to).returns<InventoryMovement[]>();
    });

  let rows: InventoryMovement[];
  try {
    rows = await load(`${COLUMNS},quantity_after`);
  } catch (error) {
    // Antes de supabase/migration_inventory_movement_balance.sql o saldo por movimentação não existe.
    if (!String((error as Error).message).includes('quantity_after')) throw error;
    rows = await load(COLUMNS);
  }
  return rows.map((row) => ({
    ...row,
    quantity_change: Number(row.quantity_change),
    quantity_after: row.quantity_after == null ? null : Number(row.quantity_after),
  }));
}

interface Props {
  item: { id: string; name: string; unit: string; quantity: number };
  rules: NamedSalesRule[];
  onClose: () => void;
}

export function InventoryHistory({ item, rules, onClose }: Props) {
  const [period, setPeriod] = useState<PeriodId>('week');
  const [movements, setMovements] = useState<InventoryMovement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE);
  const [reload, setReload] = useState(0);

  // Recarrega também quando o saldo do item muda (o Inventário consulta o estoque sozinho).
  useEffect(() => {
    let cancelled = false;
    loadMovements(item.id, period)
      .then((rows) => {
        if (cancelled) return;
        setMovements(rows);
        setError(null);
      })
      .catch((cause) => {
        if (!cancelled) setError(String((cause as Error).message || cause));
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, item.quantity, period, reload]);

  const summary = useMemo(() => summarizeMovements(movements ?? [], rules), [movements, rules]);
  const days = useMemo(() => {
    // O total do dia usa o dia inteiro; só a lista é cortada em "Mostrar mais".
    let room = visible;
    return groupByDay(movements ?? []).flatMap((day) => {
      const shown = day.movements.slice(0, Math.max(0, room));
      room -= shown.length;
      return shown.length ? [{ ...day, shown, sold: summarizeMovements(day.movements, rules).sold }] : [];
    });
  }, [movements, rules, visible]);
  // Com um produto só, cada linha e o saldo também aparecem em canecas/vendas.
  const rule = rules.length === 1 ? rules[0] : null;

  const soldLabel = (list: typeof summary.sold) =>
    list.map(({ product, count }) => `${formatQty(count)} ${salesNoun(product, count)}`).join(' + ');

  const changePeriod = (next: PeriodId) => {
    setPeriod(next);
    setMovements(null);
    setVisible(PAGE);
  };

  return (
    <Modal
      onClose={onClose}
      title={item.name}
      subtitle="Movimentações"
      size="2xl"
      footer={
        <ModalFooter>
          <Button variant="secondary" size="md" onClick={() => setReload((n) => n + 1)} className="normal-case">
            <RefreshCw size={14} />
            Atualizar
          </Button>
          <Button variant="primary" size="md" onClick={onClose} className="normal-case">
            Fechar
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-neutral-900 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-400">Saldo agora</p>
          <p className="mt-1 text-2xl font-bold text-brand-300">
            {formatQty(item.quantity)} {item.unit}
          </p>
          {rules.map((entry) => {
            const left = salesLeft(item.quantity, entry);
            return (
              <p key={entry.product_name} className="mt-1 text-sm text-neutral-300">
                ≈ <strong className="text-ink">{formatQty(left)} {salesNoun(entry.product_name, left)}</strong> de{' '}
                {entry.product_name}
                <span className="text-neutral-500">
                  {' '}· cada uma tira {formatQty(entry.base_quantity / entry.sales_count)} {item.unit}
                </span>
              </p>
            );
          })}
        </div>

        {!rules.length && (
          <ModalAlert variant="warning">
            Este item não está ligado a nenhum produto do cardápio, então as vendas não dão baixa nele. Edite o item e use
            “Ligar a um produto do cardápio”.
          </ModalAlert>
        )}

        <div className="flex gap-1 rounded-xl border border-border bg-black/40 p-1">
          {PERIODS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={period === id}
              onClick={() => changePeriod(id)}
              className={cn(
                'flex-1 rounded-lg px-2 py-2 text-xs font-bold',
                period === id ? 'bg-brand-600 text-white' : 'text-neutral-400 hover:text-ink'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <ModalAlert variant="error">Não foi possível carregar as movimentações: {error}</ModalAlert>}

        {!movements ? (
          !error && <p className="p-6 text-center text-sm text-neutral-500">Carregando...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Vendido" value={summary.sold.length ? soldLabel(summary.sold) : '0'} />
              <Stat label="Entradas" value={`${formatQty(summary.entries)} ${item.unit}`} />
              <Stat label="Perdas e saídas" value={`${formatQty(summary.removed)} ${item.unit}`} />
              <Stat label="Ajustes" value={`${formatSigned(summary.adjustments) || '0'} ${item.unit}`} />
            </div>

            {!movements.length && (
              <p className="p-6 text-center text-sm text-neutral-500">Nenhuma movimentação neste período.</p>
            )}

            {days.map((day) => (
              <section key={day.key}>
                <div className="flex items-baseline justify-between gap-3 px-1 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-neutral-400">{day.label}</h3>
                  {day.sold.length > 0 && <p className="text-xs font-bold text-brand-300">{soldLabel(day.sold)}</p>}
                </div>
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                  {day.shown.map((movement) => (
                    <MovementRow key={movement.id} movement={movement} unit={item.unit} rule={rule} rules={rules} />
                  ))}
                </ul>
              </section>
            ))}

            {movements.length > visible && (
              <Button variant="secondary" size="md" fullWidth onClick={() => setVisible((n) => n + PAGE)} className="normal-case">
                Mostrar mais ({formatQty(movements.length - visible)})
              </Button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-neutral-900 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-ink">{value}</p>
    </div>
  );
}

function MovementRow({
  movement,
  unit,
  rule,
  rules,
}: {
  movement: InventoryMovement;
  unit: string;
  rule: NamedSalesRule | null;
  rules: NamedSalesRule[];
}) {
  const automatic = isAutomatic(movement);
  const sale = parseSale(movement, rules);
  const down = movement.quantity_change < 0;
  const change = `${formatSigned(movement.quantity_change)} ${unit}`;
  const left = rule && movement.quantity_after != null ? salesLeft(movement.quantity_after, rule) : null;

  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">
          {automatic ? movement.reason : `${TYPE_LABELS[movement.movement_type]}: ${movement.reason}`}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {new Date(movement.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ·{' '}
          {automatic ? 'automática' : 'manual'}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn('text-sm font-bold', down ? 'text-amber-400' : 'text-brand-300')}>
          {sale ? `${formatSigned(-sale.count)} ${salesNoun(sale.product, sale.count)}` : change}
        </p>
        {sale && <p className="text-xs text-neutral-500">{change}</p>}
        {movement.quantity_after != null && (
          <p className="mt-0.5 text-xs text-neutral-400">
            ficou {formatQty(movement.quantity_after)} {unit}
            {rule && left != null && ` ≈ ${formatQty(left)} ${salesNoun(rule.product_name, left)}`}
          </p>
        )}
      </div>
    </li>
  );
}
