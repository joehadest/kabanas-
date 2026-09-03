'use client';

import { FormEvent, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  CollapsibleSection,
  DEFAULT_LIST_LIMIT,
  ListSearchBar,
  ShowMoreToggle,
} from '@/components/ui/collapsible-list';
import { FieldGroup, Input, Select } from '@/components/ui/input';
import { ModalAlert, ModalSection } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export interface TableArea {
  id: string;
  name: string;
}

export interface TableRow {
  id: string;
  name: string;
  seats: number;
  area_id: string | null;
  is_active: boolean;
  sort_order: number;
  tabs: { id: string; status: string }[];
}

interface Props {
  storeId: string;
  areas: TableArea[];
  tables: TableRow[];
  onUpdate: (areas: TableArea[], tables: TableRow[]) => void;
}

/**
 * CRUD de ambientes/mesas — mesma lógica usada tanto no modal do PDV
 * (TableManager) quanto na página /admin/mesas (MesasManager), pra manter as
 * duas telas sempre em sincronia (mesmos campos, mesmo comportamento).
 */
export function TablesEditor({ storeId, areas: initialAreas, tables: initialTables, onUpdate }: Props) {
  const [areas, setAreas] = useState(initialAreas);
  const [tables, setTables] = useState(initialTables);
  const [areaName, setAreaName] = useState('');
  const [tableName, setTableName] = useState('');
  const [seats, setSeats] = useState('4');
  const [areaId, setAreaId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAllTables, setShowAllTables] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TableRow | null>(null);

  const normalizedSearch = search.trim().toLowerCase();

  const sortedTables = useMemo(
    () => [...tables].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [tables]
  );

  const filteredTables = useMemo(
    () =>
      sortedTables.filter(
        (table) =>
          !normalizedSearch ||
          table.name.toLowerCase().includes(normalizedSearch) ||
          areas.find((a) => a.id === table.area_id)?.name.toLowerCase().includes(normalizedSearch)
      ),
    [sortedTables, normalizedSearch, areas]
  );

  const visibleTables = showAllTables || normalizedSearch ? filteredTables : filteredTables.slice(0, DEFAULT_LIST_LIMIT);
  const hiddenTableCount = Math.max(0, filteredTables.length - DEFAULT_LIST_LIMIT);

  const resetForm = () => {
    setTableName('');
    setSeats('4');
    setAreaId('');
    setEditingId(null);
  };

  const sync = (nextAreas: TableArea[], nextTables: TableRow[]) => {
    setAreas(nextAreas);
    setTables(nextTables);
    onUpdate(nextAreas, nextTables);
  };

  const addArea = async (event: FormEvent) => {
    event.preventDefault();
    if (!areaName.trim()) return;
    const { data, error } = await createClient()
      .from('dining_areas')
      .insert({ store_id: storeId, name: areaName.trim(), sort_order: areas.length })
      .select('id,name')
      .single();
    if (error || !data) {
      setMessage('Não foi possível criar o ambiente.');
      return;
    }
    sync([...areas, data], tables);
    setAreaId(data.id);
    setAreaName('');
    setMessage(null);
  };

  const saveTable = async (event: FormEvent) => {
    event.preventDefault();
    if (!tableName.trim() || Number(seats) < 1) {
      setMessage('Informe o nome e a quantidade de lugares da mesa.');
      return;
    }
    const payload = { store_id: storeId, name: tableName.trim(), seats: Number(seats), area_id: areaId || null };
    const query = editingId
      ? createClient()
          .from('dining_tables')
          .update(payload)
          .eq('id', editingId)
          .select('id,name,seats,area_id,is_active,sort_order')
          .single()
      : createClient()
          .from('dining_tables')
          .insert({ ...payload, sort_order: tables.length })
          .select('id,name,seats,area_id,is_active,sort_order')
          .single();
    const { data, error } = await query;
    if (error || !data) {
      setMessage('Não foi possível salvar a mesa. Esse nome já pode estar em uso.');
      return;
    }
    const nextTables = editingId
      ? tables.map((table) => (table.id === editingId ? { ...table, ...data } : table))
      : [...tables, { ...data, tabs: [] }];
    sync(areas, nextTables);
    resetForm();
    setMessage(null);
  };

  const edit = (table: TableRow) => {
    setEditingId(table.id);
    setTableName(table.name);
    setSeats(String(table.seats));
    setAreaId(table.area_id || '');
    setMessage(null);
  };

  const toggleActive = async (table: TableRow) => {
    const nextActive = !table.is_active;
    const { error } = await createClient().from('dining_tables').update({ is_active: nextActive }).eq('id', table.id);
    if (error) {
      setMessage('Não foi possível atualizar a mesa.');
      return;
    }
    sync(areas, tables.map((item) => (item.id === table.id ? { ...item, is_active: nextActive } : item)));
  };

  const move = async (table: TableRow, direction: -1 | 1) => {
    const ordered = sortedTables;
    const index = ordered.findIndex((item) => item.id === table.id);
    const swapWith = ordered[index + direction];
    if (!swapWith) return;
    const supabase = createClient();
    const [{ error: errorA }, { error: errorB }] = await Promise.all([
      supabase.from('dining_tables').update({ sort_order: swapWith.sort_order }).eq('id', table.id),
      supabase.from('dining_tables').update({ sort_order: table.sort_order }).eq('id', swapWith.id),
    ]);
    if (errorA || errorB) {
      setMessage('Não foi possível reordenar as mesas.');
      return;
    }
    sync(
      areas,
      tables.map((item) => {
        if (item.id === table.id) return { ...item, sort_order: swapWith.sort_order };
        if (item.id === swapWith.id) return { ...item, sort_order: table.sort_order };
        return item;
      })
    );
  };

  const remove = async (table: TableRow) => {
    if (table.tabs.some((tab) => ['open', 'payment', 'attention'].includes(tab.status))) {
      setMessage('Feche a comanda antes de excluir esta mesa.');
      return;
    }
    const supabase = createClient();
    const tabIds = table.tabs.map((tab) => tab.id);
    if (tabIds.length > 0) {
      await supabase
        .from('tab_items')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .in('tab_id', tabIds)
        .in('status', ['new', 'preparing', 'ready']);
    }
    const { error } = await supabase.from('dining_tables').delete().eq('id', table.id);
    if (error) {
      setMessage('Não foi possível excluir a mesa.');
      return;
    }
    sync(areas, tables.filter((item) => item.id !== table.id));
    if (editingId === table.id) resetForm();
  };

  return (
    <div className="space-y-6">
      <ModalSection title="Ambientes" description="Varanda, salão principal, área externa...">
        <form onSubmit={addArea} className="flex flex-col gap-3 sm:flex-row">
          <Input value={areaName} onChange={(e) => setAreaName(e.target.value)} placeholder="Ex.: Varanda" className="min-w-0 flex-1" />
          <Button type="submit" variant="primary" size="md" className="shrink-0 normal-case">
            <Plus size={15} />
            Criar ambiente
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {areas.length ? (
            areas.map((area) => (
              <span key={area.id} className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-ink">
                {area.name}
              </span>
            ))
          ) : (
            <p className="text-sm text-neutral-500">Nenhum ambiente cadastrado.</p>
          )}
        </div>
      </ModalSection>

      <CollapsibleSection title="Mesas cadastradas" count={tables.length} defaultOpen>
        <form onSubmit={saveTable} className="grid gap-3 sm:grid-cols-2">
          <FieldGroup label="Nome da mesa">
            <Input value={tableName} onChange={(e) => setTableName(e.target.value)} placeholder="Ex.: Mesa 01" />
          </FieldGroup>
          <FieldGroup label="Lugares">
            <Input value={seats} onChange={(e) => setSeats(e.target.value)} inputMode="numeric" placeholder="4" />
          </FieldGroup>
          <FieldGroup label="Ambiente" className="sm:col-span-2">
            <Select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Sem ambiente</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:flex sm:w-auto">
            {editingId && (
              <Button type="button" variant="secondary" size="md" onClick={resetForm} className="normal-case sm:w-auto">
                Cancelar edição
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              size="md"
              className={clsx('normal-case sm:w-auto', !editingId && 'col-span-2 sm:col-span-1')}
            >
              <LayoutGrid size={15} />
              {editingId ? 'Salvar mesa' : 'Adicionar mesa'}
            </Button>
          </div>
        </form>

        {tables.length > DEFAULT_LIST_LIMIT && (
          <div className="mt-4">
            <ListSearchBar value={search} onChange={setSearch} placeholder="Buscar mesa..." />
          </div>
        )}

        <div className="mt-4 space-y-2">
          {visibleTables.map((table, index) => (
            <div
              key={table.id}
              className={clsx(
                'flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                editingId === table.id ? 'border-brand-400 bg-brand-50/40' : 'border-border bg-surface-elevated hover:border-brand-300',
                !table.is_active && 'opacity-60'
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button
                    type="button"
                    title="Mover para cima"
                    disabled={index === 0}
                    onClick={() => move(table, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/5 hover:text-ink disabled:opacity-20"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    title="Mover para baixo"
                    disabled={index === visibleTables.length - 1}
                    onClick={() => move(table, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/5 hover:text-ink disabled:opacity-20"
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{table.name}</p>
                  <p className="text-xs text-neutral-500">
                    {table.seats} lugares
                    {table.area_id ? ` · ${areas.find((a) => a.id === table.area_id)?.name || 'Ambiente'}` : ''}
                    {!table.is_active && ' · Inativa'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
                <button
                  type="button"
                  title={table.is_active ? 'Desativar mesa (some do cardápio)' : 'Ativar mesa'}
                  onClick={() => toggleActive(table)}
                  aria-pressed={table.is_active}
                  className={clsx(
                    'relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition-colors',
                    table.is_active ? 'bg-brand-400' : 'bg-neutral-700'
                  )}
                >
                  <span
                    className={clsx(
                      'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200',
                      table.is_active && 'translate-x-5'
                    )}
                  />
                </button>
                <div className="flex items-center gap-0.5 border-l border-border pl-2">
                  <button
                    type="button"
                    title="Editar mesa"
                    onClick={() => edit(table)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-300 transition-colors hover:bg-brand-400/10"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    title="Excluir mesa"
                    onClick={() => {
                      if (table.tabs.some((tab) => ['open', 'payment', 'attention'].includes(tab.status))) {
                        setMessage('Feche a comanda antes de excluir esta mesa.');
                        return;
                      }
                      setPendingDelete(table);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {!filteredTables.length && (
            <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-neutral-500">
              {normalizedSearch ? 'Nenhuma mesa encontrada.' : 'Cadastre a primeira mesa acima.'}
            </p>
          )}

          <ShowMoreToggle
            hiddenCount={hiddenTableCount}
            showingAll={showAllTables || !!normalizedSearch}
            onToggle={() => setShowAllTables((v) => !v)}
          />
        </div>
      </CollapsibleSection>

      {message && <ModalAlert variant="error">{message}</ModalAlert>}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Excluir mesa"
        description={pendingDelete ? `Excluir ${pendingDelete.name}?` : ''}
        confirmLabel="Excluir"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void remove(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
