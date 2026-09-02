'use client';

import { FormEvent, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Calculator, PackagePlus, Pencil, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import {
  CollapsibleSection,
  DEFAULT_LIST_LIMIT,
  ExpandCollapseControls,
  ListSearchBar,
  ShowMoreToggle,
} from '@/components/ui/collapsible-list';
import { FieldGroup, Input, Select } from '@/components/ui/input';
import { Modal, ModalAlert, ModalFooter, ModalSection } from '@/components/ui/modal';
import { PageContainer, PageHeader } from '@/components/ui/page-layout';

export interface ManagedProduct {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  image_url: string | null;
  price: number;
  cost_price: number;
  packaging_cost: number;
  other_variable_cost: number;
  tax_rate: number;
  stock_quantity: number;
  reorder_level: number;
  category_id: string | null;
  is_active: boolean;
  is_available: boolean;
}

interface Props {
  storeId: string;
  products: ManagedProduct[];
  categories: { id: string; name: string }[];
  paymentFeeRate: number;
}

function calcProfit(product: ManagedProduct, paymentFeeRate: number) {
  const net =
    product.price -
    product.cost_price -
    product.packaging_cost -
    product.other_variable_cost -
    product.price * ((paymentFeeRate + product.tax_rate) / 100);
  const margin = product.price ? (net / product.price) * 100 : 0;
  return { net, margin };
}

function ProfitPreview({
  price,
  cost,
  paymentFee,
  tax,
  packaging,
  other,
}: {
  price: number;
  cost: number;
  paymentFee: number;
  tax: number;
  packaging: number;
  other: number;
}) {
  const feeAmount = price * (paymentFee / 100);
  const taxAmount = price * (tax / 100);
  const net = price - cost - feeAmount - taxAmount - packaging - other;
  const margin = price > 0 ? (net / price) * 100 : 0;
  const tone =
    margin >= 25
      ? 'text-brand-300 bg-brand-400/10 border-brand-400/30'
      : margin >= 10
        ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
        : 'text-red-400 bg-red-500/10 border-red-500/30';

  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em]">Lucro real por unidade</p>
      <p className="mt-1 font-serif text-3xl font-bold">{formatCurrency(net)}</p>
      <p className="mt-1 text-xs font-semibold">
        Margem de {margin.toFixed(1)}% · Markup de {cost > 0 ? (((price - cost) / cost) * 100).toFixed(1) : '0'}%
      </p>
    </div>
  );
}

function ProductRow({
  product,
  paymentFeeRate,
  onEdit,
  onRemove,
}: {
  product: ManagedProduct;
  paymentFeeRate: number;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { net, margin } = calcProfit(product, paymentFeeRate);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 transition-all hover:border-brand-400 hover:shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{product.name}</p>
        <p className="text-xs text-neutral-500">
          {formatCurrency(product.price)} · estoque {product.stock_quantity}
        </p>
      </div>
      <div className="hidden shrink-0 text-right text-xs sm:block">
        <p className={clsx('font-bold', net >= 0 ? 'text-brand-300' : 'text-red-400')}>{formatCurrency(net)}</p>
        <p className={margin >= 25 ? 'text-brand-400' : margin >= 10 ? 'text-amber-400' : 'text-red-400'}>
          {margin.toFixed(0)}%
        </p>
      </div>
      <div className="flex shrink-0 gap-0.5">
        <button
          title="Editar"
          onClick={onEdit}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-brand-400/10 hover:text-brand-300"
        >
          <Pencil size={15} />
        </button>
        <button
          title="Excluir"
          onClick={onRemove}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

export function ProductProfitManager({ storeId, products: initialProducts, categories, paymentFeeRate }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [editing, setEditing] = useState<ManagedProduct | null | undefined>();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(categories.slice(0, 1).map((c) => c.id)));
  const [showAllInGroup, setShowAllInGroup] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    name: '',
    sku: '',
    description: '',
    image_url: '',
    price: '',
    cost_price: '',
    packaging_cost: '0',
    other_variable_cost: '0',
    tax_rate: '0',
    stock_quantity: '0',
    reorder_level: '0',
    category_id: '',
    is_active: true,
    is_available: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const normalizedSearch = search.trim().toLowerCase();

  const grouped = useMemo(() => {
    const map = new Map<string, ManagedProduct[]>();
    for (const cat of categories) map.set(cat.id, []);
    const uncategorized: ManagedProduct[] = [];

    for (const product of products) {
      if (normalizedSearch && !product.name.toLowerCase().includes(normalizedSearch)) continue;
      if (!product.category_id) uncategorized.push(product);
      else map.get(product.category_id)?.push(product);
    }

    return { map, uncategorized };
  }, [products, categories, normalizedSearch]);

  const visibleCategories = useMemo(() => {
    if (!normalizedSearch) return categories;
    return categories.filter((cat) => (grouped.map.get(cat.id)?.length ?? 0) > 0);
  }, [categories, normalizedSearch, grouped.map]);

  const toggleShowAll = (id: string) => {
    setShowAllInGroup((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderList = (items: ManagedProduct[], groupKey: string) => {
    if (!items.length) {
      return <p className="py-2 text-sm text-neutral-400">Nenhum produto nesta categoria.</p>;
    }

    const showAll = showAllInGroup.has(groupKey) || !!normalizedSearch;
    const visible = showAll ? items : items.slice(0, DEFAULT_LIST_LIMIT);
    const hiddenCount = items.length - DEFAULT_LIST_LIMIT;

    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {visible.map((product) => (
          <ProductRow
            key={product.id}
            product={product}
            paymentFeeRate={paymentFeeRate}
            onEdit={() => openEditor(product)}
            onRemove={() => remove(product)}
          />
        ))}
        <ShowMoreToggle hiddenCount={hiddenCount} showingAll={showAll} onToggle={() => toggleShowAll(groupKey)} />
      </div>
    );
  };

  const openEditor = (product?: ManagedProduct) => {
    setEditing(product ?? null);
    setError(null);
    setForm(
      product
        ? {
            ...product,
            sku: product.sku ?? '',
            description: product.description ?? '',
            image_url: product.image_url ?? '',
            category_id: product.category_id ?? '',
            price: String(product.price),
            cost_price: String(product.cost_price),
            packaging_cost: String(product.packaging_cost),
            other_variable_cost: String(product.other_variable_cost),
            tax_rate: String(product.tax_rate),
            stock_quantity: String(product.stock_quantity),
            reorder_level: String(product.reorder_level),
          }
        : {
            name: '',
            sku: '',
            description: '',
            image_url: '',
            price: '',
            cost_price: '',
            packaging_cost: '0',
            other_variable_cost: '0',
            tax_rate: '0',
            stock_quantity: '0',
            reorder_level: '0',
            category_id: categories[0]?.id ?? '',
            is_active: true,
            is_available: true,
          }
    );
  };

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const number = (key: keyof typeof form) => Number(form[key]) || 0;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!form.name.trim() || number('price') <= 0) {
      setError('Informe o nome e o preço de venda.');
      return;
    }
    setSaving(true);
    const payload = {
      store_id: storeId,
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      price: number('price'),
      cost_price: number('cost_price'),
      packaging_cost: number('packaging_cost'),
      other_variable_cost: number('other_variable_cost'),
      tax_rate: number('tax_rate'),
      stock_quantity: number('stock_quantity'),
      reorder_level: number('reorder_level'),
      category_id: form.category_id || null,
      is_active: form.is_active,
      is_available: form.is_available && number('stock_quantity') > 0,
    };
    const query = editing
      ? createClient().from('products').update(payload).eq('id', editing.id).select('*').single()
      : createClient().from('products').insert(payload).select('*').single();
    const { data, error: saveError } = await query;
    setSaving(false);
    if (saveError || !data) {
      setError('Não foi possível salvar o produto. Execute a migração financeira e confira suas permissões.');
      return;
    }
    setProducts((previous) =>
      editing
        ? previous.map((product) => (product.id === editing.id ? (data as ManagedProduct) : product))
        : [data as ManagedProduct, ...previous]
    );
    if (data.category_id) setExpanded((prev) => new Set(prev).add(data.category_id));
    setEditing(undefined);
  };

  const remove = async (product: ManagedProduct) => {
    if (
      !confirm(
        `Excluir "${product.name}"? Produtos usados em vendas antigas permanecerão no histórico, mas não poderão mais ser selecionados.`
      )
    )
      return;
    const { error: deleteError } = await createClient().from('products').delete().eq('id', product.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setProducts((current) => current.filter((item) => item.id !== product.id));
    setEditing(undefined);
  };

  const totalVisible = normalizedSearch
    ? products.filter((p) => p.name.toLowerCase().includes(normalizedSearch)).length
    : products.length;

  return (
    <PageContainer className="max-w-6xl">
      <PageHeader
        eyebrow="Precificação inteligente"
        title="Produtos e lucro real"
        description="Veja o que sobra depois de custo, taxas e impostos."
        action={
          <Button variant="primary" size="lg" onClick={() => openEditor()} className="normal-case">
            <PackagePlus size={16} />
            Novo produto
          </Button>
        }
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ListSearchBar value={search} onChange={setSearch} placeholder="Buscar produto..." />
        {!normalizedSearch && categories.length > 1 && (
          <ExpandCollapseControls
            onExpandAll={() => setExpanded(new Set([...categories.map((c) => c.id), '__none__']))}
            onCollapseAll={() => setExpanded(new Set())}
          />
        )}
      </div>

      <p className="mt-3 text-xs text-neutral-500">{totalVisible} produto{totalVisible !== 1 ? 's' : ''}</p>

      <div className="mt-4 space-y-3">
        {visibleCategories.map((cat) => {
          const items = grouped.map.get(cat.id) ?? [];
          const isOpen = !!normalizedSearch || expanded.has(cat.id);

          return (
            <CollapsibleSection
              key={cat.id}
              title={cat.name}
              count={items.length}
              open={isOpen}
              onOpenChange={(next) =>
                setExpanded((prev) => {
                  const updated = new Set(prev);
                  if (next) updated.add(cat.id);
                  else updated.delete(cat.id);
                  return updated;
                })
              }
            >
              {renderList(items, cat.id)}
            </CollapsibleSection>
          );
        })}

        {grouped.uncategorized.length > 0 && (
          <CollapsibleSection
            title="Sem categoria"
            count={grouped.uncategorized.length}
            open={!!normalizedSearch || expanded.has('__none__')}
            onOpenChange={(next) =>
              setExpanded((prev) => {
                const updated = new Set(prev);
                if (next) updated.add('__none__');
                else updated.delete('__none__');
                return updated;
              })
            }
          >
            {renderList(grouped.uncategorized, '__none__')}
          </CollapsibleSection>
        )}

        {products.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-neutral-500">
            Cadastre seu primeiro produto para descobrir o lucro real.
          </p>
        )}

        {normalizedSearch && visibleCategories.length === 0 && grouped.uncategorized.length === 0 && products.length > 0 && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-neutral-500">
            Nenhum produto encontrado para &quot;{search}&quot;.
          </p>
        )}
      </div>

      {editing !== undefined && (
        <Modal
          onClose={() => setEditing(undefined)}
          title="Preço que dá lucro"
          subtitle={editing ? 'Editar produto' : 'Novo cadastro'}
          description="Calcule margem real com custos, taxas e impostos."
          size="2xl"
          headerActions={
            editing ? (
              <button
                type="button"
                title="Excluir produto"
                aria-label="Excluir produto"
                onClick={() => remove(editing)}
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
              <Button type="submit" form="profit-form" variant="primary" size="md" disabled={saving} className="normal-case">
                <Calculator size={16} />
                {saving ? 'Salvando...' : 'Salvar produto'}
              </Button>
            </ModalFooter>
          }
        >
          <form id="profit-form" onSubmit={save} className="space-y-4">
            <ModalSection title="Dados do produto">
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldGroup label="Nome">
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
                </FieldGroup>
                <FieldGroup label="SKU/código">
                  <Input value={form.sku} onChange={(e) => set('sku', e.target.value)} />
                </FieldGroup>
                <FieldGroup label="Descrição" className="sm:col-span-2">
                  <Input value={form.description} onChange={(e) => set('description', e.target.value)} />
                </FieldGroup>
                <FieldGroup label="URL da foto" className="sm:col-span-2">
                  <Input value={form.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="https://..." />
                </FieldGroup>
                <FieldGroup label="Categoria">
                  <Select value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
                    <option value="">Sem categoria</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </Select>
                </FieldGroup>
                <FieldGroup label="Preço de venda">
                  <Input inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value)} />
                </FieldGroup>
              </div>
            </ModalSection>

            <ModalSection title="Custos e estoque">
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldGroup label="Custo do produto">
                  <Input inputMode="decimal" value={form.cost_price} onChange={(e) => set('cost_price', e.target.value)} />
                </FieldGroup>
                <FieldGroup label="Impostos (%)">
                  <Input inputMode="decimal" value={form.tax_rate} onChange={(e) => set('tax_rate', e.target.value)} />
                </FieldGroup>
                <FieldGroup label="Embalagem/frete">
                  <Input inputMode="decimal" value={form.packaging_cost} onChange={(e) => set('packaging_cost', e.target.value)} />
                </FieldGroup>
                <FieldGroup label="Outros custos variáveis">
                  <Input inputMode="decimal" value={form.other_variable_cost} onChange={(e) => set('other_variable_cost', e.target.value)} />
                </FieldGroup>
                <FieldGroup label="Quantidade em estoque">
                  <Input inputMode="numeric" value={form.stock_quantity} onChange={(e) => set('stock_quantity', e.target.value)} />
                </FieldGroup>
                <FieldGroup label="Alerta de estoque baixo">
                  <Input inputMode="numeric" value={form.reorder_level} onChange={(e) => set('reorder_level', e.target.value)} />
                </FieldGroup>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="rounded" />
                  Produto ativo
                </label>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" checked={form.is_available} onChange={(e) => set('is_available', e.target.checked)} className="rounded" />
                  Disponível para venda
                </label>
              </div>
            </ModalSection>
          </form>

          <div className="mt-4">
            <ProfitPreview
              price={number('price')}
              cost={number('cost_price')}
              paymentFee={paymentFeeRate}
              tax={number('tax_rate')}
              packaging={number('packaging_cost')}
              other={number('other_variable_cost')}
            />
          </div>

          {error && <ModalAlert variant="error">{error}</ModalAlert>}
        </Modal>
      )}
    </PageContainer>
  );
}
