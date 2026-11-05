'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import { Check, History, Plus, Store, Trash2, Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { formatCurrency, parseDecimal } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { FloatingToast, useFloatingToast } from '@/components/ui/floating-toast';
import { FieldGroup, Input } from '@/components/ui/input';
import { Modal, ModalAlert, ModalFooter } from '@/components/ui/modal';
import { PageContainer, PageHeader, Panel } from '@/components/ui/page-layout';

type Supplier = { id: string; name: string; phone: string | null };
type Item = { id: string; name: string; unit: string };
export type Quote = { id: string; item_id: string; supplier_id: string; price: number; quoted_at: string };

type Latest = { price: number; quotedAt: string; previous: number | null };
type Entry = Latest & { supplier: Supplier };
type PriceForm = { product: string; unit: string; supplier: string; price: string };
type PendingDelete = { kind: 'item'; target: Item } | { kind: 'supplier'; target: Supplier };

interface Props {
  storeId: string;
  operatorId: string;
  suppliers: Supplier[];
  items: Item[];
  quotes: Quote[];
}

const units = [
  { value: 'kg', label: 'Quilo', short: 'kg' },
  { value: 'un', label: 'Unidade', short: 'unidade' },
  { value: 'cx', label: 'Caixa', short: 'caixa' },
  { value: 'pct', label: 'Pacote', short: 'pacote' },
  { value: 'dz', label: 'Dúzia', short: 'dúzia' },
  { value: 'fardo', label: 'Fardo', short: 'fardo' },
  { value: 'L', label: 'Litro', short: 'litro' },
  { value: 'g', label: 'Grama', short: 'g' },
  { value: 'ml', label: 'ml', short: 'ml' },
];
/** Preço com mais de uma semana aparece em alerta para lembrar de confirmar com o fornecedor. */
const STALE_DAYS = 7;
const emptyForm: PriceForm = { product: '', unit: 'kg', supplier: '', price: '' };

const unitShort = (unit: string) => units.find((entry) => entry.value === unit)?.short ?? unit;
const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'pt-BR');
/** Compara nomes sem acento e sem maiúscula: "atacadao" encontra "Atacadão". */
const normalize = (value: string) =>
  value.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');

function daysAgo(iso: string) {
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);
}

function formatWhen(iso: string) {
  const days = daysAgo(iso);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  return `há ${days} dias`;
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors',
        active ? 'border-brand-400 bg-brand-400/15 text-brand-200' : 'border-border text-neutral-300 hover:border-neutral-500'
      )}
    >
      {active && <Check size={13} />}
      {children}
    </button>
  );
}

export function SupplierQuoteSheet({ storeId, operatorId, suppliers: initialSuppliers, items: initialItems, quotes: initialQuotes }: Props) {
  const { toast, showToast, clearToast } = useFloatingToast();
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [items, setItems] = useState(initialItems);
  const [quotes, setQuotes] = useState(initialQuotes);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState<PriceForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const productInputRef = useRef<HTMLInputElement>(null);

  const [suppliersOpen, setSuppliersOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<Item | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);

  /** Último preço de cada produto em cada fornecedor, e o anterior para dizer se subiu ou baixou. */
  const latest = useMemo(() => {
    const map = new Map<string, Map<string, Latest>>();
    const sorted = [...quotes].sort((a, b) => b.quoted_at.localeCompare(a.quoted_at));
    for (const quote of sorted) {
      const bySupplier = map.get(quote.item_id) ?? new Map<string, Latest>();
      map.set(quote.item_id, bySupplier);
      const current = bySupplier.get(quote.supplier_id);
      if (!current) bySupplier.set(quote.supplier_id, { price: quote.price, quotedAt: quote.quoted_at, previous: null });
      else if (current.previous === null) current.previous = quote.price;
    }
    return map;
  }, [quotes]);

  const cards = useMemo(() => {
    const term = normalize(search);
    return items
      .filter((item) => normalize(item.name).includes(term))
      .map((item) => {
        const bySupplier = latest.get(item.id);
        const entries: Entry[] = suppliers
          .flatMap((supplier) => {
            const info = bySupplier?.get(supplier.id);
            return info ? [{ ...info, supplier }] : [];
          })
          .sort((a, b) => a.price - b.price);
        return { item, entries };
      });
  }, [items, suppliers, latest, search]);

  const matchedItem = form ? items.find((item) => normalize(item.name) === normalize(form.product)) : undefined;
  const matchedSupplier = form ? suppliers.find((supplier) => normalize(supplier.name) === normalize(form.supplier)) : undefined;
  const lastPriceHere = matchedItem && matchedSupplier ? latest.get(matchedItem.id)?.get(matchedSupplier.id) : undefined;
  const productSuggestions = form && !matchedItem
    ? items.filter((item) => normalize(item.name).includes(normalize(form.product))).slice(0, 10)
    : [];
  const supplierSuggestions = form && !matchedSupplier
    ? suppliers.filter((supplier) => normalize(supplier.name).includes(normalize(form.supplier))).slice(0, 10)
    : [];
  const formUnit = matchedItem?.unit ?? form?.unit ?? 'kg';

  const openForm = (prefill?: { item?: Item; supplier?: Supplier }) => {
    setFormError(null);
    setForm({
      ...emptyForm,
      product: prefill?.item?.name ?? '',
      unit: prefill?.item?.unit ?? 'kg',
      supplier: prefill?.supplier?.name ?? '',
    });
  };

  const updateForm = (key: keyof PriceForm, value: string) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const save = async (keepOpen: boolean) => {
    if (!form || saving) return;
    const productName = form.product.trim();
    const supplierName = form.supplier.trim();
    const price = parseDecimal(form.price.replace(/[^\d.,]/g, ''));
    if (!productName) return setFormError('Escreva qual é o produto.');
    if (!supplierName) return setFormError('Escreva em qual fornecedor você viu esse preço.');
    if (!Number.isFinite(price) || price <= 0) return setFormError('Digite o preço. Exemplo: 6,90');

    setSaving(true);
    setFormError(null);
    const supabase = createClient();

    let item = matchedItem;
    if (!item) {
      const { data, error } = await supabase
        .from('purchase_items')
        .insert({ store_id: storeId, name: productName, unit: form.unit })
        .select('id,name,unit')
        .single();
      if (error || !data) {
        setSaving(false);
        return setFormError(error?.message || 'Não foi possível cadastrar o produto.');
      }
      item = data as Item;
      setItems((list) => [...list, data as Item].sort(byName));
    }

    let supplier = matchedSupplier;
    if (!supplier) {
      const { data, error } = await supabase
        .from('purchase_suppliers')
        .insert({ store_id: storeId, name: supplierName })
        .select('id,name,phone')
        .single();
      if (error || !data) {
        setSaving(false);
        return setFormError(error?.message || 'Não foi possível cadastrar o fornecedor.');
      }
      supplier = data as Supplier;
      setSuppliers((list) => [...list, data as Supplier].sort(byName));
    }

    const { data, error } = await supabase
      .from('purchase_quotes')
      .insert({ item_id: item.id, supplier_id: supplier.id, price, created_by: operatorId })
      .select('id,item_id,supplier_id,price,quoted_at')
      .single();
    setSaving(false);
    if (error || !data) return setFormError(error?.message || 'Não foi possível salvar o preço.');

    setQuotes((list) => [{ ...(data as Quote), price: Number(data.price) }, ...list]);
    showToast(`Preço salvo: ${item.name} · ${supplier.name} · ${formatCurrency(price)}`, 'success');
    if (keepOpen) {
      // Mesmo fornecedor, próximo produto: útil quando está com a nota da compra na mão.
      setForm({ ...emptyForm, supplier: supplier.name });
      productInputRef.current?.focus();
    } else {
      setForm(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save(false);
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
    showToast(pendingDelete.kind === 'item' ? 'Produto apagado.' : 'Fornecedor apagado.', 'success');
  };

  const supplierLabel = (id: string) => suppliers.find((supplier) => supplier.id === id)?.name ?? 'Fornecedor';
  const history = historyItem
    ? quotes.filter((quote) => quote.item_id === historyItem.id).sort((a, b) => b.quoted_at.localeCompare(a.quoted_at))
    : [];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Compras"
        title="Preços dos fornecedores"
        description="Anote quanto cada fornecedor está cobrando e veja na hora onde está mais barato."
        action={
          <div className="flex flex-wrap gap-2">
            {suppliers.length > 0 && (
              <Button variant="secondary" size="lg" onClick={() => setSuppliersOpen(true)} className="normal-case">
                <Store size={16} />
                Fornecedores ({suppliers.length})
              </Button>
            )}
            <Button variant="primary" size="lg" onClick={() => openForm()} className="normal-case">
              <Plus size={16} />
              Anotar preço
            </Button>
          </div>
        }
      />

      {items.length > 0 && (
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="O que você vai comprar? Ex.: tomate"
          className="mt-6 sm:max-w-sm"
        />
      )}

      {!items.length ? (
        <Panel className="mt-6">
          <div className="mx-auto max-w-md py-6 text-center">
            <p className="font-serif text-lg font-bold text-ink">Nenhum preço anotado ainda</p>
            <p className="mt-2 text-sm text-neutral-400">
              Toque em <strong className="text-ink">Anotar preço</strong> e escreva o produto, o fornecedor e quanto
              custa. Quando tiver o preço de mais de um fornecedor, o mais barato aparece em verde.
            </p>
            <Button variant="primary" size="lg" onClick={() => openForm()} className="mt-5 normal-case">
              <Plus size={16} />
              Anotar o primeiro preço
            </Button>
          </div>
        </Panel>
      ) : !cards.length ? (
        <p className="mt-6 text-center text-sm text-neutral-500">Nenhum produto com esse nome.</p>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ item, entries }) => {
            const best = entries[0];
            return (
              <Panel key={item.id} noPadding bodyClassName="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3 p-4 pb-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-ink">{item.name}</p>
                    <p className="text-xs text-neutral-500">preço por {unitShort(item.unit)}</p>
                  </div>
                  <div className="flex shrink-0">
                    <button title="Histórico de preços" onClick={() => setHistoryItem(item)} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800">
                      <History size={16} />
                    </button>
                    <button title="Apagar produto" onClick={() => setPendingDelete({ kind: 'item', target: item })} className="rounded-lg p-2 text-red-400/70 hover:bg-red-500/10 hover:text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {best ? (
                  <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-xl border border-brand-400/30 bg-brand-400/10 p-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-300">
                        <Trophy size={12} />
                        {entries.length > 1 ? 'Mais barato' : 'Único preço anotado'}
                      </p>
                      <p className="truncate font-semibold text-ink">{best.supplier.name}</p>
                    </div>
                    <p className="shrink-0 text-2xl font-bold text-brand-300">{formatCurrency(best.price)}</p>
                  </div>
                ) : (
                  <p className="px-4 pb-3 text-sm text-neutral-500">Nenhum preço anotado ainda.</p>
                )}

                {entries.length > 1 && (
                  <ul className="divide-y divide-border border-t border-border">
                    {entries.map((entry, index) => {
                      const stale = daysAgo(entry.quotedAt) > STALE_DAYS;
                      const diffToBest = entry.price - best.price;
                      return (
                        <li key={entry.supplier.id}>
                          <button
                            onClick={() => openForm({ item, supplier: entry.supplier })}
                            title="Atualizar este preço"
                            className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-white/5"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-ink">{entry.supplier.name}</p>
                              <p className={cn('text-xs', stale ? 'text-amber-400' : 'text-neutral-500')}>
                                {formatWhen(entry.quotedAt)}
                                {stale && ' · confirmar preço'}
                                {entry.previous !== null && entry.previous !== entry.price && (
                                  <span className={entry.price > entry.previous ? 'text-red-400' : 'text-brand-300'}>
                                    {' · '}
                                    {entry.price > entry.previous ? 'subiu' : 'baixou'} {formatCurrency(Math.abs(entry.price - entry.previous))}
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className={cn('font-semibold', index === 0 ? 'text-brand-300' : 'text-ink')}>{formatCurrency(entry.price)}</p>
                              {index > 0 && (
                                <p className="text-[11px] text-neutral-500">
                                  {diffToBest > 0 ? `+${formatCurrency(diffToBest)}` : 'mesmo preço'}
                                </p>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {entries.length === 1 && (
                  <p className={cn('px-4 pb-3 text-xs', daysAgo(best.quotedAt) > STALE_DAYS ? 'text-amber-400' : 'text-neutral-500')}>
                    Anotado {formatWhen(best.quotedAt)}
                    {daysAgo(best.quotedAt) > STALE_DAYS && ' · confirmar preço'}
                  </p>
                )}

                <div className="mt-auto border-t border-border p-3">
                  <Button variant="outline" size="md" fullWidth onClick={() => openForm({ item })} className="normal-case">
                    <Plus size={16} />
                    Anotar preço de {item.name}
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {form && (
        <Modal
          onClose={() => setForm(null)}
          title="Anotar preço"
          subtitle="Compras"
          description="Comprou vários itens no mesmo lugar? Use “Salvar e anotar outro”: o fornecedor continua escolhido."
          size="md"
          footer={
            <ModalFooter>
              <Button variant="secondary" size="md" onClick={() => void save(true)} disabled={saving} className="normal-case">
                Salvar e anotar outro
              </Button>
              <Button type="submit" form="price-form" variant="primary" size="md" disabled={saving} className="normal-case">
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </ModalFooter>
          }
        >
          <form id="price-form" onSubmit={submit} className="space-y-5">
            <FieldGroup label="1. Qual produto?">
              <Input
                ref={productInputRef}
                autoFocus={!form.product}
                value={form.product}
                onChange={(e) => updateForm('product', e.target.value)}
                placeholder="Ex.: Tomate"
              />
              {matchedItem ? (
                <p className="mt-2 flex items-center gap-1 text-xs text-brand-300">
                  <Check size={13} /> Produto já cadastrado · preço por {unitShort(matchedItem.unit)}
                </p>
              ) : (
                <>
                  {productSuggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {productSuggestions.map((item) => (
                        <Chip key={item.id} onClick={() => updateForm('product', item.name)}>{item.name}</Chip>
                      ))}
                    </div>
                  )}
                  {form.product.trim() && (
                    <div className="mt-3">
                      <p className="mb-2 text-xs text-neutral-400">Produto novo. O preço é por:</p>
                      <div className="flex flex-wrap gap-2">
                        {units.map((unit) => (
                          <Chip key={unit.value} active={form.unit === unit.value} onClick={() => updateForm('unit', unit.value)}>
                            {unit.label}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </FieldGroup>

            <FieldGroup label="2. Em qual fornecedor?">
              <Input
                autoFocus={Boolean(form.product) && !form.supplier}
                value={form.supplier}
                onChange={(e) => updateForm('supplier', e.target.value)}
                placeholder="Ex.: Ceasa, Atacadão, Seu Zé"
              />
              {matchedSupplier ? (
                <p className="mt-2 flex items-center gap-1 text-xs text-brand-300">
                  <Check size={13} /> Fornecedor já cadastrado
                </p>
              ) : (
                <>
                  {supplierSuggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {supplierSuggestions.map((supplier) => (
                        <Chip key={supplier.id} onClick={() => updateForm('supplier', supplier.name)}>{supplier.name}</Chip>
                      ))}
                    </div>
                  )}
                  {form.supplier.trim() && <p className="mt-2 text-xs text-neutral-400">Fornecedor novo: vai ser cadastrado ao salvar.</p>}
                </>
              )}
            </FieldGroup>

            <FieldGroup label={`3. Quanto custa o ${unitShort(formUnit)}?`}>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-neutral-500">R$</span>
                <Input
                  autoFocus={Boolean(form.product) && Boolean(form.supplier)}
                  value={form.price}
                  onChange={(e) => updateForm('price', e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="h-14 pl-12 text-2xl font-bold"
                />
              </div>
              {lastPriceHere && (
                <p className="mt-2 text-xs text-neutral-400">
                  Último preço anotado aqui: {formatCurrency(lastPriceHere.price)} ({formatWhen(lastPriceHere.quotedAt)})
                </p>
              )}
            </FieldGroup>

            {formError && <ModalAlert variant="error">{formError}</ModalAlert>}
          </form>
        </Modal>
      )}

      {suppliersOpen && (
        <Modal onClose={() => setSuppliersOpen(false)} title="Fornecedores" subtitle="Compras" size="md">
          {suppliers.length ? (
            <ul className="divide-y divide-border">
              {suppliers.map((supplier) => {
                const priced = quotes.filter((quote) => quote.supplier_id === supplier.id);
                const productCount = new Set(priced.map((quote) => quote.item_id)).size;
                return (
                  <li key={supplier.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{supplier.name}</p>
                      <p className="text-xs text-neutral-500">
                        {productCount} {productCount === 1 ? 'produto com preço' : 'produtos com preço'}
                      </p>
                    </div>
                    <button
                      title={`Apagar ${supplier.name}`}
                      onClick={() => {
                        setSuppliersOpen(false);
                        setPendingDelete({ kind: 'supplier', target: supplier });
                      }}
                      className="rounded-lg p-2 text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-neutral-500">Nenhum fornecedor cadastrado.</p>
          )}
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
                      {formatWhen(quote.quoted_at)} · {new Date(quote.quoted_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <span className="font-semibold text-ink">
                    {formatCurrency(quote.price)} <span className="text-xs text-neutral-500">/{unitShort(historyItem.unit)}</span>
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
          title={pendingDelete.kind === 'item' ? 'Apagar produto' : 'Apagar fornecedor'}
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
                {deleting ? 'Apagando...' : 'Apagar'}
              </Button>
            </ModalFooter>
          }
        >
          <ModalAlert variant="warning">
            Todos os preços anotados {pendingDelete.kind === 'item' ? 'deste produto' : 'deste fornecedor'} também serão apagados.
          </ModalAlert>
        </Modal>
      )}

      <FloatingToast toast={toast} onClose={clearToast} />
    </PageContainer>
  );
}
