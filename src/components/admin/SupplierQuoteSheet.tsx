'use client';

import { FormEvent, KeyboardEvent, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, History, PackagePlus, Store, Trash2, Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, parseDecimal } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { FloatingToast, useFloatingToast } from '@/components/ui/floating-toast';
import { FieldGroup, Input, Select } from '@/components/ui/input';
import { Modal, ModalAlert, ModalFooter } from '@/components/ui/modal';
import { PageContainer, PageHeader, Panel } from '@/components/ui/page-layout';

type Supplier = { id: string; name: string; phone: string | null };
type Item = { id: string; name: string; unit: string };
export type Quote = { id: string; item_id: string; supplier_id: string; price: number; quoted_at: string };

type CellInfo = { price: number; quotedAt: string; previous: number | null };
type PendingDelete = { kind: 'item'; target: Item } | { kind: 'supplier'; target: Supplier };

interface Props {
  storeId: string;
  operatorId: string;
  suppliers: Supplier[];
  items: Item[];
  quotes: Quote[];
}

const units = ['un', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'dz', 'fardo'];
/** Preço com mais de uma semana aparece em alerta para lembrar de confirmar com o fornecedor. */
const STALE_DAYS = 7;

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'pt-BR');
const cellKey = (itemId: string, supplierId: string) => `${itemId}:${supplierId}`;

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function isStale(iso: string) {
  return Date.now() - new Date(iso).getTime() > STALE_DAYS * 24 * 60 * 60 * 1000;
}

export function SupplierQuoteSheet({ storeId, operatorId, suppliers: initialSuppliers, items: initialItems, quotes: initialQuotes }: Props) {
  const { toast, showToast, clearToast } = useFloatingToast();
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [items, setItems] = useState(initialItems);
  const [quotes, setQuotes] = useState(initialQuotes);
  const [search, setSearch] = useState('');

  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemUnit, setItemUnit] = useState('kg');
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [historyItem, setHistoryItem] = useState<Item | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);

  /** Último preço de cada célula (produto x fornecedor) e o anterior, para mostrar se subiu ou desceu. */
  const cells = useMemo(() => {
    const map = new Map<string, CellInfo>();
    const sorted = [...quotes].sort((a, b) => b.quoted_at.localeCompare(a.quoted_at));
    for (const quote of sorted) {
      const key = cellKey(quote.item_id, quote.supplier_id);
      const current = map.get(key);
      if (!current) map.set(key, { price: quote.price, quotedAt: quote.quoted_at, previous: null });
      else if (current.previous === null) current.previous = quote.price;
    }
    return map;
  }, [quotes]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items
      .filter((item) => item.name.toLowerCase().includes(term))
      .map((item) => {
        const priced = suppliers
          .map((supplier) => ({ supplier, cell: cells.get(cellKey(item.id, supplier.id)) }))
          .filter((entry): entry is { supplier: Supplier; cell: CellInfo } => Boolean(entry.cell));
        const best = priced.reduce<(typeof priced)[number] | null>((min, entry) => (!min || entry.cell.price < min.cell.price ? entry : min), null);
        const worst = priced.reduce((max, entry) => Math.max(max, entry.cell.price), 0);
        return { item, best, worst, pricedCount: priced.length };
      });
  }, [items, suppliers, cells, search]);

  const startEdit = (itemId: string, supplierId: string) => {
    const key = cellKey(itemId, supplierId);
    const current = cells.get(key);
    setEditingCell(key);
    setDraft(current ? current.price.toFixed(2).replace('.', ',') : '');
  };

  const saveCell = async (itemId: string, supplierId: string, force: boolean) => {
    const key = cellKey(itemId, supplierId);
    const current = cells.get(key);
    const initialDraft = current ? current.price.toFixed(2).replace('.', ',') : '';
    setEditingCell(null);
    if (!draft.trim() || (!force && draft === initialDraft)) return;

    const price = parseDecimal(draft);
    if (!Number.isFinite(price) || price < 0) {
      showToast('Preço inválido. Use algo como 7,90.', 'error');
      return;
    }

    setSavingCell(key);
    const { data, error } = await createClient()
      .from('purchase_quotes')
      .insert({ item_id: itemId, supplier_id: supplierId, price, created_by: operatorId })
      .select('id,item_id,supplier_id,price,quoted_at')
      .single();
    setSavingCell(null);
    if (error || !data) {
      showToast(error?.message || 'Não foi possível salvar o preço.', 'error');
      return;
    }
    setQuotes((list) => [{ ...(data as Quote), price: Number(data.price) }, ...list]);
  };

  const handleCellKey = (event: KeyboardEvent<HTMLInputElement>, itemId: string, supplierId: string) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void saveCell(itemId, supplierId, true);
    } else if (event.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const openItemForm = () => {
    setItemName('');
    setItemUnit('kg');
    setFormError(null);
    setItemFormOpen(true);
  };

  const openSupplierForm = () => {
    setSupplierName('');
    setSupplierPhone('');
    setFormError(null);
    setSupplierFormOpen(true);
  };

  const saveItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!itemName.trim()) {
      setFormError('Informe o nome do produto.');
      return;
    }
    const { data, error } = await createClient()
      .from('purchase_items')
      .insert({ store_id: storeId, name: itemName.trim(), unit: itemUnit })
      .select('id,name,unit')
      .single();
    if (error || !data) {
      setFormError(error?.code === '23505' ? 'Esse produto já está na planilha.' : error?.message || 'Não foi possível salvar.');
      return;
    }
    setItems((list) => [...list, data as Item].sort(byName));
    setItemFormOpen(false);
    showToast('Produto adicionado à planilha.', 'success');
  };

  const saveSupplier = async (event: FormEvent) => {
    event.preventDefault();
    if (!supplierName.trim()) {
      setFormError('Informe o nome do fornecedor.');
      return;
    }
    const { data, error } = await createClient()
      .from('purchase_suppliers')
      .insert({ store_id: storeId, name: supplierName.trim(), phone: supplierPhone.trim() || null })
      .select('id,name,phone')
      .single();
    if (error || !data) {
      setFormError(error?.code === '23505' ? 'Esse fornecedor já está na planilha.' : error?.message || 'Não foi possível salvar.');
      return;
    }
    setSuppliers((list) => [...list, data as Supplier].sort(byName));
    setSupplierFormOpen(false);
    showToast('Fornecedor adicionado à planilha.', 'success');
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const table = pendingDelete.kind === 'item' ? 'purchase_items' : 'purchase_suppliers';
    const { error } = await createClient().from(table).delete().eq('id', pendingDelete.target.id);
    setDeleting(false);
    if (error) {
      showToast(error.message, 'error');
      return;
    }
    const id = pendingDelete.target.id;
    if (pendingDelete.kind === 'item') {
      setItems((list) => list.filter((item) => item.id !== id));
      setQuotes((list) => list.filter((quote) => quote.item_id !== id));
    } else {
      setSuppliers((list) => list.filter((supplier) => supplier.id !== id));
      setQuotes((list) => list.filter((quote) => quote.supplier_id !== id));
    }
    setPendingDelete(null);
    showToast(pendingDelete.kind === 'item' ? 'Produto removido.' : 'Fornecedor removido.', 'success');
  };

  const supplierLabel = (id: string) => suppliers.find((supplier) => supplier.id === id)?.name ?? 'Fornecedor';
  const history = historyItem
    ? quotes.filter((quote) => quote.item_id === historyItem.id).sort((a, b) => b.quoted_at.localeCompare(a.quoted_at))
    : [];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Compras"
        title="Cotação de fornecedores"
        description="Anote o preço de cada produto em cada fornecedor e veja na hora onde está mais barato."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="lg" onClick={openSupplierForm} className="normal-case">
              <Store size={16} />
              Novo fornecedor
            </Button>
            <Button variant="primary" size="lg" onClick={openItemForm} className="normal-case">
              <PackagePlus size={16} />
              Novo produto
            </Button>
          </div>
        }
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produto (ex.: tomate)"
          className="sm:max-w-sm"
        />
        <p className="text-xs text-neutral-500">
          Toque no preço para editar · <span className="text-brand-300">verde</span> = mais barato ·{' '}
          <span className="text-amber-400">amarelo</span> = preço com mais de {STALE_DAYS} dias
        </p>
      </div>

      <Panel className="mt-5" noPadding>
        {!suppliers.length && !items.length ? (
          <div className="p-8 text-center text-sm text-neutral-500">
            Comece cadastrando os fornecedores e os produtos que vocês compram.
          </div>
        ) : (
          <div className="overflow-x-auto">
            {!suppliers.length && (
              <p className="border-b border-border p-4 text-center text-sm text-neutral-500">
                Cadastre pelo menos um fornecedor para começar a anotar preços.
              </p>
            )}
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                  <th className="sticky left-0 z-10 min-w-[10rem] bg-surface-elevated px-4 py-3">Produto</th>
                  {suppliers.map((supplier) => (
                    <th key={supplier.id} className="min-w-[8.5rem] px-3 py-3">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate" title={supplier.phone ?? undefined}>{supplier.name}</span>
                        <button
                          title={`Remover ${supplier.name}`}
                          onClick={() => setPendingDelete({ kind: 'supplier', target: supplier })}
                          className="rounded-md p-1 text-neutral-600 hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="min-w-[10rem] px-3 py-3 text-brand-300">Melhor preço</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length ? (
                  rows.map(({ item, best, worst, pricedCount }) => (
                    <tr key={item.id} className="group">
                      <td className="sticky left-0 z-10 bg-surface-elevated px-4 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">{item.name}</p>
                            <p className="text-xs text-neutral-500">por {item.unit}</p>
                          </div>
                          <div className="flex shrink-0">
                            <button title="Histórico de preços" onClick={() => setHistoryItem(item)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800">
                              <History size={14} />
                            </button>
                            <button title="Remover produto" onClick={() => setPendingDelete({ kind: 'item', target: item })} className="rounded-lg p-1.5 text-red-400/70 hover:bg-red-500/10 hover:text-red-400">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </td>
                      {suppliers.map((supplier) => {
                        const key = cellKey(item.id, supplier.id);
                        const cell = cells.get(key);
                        const isBest = Boolean(cell && best && pricedCount > 1 && cell.price === best.cell.price);
                        return (
                          <td key={supplier.id} className={`px-1 py-1 ${isBest ? 'bg-brand-400/10' : ''}`}>
                            {editingCell === key ? (
                              <input
                                autoFocus
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onBlur={() => void saveCell(item.id, supplier.id, false)}
                                onKeyDown={(e) => handleCellKey(e, item.id, supplier.id)}
                                inputMode="decimal"
                                placeholder="0,00"
                                className="h-12 w-full rounded-lg border border-brand-400/60 bg-black px-2 text-right font-semibold text-ink outline-none"
                              />
                            ) : (
                              <button
                                onClick={() => startEdit(item.id, supplier.id)}
                                disabled={savingCell === key}
                                className="flex h-12 w-full flex-col items-end justify-center rounded-lg px-2 text-right hover:bg-white/5 disabled:opacity-50"
                              >
                                {cell ? (
                                  <>
                                    <span className={`font-semibold ${isBest ? 'text-brand-300' : 'text-ink'}`}>{formatCurrency(cell.price)}</span>
                                    <span className={`flex items-center gap-0.5 text-[10px] ${isStale(cell.quotedAt) ? 'text-amber-400' : 'text-neutral-500'}`}>
                                      {cell.previous !== null && cell.previous !== cell.price &&
                                        (cell.price > cell.previous ? (
                                          <ArrowUp size={10} className="text-red-400" />
                                        ) : (
                                          <ArrowDown size={10} className="text-brand-300" />
                                        ))}
                                      {formatShortDate(cell.quotedAt)}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-neutral-600">{savingCell === key ? 'Salvando…' : '—'}</span>
                                )}
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2">
                        {best ? (
                          <div>
                            <p className="flex items-center gap-1 font-semibold text-brand-300">
                              <Trophy size={12} />
                              {formatCurrency(best.cell.price)}
                            </p>
                            <p className="truncate text-xs text-neutral-400">{best.supplier.name}</p>
                            {pricedCount > 1 && worst > best.cell.price && (
                              <p className="text-[10px] text-neutral-500">
                                economia de {formatCurrency(worst - best.cell.price)} por {item.unit}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-600">Sem preço</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={suppliers.length + 2} className="p-8 text-center text-sm text-neutral-500">
                      {items.length ? 'Nenhum produto encontrado.' : 'Cadastre os produtos que vocês compram (tomate, cebola, carne...).'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {itemFormOpen && (
        <Modal
          onClose={() => setItemFormOpen(false)}
          title="Novo produto"
          subtitle="Cotação"
          size="md"
          footer={
            <ModalFooter>
              <Button variant="secondary" size="md" onClick={() => setItemFormOpen(false)} className="normal-case">
                Cancelar
              </Button>
              <Button type="submit" form="quote-item-form" variant="primary" size="md" className="normal-case">
                Adicionar
              </Button>
            </ModalFooter>
          }
        >
          <form id="quote-item-form" onSubmit={saveItem} className="space-y-3">
            {formError && <ModalAlert variant="error">{formError}</ModalAlert>}
            <FieldGroup label="Produto">
              <Input autoFocus value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Ex.: Tomate" />
            </FieldGroup>
            <FieldGroup label="Preço comparado por">
              <Select value={itemUnit} onChange={(e) => setItemUnit(e.target.value)}>
                {units.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </Select>
            </FieldGroup>
          </form>
        </Modal>
      )}

      {supplierFormOpen && (
        <Modal
          onClose={() => setSupplierFormOpen(false)}
          title="Novo fornecedor"
          subtitle="Cotação"
          size="md"
          footer={
            <ModalFooter>
              <Button variant="secondary" size="md" onClick={() => setSupplierFormOpen(false)} className="normal-case">
                Cancelar
              </Button>
              <Button type="submit" form="quote-supplier-form" variant="primary" size="md" className="normal-case">
                Adicionar
              </Button>
            </ModalFooter>
          }
        >
          <form id="quote-supplier-form" onSubmit={saveSupplier} className="space-y-3">
            {formError && <ModalAlert variant="error">{formError}</ModalAlert>}
            <FieldGroup label="Fornecedor">
              <Input autoFocus value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Ex.: Ceasa, Atacadão" />
            </FieldGroup>
            <FieldGroup label="Telefone (opcional)">
              <Input value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} inputMode="tel" />
            </FieldGroup>
          </form>
        </Modal>
      )}

      {historyItem && (
        <Modal onClose={() => setHistoryItem(null)} title={historyItem.name} subtitle="Histórico de preços" size="md">
          {history.length ? (
            <ul className="divide-y divide-border">
              {history.map((quote) => (
                <li key={quote.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{supplierLabel(quote.supplier_id)}</p>
                    <p className="text-xs text-neutral-500">
                      {new Date(quote.quoted_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  <span className="font-semibold text-ink">
                    {formatCurrency(quote.price)} <span className="text-xs text-neutral-500">/{historyItem.unit}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-neutral-500">Nenhum preço anotado ainda.</p>
          )}
        </Modal>
      )}

      {pendingDelete && (
        <Modal
          onClose={() => setPendingDelete(null)}
          title={pendingDelete.kind === 'item' ? 'Remover produto' : 'Remover fornecedor'}
          subtitle={pendingDelete.target.name}
          size="md"
          variant="center"
          motionPreset="fade"
          footer={
            <ModalFooter>
              <Button variant="secondary" size="md" onClick={() => setPendingDelete(null)} className="normal-case">
                Cancelar
              </Button>
              <Button variant="danger" size="md" onClick={remove} disabled={deleting} className="normal-case">
                {deleting ? 'Removendo...' : 'Remover'}
              </Button>
            </ModalFooter>
          }
        >
          <ModalAlert variant="warning">Todo o histórico de preços {pendingDelete.kind === 'item' ? 'deste produto' : 'deste fornecedor'} também será apagado.</ModalAlert>
        </Modal>
      )}

      <FloatingToast toast={toast} onClose={clearToast} />
    </PageContainer>
  );
}
