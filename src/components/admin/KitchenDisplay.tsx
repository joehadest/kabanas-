'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { ArrowLeft, Check, ChefHat, Clock, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { DEFAULT_LIST_LIMIT, ShowMoreToggle } from '@/components/ui/collapsible-list';

interface TabRef {
  identifier: string | null;
  dining_tables?: { name: string } | { name: string }[] | null;
}

interface Item {
  id: string;
  product_name: string;
  quantity: number;
  notes: string | null;
  station: string;
  status: 'new' | 'preparing' | 'ready' | 'served';
  created_at: string;
  tabs: TabRef | TabRef[];
}

const COLUMNS: { status: Item['status']; title: string; accent: string }[] = [
  { status: 'new', title: 'Novos', accent: 'border-sky-400/40 bg-sky-500/10' },
  { status: 'preparing', title: 'Preparo', accent: 'border-amber-400/40 bg-amber-500/10' },
  { status: 'ready', title: 'Prontos', accent: 'border-brand-400/40 bg-brand-400/10' },
];

function getTabRef(item: Item): TabRef | null {
  const { tabs } = item;
  if (!tabs) return null;
  return Array.isArray(tabs) ? tabs[0] ?? null : tabs;
}

function getDiningTableName(tab: TabRef): string | null {
  const table = tab.dining_tables;
  if (!table) return null;
  if (Array.isArray(table)) return table[0]?.name ?? null;
  return table.name ?? null;
}

function getTableName(item: Item) {
  const tab = getTabRef(item);
  if (!tab) return 'Sem mesa';
  return getDiningTableName(tab) || tab.identifier || 'Sem mesa';
}

function elapsedMinutes(createdAt: string) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

function urgencyTone(minutes: number) {
  if (minutes >= 20) return 'border-red-400/60 bg-red-500/15';
  if (minutes >= 10) return 'border-amber-400/50 bg-amber-500/10';
  return 'border-white/15 bg-white/10';
}

function advanceLabel(columnStatus: Item['status']) {
  if (columnStatus === 'new') return 'Iniciar';
  if (columnStatus === 'preparing') return 'Pronto';
  return 'Entregue';
}

function advanceIcon(columnStatus: Item['status']) {
  if (columnStatus === 'new') return ChefHat;
  return Check;
}

function TableGroupCard({
  tableName,
  items,
  columnStatus,
  onAdvance,
}: {
  tableName: string;
  items: Item[];
  columnStatus: Item['status'];
  onAdvance: (id: string) => void;
}) {
  const oldestMinutes = Math.max(...items.map((item) => elapsedMinutes(item.created_at)));
  const Icon = advanceIcon(columnStatus);

  return (
    <article className={clsx('rounded-2xl border p-3 sm:p-4', urgencyTone(oldestMinutes))}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <p className="truncate font-serif text-xl font-bold text-white">{tableName}</p>
        <span
          className={clsx(
            'inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold',
            oldestMinutes >= 20
              ? 'bg-red-500/25 text-red-200'
              : oldestMinutes >= 10
                ? 'bg-amber-500/25 text-amber-100'
                : 'bg-white/10 text-white/80'
          )}
        >
          <Clock size={12} />
          {oldestMinutes} min
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug text-white">
                {item.quantity}x {item.product_name}
              </p>
              {item.notes && <p className="mt-1 text-xs text-white/60">{item.notes}</p>}
            </div>
            <button
              type="button"
              onClick={() => onAdvance(item.id)}
              className="inline-flex shrink-0 touch-manipulation items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/20"
            >
              <Icon size={14} />
              {advanceLabel(columnStatus)}
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

function groupByTable(items: Item[]) {
  const map = new Map<string, Item[]>();

  for (const item of items) {
    const tableName = getTableName(item);
    const group = map.get(tableName);
    if (group) group.push(item);
    else map.set(tableName, [item]);
  }

  return [...map.entries()]
    .map(([tableName, tableItems]) => ({
      tableName,
      items: tableItems.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
      oldestAt: Math.min(...tableItems.map((item) => new Date(item.created_at).getTime())),
    }))
    .sort((a, b) => a.oldestAt - b.oldestAt);
}

function Column({
  column,
  items,
  onAdvance,
}: {
  column: (typeof COLUMNS)[number];
  items: Item[];
  onAdvance: (id: string, status: Item['status']) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const groups = useMemo(() => groupByTable(items), [items]);
  const visible = showAll ? groups : groups.slice(0, DEFAULT_LIST_LIMIT);
  const hiddenCount = Math.max(0, groups.length - DEFAULT_LIST_LIMIT);

  const nextStatus = (status: Item['status']): Item['status'] => {
    if (status === 'new') return 'preparing';
    if (status === 'preparing') return 'ready';
    return 'served';
  };

  return (
    <section className={clsx('flex min-h-[24rem] flex-col rounded-2xl border', column.accent)}>
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h2 className="font-serif text-lg font-bold text-white">{column.title}</h2>
        <span className="rounded-lg bg-black/25 px-2.5 py-1 text-sm font-bold text-white">{groups.length}</span>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {visible.map(({ tableName, items: tableItems }) => (
          <TableGroupCard
            key={tableName}
            tableName={tableName}
            items={tableItems}
            columnStatus={column.status}
            onAdvance={(id) => onAdvance(id, nextStatus(column.status))}
          />
        ))}

        {!groups.length && (
          <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">
            Nenhum pedido.
          </p>
        )}

        <ShowMoreToggle
          hiddenCount={hiddenCount}
          showingAll={showAll}
          onToggle={() => setShowAll((v) => !v)}
          className="border-white/15 text-white/60 hover:border-white/30 hover:text-white"
        />
      </div>
    </section>
  );
}

export function KitchenDisplay({ storeId, items: initialItems }: { storeId: string; items: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [, setClock] = useState(Date.now());

  const fetchItems = useCallback(async () => {
    setRefreshing(true);
    const { data } = await createClient()
      .from('tab_items')
      .select('id,product_name,quantity,notes,station,status,created_at,tabs!inner(identifier,dining_tables(name))')
      .in('status', ['new', 'preparing', 'ready'])
      .eq('tabs.store_id', storeId)
      .order('created_at');
    if (data) setItems(data as Item[]);
    setRefreshing(false);
  }, [storeId]);

  useEffect(() => {
    const tick = window.setInterval(() => setClock(Date.now()), 60000);
    const poll = window.setInterval(fetchItems, 15000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(poll);
    };
  }, [fetchItems]);

  // Além do polling (rede de segurança), escuta em tempo real qualquer
  // mudança em tab_items — cancelar item, fechar comanda ou excluir mesa
  // refletem na hora aqui, sem esperar o próximo ciclo de atualização.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('kds-tab-items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tab_items' }, () => {
        void fetchItems();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchItems]);

  const changeStatus = async (id: string, status: Item['status']) => {
    const { error } = await createClient().from('tab_items').update({ status }).eq('id', id);
    if (!error) {
      setItems((current) =>
        status === 'served'
          ? current.filter((item) => item.id !== id)
          : current.map((item) => (item.id === id ? { ...item, status } : item))
      );
    }
  };

  const tableFilters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const name = getTableName(item);
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  }, [items]);

  useEffect(() => {
    if (selectedTable && !tableFilters.some(([name]) => name === selectedTable)) {
      setSelectedTable(null);
    }
  }, [selectedTable, tableFilters]);

  const filteredItems = useMemo(() => {
    if (!selectedTable) return items;
    return items.filter((item) => getTableName(item) === selectedTable);
  }, [items, selectedTable]);

  const totalOrders = items.length;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold sm:text-3xl">Cozinha</h1>
            <p className="mt-1 text-sm text-white/45">
              {totalOrders} pedido{totalOrders !== 1 ? 's' : ''} ativo{totalOrders !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={fetchItems}
              disabled={refreshing}
              className="normal-case border-white/15 bg-white/10 text-white hover:bg-white/15"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Atualizar
            </Button>
            <Link href="/admin/pdv">
              <Button variant="primary" size="md" className="normal-case">
                <ArrowLeft size={16} />
                PDV
              </Button>
            </Link>
          </div>
        </header>

        {tableFilters.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Filtrar por mesa</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none [-webkit-overflow-scrolling:touch]">
              <button
                type="button"
                onClick={() => setSelectedTable(null)}
                className={clsx(
                  'shrink-0 touch-manipulation rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors',
                  selectedTable === null
                    ? 'bg-brand-400 text-neutral-950'
                    : 'border border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
                )}
              >
                Todas ({totalOrders})
              </button>
              {tableFilters.map(([name, count]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedTable(name)}
                  className={clsx(
                    'shrink-0 touch-manipulation rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors',
                    selectedTable === name
                      ? 'bg-brand-400 text-neutral-950'
                      : 'border border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
                  )}
                >
                  {name} ({count})
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-4 xl:grid-cols-3 xl:gap-5">
          {COLUMNS.map((column) => (
            <Column
              key={column.status}
              column={column}
              items={filteredItems.filter((item) => item.status === column.status)}
              onAdvance={changeStatus}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
