'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { History, Minus, PackagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatQty, salesLeft } from '@/lib/inventory/movements';
import { formatCurrency, parseDecimal } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { FloatingToast, useFloatingToast } from '@/components/ui/floating-toast';
import { FieldGroup, Input, Select, Textarea } from '@/components/ui/input';
import { Modal, ModalAlert, ModalFooter, ModalSection } from '@/components/ui/modal';
import { PageContainer, PageHeader, Panel } from '@/components/ui/page-layout';
import { InventoryHistory } from './InventoryHistory';

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

type Product = { id: string; name: string };

/** "base_quantity da unidade do item rende sales_count vendas do produto" (ex.: 30 L rendem 90 canecas). */
type Usage = {
  inventory_item_id: string;
  product_id: string;
  base_quantity: number;
  sales_count: number;
};

type UsageDraft = { product_id: string; base: string; count: string };

interface Props {
  storeId: string;
  operatorId: string;
  items: Item[];
  products: Product[];
  usages: Usage[];
  /** Falso enquanto supabase/migration_inventory_sales_usage.sql não foi executada. */
  usageEnabled: boolean;
}

const units = ['un', 'kg', 'g', 'L', 'ml', 'cx', 'pct'];
const ITEM_COLUMNS = 'id,name,sku,unit,quantity,minimum_quantity,average_cost,location,notes,is_active';
const REFRESH_MS = 30_000;

function parseQty(value: string) {
  const parsed = parseDecimal(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function InventoryManager({
  storeId,
  operatorId,
  items: initialItems,
  products,
  usages: initialUsages,
  usageEnabled,
}: Props) {
  const { toast, showToast, clearToast } = useFloatingToast();
  const [items, setItems] = useState(initialItems);
  const [usages, setUsages] = useState(initialUsages);
  const [usageDrafts, setUsageDrafts] = useState<UsageDraft[]>([]);
  const productName = (id: string) => products.find((product) => product.id === id)?.name ?? 'Produto removido';
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Item | null | undefined>();
  const [movementItem, setMovementItem] = useState<Item | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
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

  const historyItem = items.find((item) => item.id === historyId) ?? null;
  const historyRules = useMemo(
    () =>
      usages
        .filter((usage) => usage.inventory_item_id === historyId)
        .map(({ product_id, base_quantity, sales_count }) => ({
          product_name: products.find((product) => product.id === product_id)?.name ?? 'Produto removido',
          base_quantity,
          sales_count,
        })),
    [usages, products, historyId]
  );

  // As vendas baixam o estoque no banco: consulta de novo para a tela acompanhar.
  const refreshItems = useCallback(async () => {
    const { data } = await createClient().from('inventory_items').select(ITEM_COLUMNS).eq('store_id', storeId).order('name');
    if (data) setItems((data as Item[]).map((item) => ({ ...item, quantity: Number(item.quantity) })));
  }, [storeId]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void refreshItems();
    };
    const interval = setInterval(refreshIfVisible, REFRESH_MS);
    window.addEventListener('focus', refreshIfVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshIfVisible);
    };
  }, [refreshItems]);

  const openEditor = (item?: Item) => {
    setEditing(item ?? null);
    setFormError(null);
    setUsageDrafts(
      item
        ? usages
            .filter((usage) => usage.inventory_item_id === item.id)
            .map((usage) => ({
              product_id: usage.product_id,
              base: formatQty(usage.base_quantity),
              count: formatQty(usage.sales_count),
            }))
        : []
    );
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

  const updateUsageDraft = (index: number, patch: Partial<UsageDraft>) =>
    setUsageDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));

  const addUsageDraft = () =>
    setUsageDrafts((current) => [
      ...current,
      { product_id: '', base: parseQty(form.quantity) > 0 ? form.quantity : '1', count: '' },
    ]);

  /** Valida as ligações com o cardápio; devolve a mensagem de erro ou as linhas prontas para salvar. */
  const parseUsageDrafts = (): string | Omit<Usage, 'inventory_item_id'>[] => {
    const rows: Omit<Usage, 'inventory_item_id'>[] = [];
    for (const draft of usageDrafts) {
      if (!draft.product_id) return 'Escolha o produto em cada ligação com o cardápio.';
      const base = parseQty(draft.base);
      const count = parseQty(draft.count);
      if (base <= 0 || count <= 0) return `Preencha quanto rende para ${productName(draft.product_id)}.`;
      if (rows.some((row) => row.product_id === draft.product_id)) return `${productName(draft.product_id)} aparece duas vezes.`;
      rows.push({ product_id: draft.product_id, base_quantity: base, sales_count: count });
    }
    return rows;
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setFormError('Informe o nome do item.');
      return;
    }
    const usageRows = parseUsageDrafts();
    if (typeof usageRows === 'string') {
      setFormError(usageRows);
      return;
    }
    const quantity = parseQty(form.quantity);
    if (quantity < 0) {
      setFormError('A quantidade não pode ser negativa.');
      return;
    }
    const payload = {
      store_id: storeId,
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      unit: form.unit,
      minimum_quantity: parseQty(form.minimum_quantity),
      average_cost: parseQty(form.average_cost),
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };
    const query = editing
      ? createClient().from('inventory_items').update(payload).eq('id', editing.id).select('*').single()
      : createClient().from('inventory_items').insert({ ...payload, quantity }).select('*').single();
    const { data, error } = await query;
    if (error || !data) {
      setFormError(error?.message || 'Não foi possível salvar o item.');
      return;
    }
    const saved = { ...(data as Item), quantity: Number(data.quantity) };

    // Ao editar, a quantidade só muda se a pessoa corrigiu o campo, e como ajuste no histórico.
    // Gravar o valor da tela desfaria as vendas feitas depois que o formulário abriu.
    const correction = editing && quantity !== editing.quantity ? Math.round((quantity - saved.quantity) * 1000) / 1000 : 0;
    if (correction) {
      const { error: correctionError } = await createClient().from('inventory_movements').insert({
        inventory_item_id: saved.id,
        movement_type: 'adjustment',
        quantity_change: correction,
        reason: 'Quantidade corrigida na edição do item',
        created_by: operatorId,
      });
      if (correctionError) {
        setFormError(`Item salvo, mas a quantidade não foi corrigida: ${correctionError.message}`);
        return;
      }
      saved.quantity = quantity;
    }
    setItems((current) =>
      editing ? current.map((item) => (item.id === editing.id ? saved : item)) : [saved, ...current]
    );

    if (usageEnabled) {
      // Regrava as ligações do item: são poucas linhas e isso evita lidar com cada alteração.
      const supabase = createClient();
      const { error: deleteError } = await supabase.from('inventory_product_usage').delete().eq('inventory_item_id', saved.id);
      if (!deleteError) setUsages((current) => current.filter((usage) => usage.inventory_item_id !== saved.id));
      const nextUsages = usageRows.map((row) => ({ ...row, inventory_item_id: saved.id }));
      const { error: insertError } =
        deleteError || !nextUsages.length
          ? { error: deleteError }
          : await supabase.from('inventory_product_usage').insert(nextUsages);
      if (insertError) {
        setEditing(saved);
        setFormError(`Item salvo, mas a ligação com o cardápio falhou: ${insertError.message}`);
        return;
      }
      setUsages((current) => [...current, ...nextUsages]);
    }

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
    void refreshItems();
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
                {usages
                  .filter((usage) => usage.inventory_item_id === item.id)
                  .map((usage) => (
                    <p key={usage.product_id} className="mt-1 text-sm text-neutral-300">
                      Dá para vender <strong className="text-brand-300">≈ {salesLeft(item.quantity, usage)}</strong> ×{' '}
                      {productName(usage.product_id)}
                    </p>
                  ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={item.quantity <= item.minimum_quantity ? 'font-bold text-red-400' : 'font-bold text-brand-300'}>
                  {formatQty(item.quantity)} {item.unit}
                </span>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setHistoryId(item.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
                  >
                    <History size={14} />
                    Movimentações
                  </button>
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
          headerActions={
            editing ? (
              <button
                type="button"
                title="Excluir item"
                aria-label="Excluir item"
                onClick={() => setPendingDelete(editing)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-red-400 transition-colors hover:bg-red-500/10 sm:h-9 sm:w-9"
              >
                <Trash2 size={16} />
              </button>
            ) : undefined
          }
          footer={
            <ModalFooter>
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
            {formError && <ModalAlert variant="error" className="sm:col-span-2">{formError}</ModalAlert>}
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
            <FieldGroup label={editing ? 'Quantidade atual (mude só para corrigir)' : 'Quantidade inicial'}>
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

            <div className="rounded-2xl border border-border bg-neutral-900 p-4 sm:col-span-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-400">Baixa automática nas vendas</p>
              {usageEnabled ? (
                <>
                  <p className="mt-1 text-xs text-neutral-500">
                    Ligue este item aos produtos do cardápio que gastam ele. A cada venda o estoque baixa sozinho. Ex.: barril
                    de chope: 30 L rendem 90 canecas.
                  </p>
                  <div className="mt-3 space-y-3">
                    {usageDrafts.map((draft, index) => (
                      <div key={index} className="rounded-xl border border-border p-3">
                        <div className="flex items-center gap-2">
                          <Select
                            value={draft.product_id}
                            onChange={(e) => updateUsageDraft(index, { product_id: e.target.value })}
                            aria-label="Produto do cardápio"
                            className="min-w-0 flex-1"
                          >
                            <option value="">Escolha o produto vendido</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>{product.name}</option>
                            ))}
                          </Select>
                          <button
                            type="button"
                            title="Remover ligação"
                            onClick={() => setUsageDrafts((current) => current.filter((_, i) => i !== index))}
                            className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-300">
                          <Input
                            value={draft.base}
                            onChange={(e) => updateUsageDraft(index, { base: e.target.value })}
                            inputMode="decimal"
                            aria-label={`Quantidade em ${form.unit}`}
                            className="w-20"
                          />
                          <span>{form.unit} rendem</span>
                          <Input
                            value={draft.count}
                            onChange={(e) => updateUsageDraft(index, { count: e.target.value })}
                            inputMode="decimal"
                            placeholder="90"
                            aria-label="Quantidade de vendas"
                            className="w-20"
                          />
                          <span>vendas</span>
                        </div>
                        {parseQty(draft.base) > 0 && parseQty(draft.count) > 0 && (
                          <p className="mt-2 text-xs text-neutral-400">
                            Cada venda tira{' '}
                            <strong className="text-brand-300">
                              {formatQty(parseQty(draft.base) / parseQty(draft.count))} {form.unit}
                            </strong>{' '}
                            do estoque.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="secondary" size="sm" onClick={addUsageDraft} className="mt-3 normal-case">
                    <Plus size={14} />
                    Ligar a um produto do cardápio
                  </Button>
                </>
              ) : (
                <p className="mt-1 text-xs text-neutral-500">
                  Execute <code>supabase/migration_inventory_sales_usage.sql</code> para ativar a baixa automática.
                </p>
              )}
            </div>
          </form>
        </Modal>
      )}

      {historyItem && <InventoryHistory item={historyItem} rules={historyRules} onClose={() => setHistoryId(null)} />}

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
