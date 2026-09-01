'use client';

import { FormEvent, useMemo, useState } from 'react';
import clsx from 'clsx';
import { LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  CollapsibleSection,
  DEFAULT_LIST_LIMIT,
  ListSearchBar,
  ShowMoreToggle,
} from '@/components/ui/collapsible-list';
import { FieldGroup, Input, Select } from '@/components/ui/input';
import { Modal, ModalAlert, ModalFooter, ModalSection } from '@/components/ui/modal';

interface Area {
  id: string;
  name: string;
}

interface Table {
  id: string;
  name: string;
  seats: number;
  area_id: string | null;
  tabs: { id: string; status: string }[];
}

interface Props {
  storeId: string;
  areas: Area[];
  tables: Table[];
  open: boolean;
  onClose: () => void;
  onUpdate: (areas: Area[], tables: Table[]) => void;
}

export function TableManager({ storeId, areas: initialAreas, tables: initialTables, open, onClose, onUpdate }: Props) {
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

  const normalizedSearch = search.trim().toLowerCase();

  const filteredTables = useMemo(
    () =>
      tables.filter(
        (table) =>
          !normalizedSearch ||
          table.name.toLowerCase().includes(normalizedSearch) ||
          areas.find((a) => a.id === table.area_id)?.name.toLowerCase().includes(normalizedSearch)
      ),
    [tables, normalizedSearch, areas]
  );

  const visibleTables = showAllTables || normalizedSearch
    ? filteredTables
    : filteredTables.slice(0, DEFAULT_LIST_LIMIT);
  const hiddenTableCount = Math.max(0, filteredTables.length - DEFAULT_LIST_LIMIT);

  const resetForm = () => {
    setTableName('');
    setSeats('4');
    setAreaId('');
    setEditingId(null);
  };

  const sync = (nextAreas: Area[], nextTables: Table[]) => {
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
    const nextAreas = [...areas, data];
    sync(nextAreas, tables);
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
      ? createClient().from('dining_tables').update(payload).eq('id', editingId).select('id,name,seats,area_id').single()
      : createClient().from('dining_tables').insert(payload).select('id,name,seats,area_id').single();
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

  const edit = (table: Table) => {
    setEditingId(table.id);
    setTableName(table.name);
    setSeats(String(table.seats));
    setAreaId(table.area_id || '');
    setMessage(null);
  };

  const remove = async (table: Table) => {
    if (table.tabs.some((tab) => ['open', 'payment', 'attention'].includes(tab.status))) {
      setMessage('Feche a comanda antes de excluir esta mesa.');
      return;
    }
    if (!confirm(`Excluir ${table.name}?`)) return;
    const { error } = await createClient().from('dining_tables').delete().eq('id', table.id);
    if (error) {
      setMessage('Não foi possível excluir a mesa.');
      return;
    }
    sync(areas, tables.filter((item) => item.id !== table.id));
    if (editingId === table.id) resetForm();
  };

  const handleClose = () => {
    setMessage(null);
    setSearch('');
    resetForm();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Salão e mesas"
      subtitle="Configuração do PDV"
      description="Crie ambientes e cadastre mesas sem sair do ponto de venda."
      size="2xl"
      footer={
        <ModalFooter className="gap-3">
          <Button variant="secondary" size="md" onClick={handleClose} className="normal-case">
            Fechar
          </Button>
        </ModalFooter>
      }
      bodyClassName="px-5 py-6 sm:px-8 sm:py-7"
    >
      <div className="space-y-6">
        <ModalSection title="Ambientes" description="Varanda, salão principal, área externa...">
          <form onSubmit={addArea} className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={areaName}
              onChange={(e) => setAreaName(e.target.value)}
              placeholder="Ex.: Varanda"
              className="min-w-0 flex-1"
            />
            <Button type="submit" variant="primary" size="md" className="shrink-0 normal-case">
              <Plus size={15} />
              Criar ambiente
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {areas.length ? (
              areas.map((area) => (
                <span
                  key={area.id}
                  className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-ink"
                >
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
            <div className="flex gap-2 sm:col-span-2">
              {editingId && (
                <Button type="button" variant="secondary" size="md" onClick={resetForm} className="normal-case">
                  Cancelar edição
                </Button>
              )}
              <Button type="submit" variant="primary" size="md" className="normal-case">
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
            {visibleTables.map((table) => (
              <div
                key={table.id}
                className={clsx(
                  'flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                  editingId === table.id
                    ? 'border-brand-400 bg-brand-50/40'
                    : 'border-border bg-surface-elevated hover:border-brand-300'
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{table.name}</p>
                  <p className="text-xs text-neutral-500">
                    {table.seats} lugares
                    {table.area_id ? ` · ${areas.find((a) => a.id === table.area_id)?.name || 'Ambiente'}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    title="Editar mesa"
                    onClick={() => edit(table)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-300 hover:bg-brand-400/10"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    title="Excluir mesa"
                    onClick={() => remove(table)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 size={15} />
                  </button>
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
      </div>
    </Modal>
  );
}
