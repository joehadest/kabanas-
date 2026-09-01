'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Minus, PackagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, parseDecimal } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { FloatingToast, useFloatingToast } from '@/components/ui/floating-toast';
import { FieldGroup, Input, Select, Textarea } from '@/components/ui/input';
import { Modal, ModalAlert, ModalFooter, ModalSection } from '@/components/ui/modal';
import { PageContainer, PageHeader, Panel } from '@/components/ui/page-layout';

type Item = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  quantity: number;
  minimum_quantity: number;
  average_cost: number;
  location: string | null;
  notes: string | null;
  is_active: boolean;
};

interface Props {
  storeId: string;
  operatorId: string;
  items: Item[];
}

const units = ['un', 'kg', 'g', 'L', 'ml', 'cx', 'pct'];

function parseQty(value: string) {
  const parsed = parseDecimal(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function InventoryManager({ storeId, operatorId, items: initialItems }: Props) {
  const { toast, showToast, clearToast } = useFloatingToast();
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Item | null | undefined>();
  const [movementItem, setMovementItem] = useState<Item | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const empty = {
    name: '',
    sku: '',
    unit: 'un',
    quantity: '0',
    minimum_quantity: '0',
    average_cost: '0',
    location: '',
    notes: '',
    is_active: true,
  };

  const [form, setForm] = useState(empty);
  const [movementType, setMovementType] = useState('entry');
  const [movementQuantity, setMovementQuantity] = useState('');
  const [movementCost, setMovementCost] = useState('');
  const [movementReason, setMovementReason] = useState('');

  const filtered = useMemo(
    () => items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );
  const lowCount = items.filter((item) => item.is_active && item.quantity <= item.minimum_quantity).length;

  const openEditor = (item?: Item) => {
    setEditing(item ?? null);
    setFormError(null);
    setForm(
      item
        ? {
            name: item.name,
            sku: item.sku ?? '',
            unit: item.unit,
            quantity: String(item.quantity),
            minimum_quantity: String(item.minimum_quantity),
            average_cost: String(item.average_cost),
            location: item.location ?? '',
            notes: item.notes ?? '',
            is_active: item.is_active,
          }
        : empty
    );
  };

  const updateForm = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setFormError('Informe o nome do item.');
      return;
    }
    const payload = {
      store_id: storeId,
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      unit: form.unit,
      quantity: parseQty(form.quantity),
      minimum_quantity: parseQty(form.minimum_quantity),
      average_cost: parseQty(form.average_cost),
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };
    const query = editing
      ? createClient().from('inventory_items').update(payload).eq('id', editing.id).select('*').single()
      : createClient().from('inventory_items').insert(payload).select('*').single();
    const { data, error } = await query;
    if (error || !data) {
      setFormError(error?.message || 'Não foi possível salvar o item.');
      return;
    }
    setItems((current) =>
      editing ? current.map((item) => (item.id === editing.id ? (data as Item) : item)) : [data as Item, ...current]
    );
    setEditing(undefined);
    showToast(editing ? 'Item atualizado.' : 'Item adicionado ao inventário.', 'success');
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await createClient().from('inventory_items').delete().eq('id', pendingDelete.id);
    setDeleting(false);
    if (error) {
      showToast(error.message, 'error');
      return;
    }
    setItems((current) => current.filter((entry) => entry.id !== pendingDelete.id));
    setEditing(undefined);
    setPendingDelete(null);
    showToast('Item removido do inventário.', 'success');
  };

  const openMovement = (item: Item, type = 'entry') => {
    setMovementItem(item);
    setMovementType(type);
    setMovementQuantity('');
    setMovementCost(String(item.average_cost));
    setMovementReason('');
  };

  const registerMovement = async (event: FormEvent) => {
    event.preventDefault();
    if (!movementItem || parseQty(movementQuantity) <= 0 || !movementReason.trim()) {
      showToast('Informe quantidade e motivo.', 'error');
      return;
    }
    const qty = parseQty(movementQuantity);
    const negative = movementType === 'exit' || movementType === 'loss';
    const { error } = await createClient().from('inventory_movements').insert({
      inventory_item_id: movementItem.id,
      movement_type: movementType,
      quantity_change: negative ? -qty : qty,
      unit_cost: movementType === 'entry' ? parseQty(movementCost) : null,
      reason: movementReason.trim(),
      created_by: operatorId,
    });
    if (error) {
      showToast(error.message, 'error');
      return;
    }
    const nextQuantity = Math.max(0, movementItem.quantity + (negative ? -qty : qty));
    setItems((current) =>
      current.map((item) =>
        item.id === movementItem.id
          ? {
              ...item,
              quantity: nextQuantity,
              average_cost: movementType === 'entry' ? parseQty(movementCost) : item.average_cost,
            }
          : item
      )
    );
    setMovementItem(null);
    showToast('Movimentação registrada.', 'success');
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Estoque físico"
        title="Inventário"
        description="Controle produtos, insumos, bebidas, açúcar, gelo, embalagens e perdas."
        action={
          <Button variant="primary" size="lg" onClick={() => openEditor()} className="normal-case">
            <PackagePlus size={16} />
            Novo item
          </Button>
        }
      />

      {formError && editing !== undefined && <ModalAlert variant="error" className="mt-4">{formError}</ModalAlert>}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar item no inventário"
          className="sm:max-w-sm"
        />
        <p className={lowCount ? 'text-sm font-bold text-red-400' : 'text-sm font-semibold text-brand-300'}>
          {lowCount ? `${lowCount} item(ns) no estoque mínimo` : 'Estoque sem alertas'}
        </p>
      </div>

      <Panel className="mt-5" noPadding bodyClassName="divide-y divide-border">
        {filtered.length ? (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${item.quantity <= item.minimum_quantity ? 'bg-red-500/10' : ''}`}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{item.name}</p>
                <p className="text-xs text-neutral-500">
                  {item.location || 'Sem local'} · {item.unit} · custo {formatCurrency(item.average_cost)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={item.quantity <= item.minimum_quantity ? 'font-bold text-red-400' : 'font-bold text-brand-300'}>
                  {item.quantity} {item.unit}
                </span>
                <div className="flex gap-1">
                  <button title="Entrada" onClick={() => openMovement(item, 'entry')} className="rounded-lg p-2 text-brand-300 hover:bg-brand-400/10">
                    <Plus size={16} />
                  </button>
                  <button title="Saída" onClick={() => openMovement(item, 'exit')} className="rounded-lg p-2 text-amber-400 hover:bg-amber-500/10">
                    <Minus size={16} />
                  </button>
                  <button title="Editar" onClick={() => openEditor(item)} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800">
                    <Pencil size={16} />
                  </button>
                  <button title="Excluir" onClick={() => setPendingDelete(item)} className="rounded-lg p-2 text-red-400 hover:bg-red-500/10">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="p-8 text-center text-sm text-neutral-500">Nenhum item encontrado.</p>
        )}
      </Panel>

      {editing !== undefined && (
        <Modal
          onClose={() => setEditing(undefined)}
          title={editing ? 'Editar item' : 'Novo item'}
          subtitle="Inventário"
          size="lg"
          footer={
            <ModalFooter>
              {editing && (
                <Button variant="danger" size="md" onClick={() => setPendingDelete(editing)} className="normal-case sm:mr-auto">
                  <Trash2 size={16} />
                  Excluir
                </Button>
              )}
              <Button variant="secondary" size="md" onClick={() => setEditing(undefined)} className="normal-case">
                Cancelar
              </Button>
              <Button type="submit" form="inventory-form" variant="primary" size="md" className="normal-case">
                Salvar item
              </Button>
            </ModalFooter>
          }
        >
          <form id="inventory-form" onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <FieldGroup label="Nome">
              <Input value={form.name} onChange={(e) => updateForm('name', e.target.value)} />
            </FieldGroup>
            <FieldGroup label="SKU/código">
              <Input value={form.sku} onChange={(e) => updateForm('sku', e.target.value)} />
            </FieldGroup>
            <FieldGroup label="Unidade">
              <Select value={form.unit} onChange={(e) => updateForm('unit', e.target.value)}>
                {units.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </Select>
            </FieldGroup>
            <FieldGroup label="Localização">
              <Input value={form.location} onChange={(e) => updateForm('location', e.target.value)} placeholder="Ex.: Depósito A" />
            </FieldGroup>
            <FieldGroup label="Quantidade inicial">
              <Input value={form.quantity} onChange={(e) => updateForm('quantity', e.target.value)} inputMode="decimal" />
            </FieldGroup>
            <FieldGroup label="Estoque mínimo">
              <Input value={form.minimum_quantity} onChange={(e) => updateForm('minimum_quantity', e.target.value)} inputMode="decimal" />
            </FieldGroup>
            <FieldGroup label="Custo médio">
              <Input value={form.average_cost} onChange={(e) => updateForm('average_cost', e.target.value)} inputMode="decimal" />
            </FieldGroup>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => updateForm('is_active', e.target.checked)} />
              Item ativo
            </label>
            <FieldGroup label="Observações" className="sm:col-span-2">
              <Textarea value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} rows={3} />
            </FieldGroup>
          </form>
        </Modal>
      )}

      {movementItem && (
        <Modal
          onClose={() => setMovementItem(null)}
          title={movementItem.name}
          subtitle="Movimentação de estoque"
          size="md"
          footer={
            <ModalFooter>
              <Button variant="secondary" size="md" onClick={() => setMovementItem(null)} className="normal-case">
                Cancelar
              </Button>
              <Button type="submit" form="movement-form" variant="primary" size="md" className="normal-case">
                Registrar
              </Button>
            </ModalFooter>
          }
        >
          <form id="movement-form" onSubmit={registerMovement} className="space-y-3">
            <FieldGroup label="Tipo">
              <Select value={movementType} onChange={(e) => setMovementType(e.target.value)}>
                <option value="entry">Entrada</option>
                <option value="exit">Saída</option>
                <option value="loss">Perda/descarte</option>
                <option value="adjustment">Ajuste de inventário</option>
              </Select>
            </FieldGroup>
            <FieldGroup label={`Quantidade (${movementItem.unit})`}>
              <Input value={movementQuantity} onChange={(e) => setMovementQuantity(e.target.value)} inputMode="decimal" />
            </FieldGroup>
            {movementType === 'entry' && (
              <FieldGroup label="Custo por unidade (R$)">
                <Input value={movementCost} onChange={(e) => setMovementCost(e.target.value)} inputMode="decimal" />
              </FieldGroup>
            )}
            <FieldGroup label="Motivo">
              <Input value={movementReason} onChange={(e) => setMovementReason(e.target.value)} placeholder="Ex.: Compra do fornecedor" />
            </FieldGroup>
          </form>
        </Modal>
      )}

      {pendingDelete && (
        <Modal
          onClose={() => setPendingDelete(null)}
          title="Excluir item"
          subtitle={pendingDelete.name}
          size="md"
          variant="center"
          motionPreset="fade"
          footer={
            <ModalFooter>
              <Button variant="secondary" size="md" onClick={() => setPendingDelete(null)} className="normal-case">
                Cancelar
              </Button>
              <Button variant="danger" size="md" onClick={remove} disabled={deleting} className="normal-case">
                {deleting ? 'Excluindo...' : 'Excluir item'}
              </Button>
            </ModalFooter>
          }
        >
          <ModalAlert variant="warning">O histórico de movimentações deste item também será removido.</ModalAlert>
        </Modal>
      )}

      <FloatingToast toast={toast} onClose={clearToast} />
    </PageContainer>
  );
}
