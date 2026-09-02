'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, ImageOff, ImagePlus, PackageCheck, PackageX, Trash2, type LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, parseDecimal } from '@/lib/utils/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FieldGroup, Input, Select } from '@/components/ui/input';
import { Modal, ModalAlert, ModalFooter } from '@/components/ui/modal';
import { Switch } from '@/components/ui/switch';
import type { Category, Product, ProductOptionGroup } from '@/lib/types/database';

interface Props {
  storeId: string;
  categories: Category[];
  defaultTaxRate: number;
  product: Product | null;
  defaultCategoryId?: string | null;
  sortOrder: number;
  onClose: () => void;
  onSaved: (product: Product, isNew: boolean) => void;
  onDeleted: (id: string) => void;
}

interface OptionDraft {
  id?: string;
  name: string;
  price: string;
}

interface GroupDraft {
  id?: string;
  name: string;
  is_required: boolean;
  min_select: number;
  max_select: number;
  options: OptionDraft[];
}

const PRODUCT_SELECT =
  '*, option_groups:product_option_groups(*, options:product_options(*))';

const TABS = [
  { id: 'info', label: 'Informações' },
  { id: 'preco', label: 'Preço e custo' },
  { id: 'adicionais', label: 'Adicionais' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function groupsFromProduct(groups?: ProductOptionGroup[]): GroupDraft[] {
  return (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    is_required: g.is_required,
    min_select: g.min_select,
    max_select: g.max_select,
    options: g.options.map((o) => ({ id: o.id, name: o.name, price: String(o.price) })),
  }));
}

function formatOptionalNumber(value: number | undefined | null) {
  if (value == null || value === 0) return '';
  return String(value);
}

function StatusRow({
  icon: Icon,
  iconOff: IconOff,
  title,
  description,
  checked,
  onChange,
}: {
  icon: LucideIcon;
  iconOff: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const ActiveIcon = checked ? Icon : IconOff;
  return (
    <label
      className={cn(
        'flex min-h-[3.5rem] cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors',
        checked ? 'border-border bg-surface-elevated' : 'border-amber-500/25 bg-amber-500/[0.06]'
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          checked ? 'bg-brand-400/10 text-brand-300' : 'bg-amber-500/10 text-amber-400'
        )}
      >
        <ActiveIcon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-tight text-ink">{title}</span>
        <span className="block text-xs leading-tight text-neutral-500">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
    </label>
  );
}

function MarginPreview({ price, cost, packaging }: { price: number; cost: number; packaging: number }) {
  if (!(price > 0)) return null;
  const net = price - cost - packaging;
  const margin = (net / price) * 100;
  const tone =
    margin >= 25
      ? 'border-brand-400/30 bg-brand-400/10 text-brand-300'
      : margin >= 10
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
        : 'border-red-500/30 bg-red-500/10 text-red-400';

  return (
    <div className={cn('rounded-xl border px-3.5 py-3', tone)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-80">Lucro estimado por unidade</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="font-serif text-xl font-bold">{formatCurrency(net)}</span>
        <span className="text-xs font-bold">Margem de {margin.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export function ProductEditor({
  storeId,
  categories,
  defaultTaxRate,
  product,
  defaultCategoryId,
  sortOrder,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [promoPrice, setPromoPrice] = useState(product?.promo_price != null ? String(product.promo_price) : '');
  const [costPrice, setCostPrice] = useState(formatOptionalNumber(product?.cost_price));
  const [packagingCost, setPackagingCost] = useState(formatOptionalNumber(product?.packaging_cost));
  const [taxRate, setTaxRate] = useState(
    product?.tax_rate != null ? String(product.tax_rate) : String(defaultTaxRate)
  );
  const [categoryId, setCategoryId] = useState(product?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? '');
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '');
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [isAvailable, setIsAvailable] = useState(product?.is_available ?? true);
  const [groups, setGroups] = useState<GroupDraft[]>(groupsFromProduct(product?.option_groups));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marginValues = useMemo(
    () => ({
      price: parseDecimal(price) || 0,
      cost: parseDecimal(costPrice) || 0,
      packaging: parseDecimal(packagingCost) || 0,
    }),
    [price, costPrice, packagingCost]
  );

  const addGroup = () => setGroups((prev) => [...prev, { name: '', is_required: false, min_select: 0, max_select: 1, options: [] }]);
  const removeGroup = (idx: number) => setGroups((prev) => prev.filter((_, i) => i !== idx));
  const updateGroup = (idx: number, patch: Partial<GroupDraft>) =>
    setGroups((prev) => prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)));

  const addOption = (groupIdx: number) =>
    setGroups((prev) => prev.map((g, i) => (i === groupIdx ? { ...g, options: [...g.options, { name: '', price: '0' }] } : g)));
  const removeOption = (groupIdx: number, optIdx: number) =>
    setGroups((prev) => prev.map((g, i) => (i === groupIdx ? { ...g, options: g.options.filter((_, j) => j !== optIdx) } : g)));
  const updateOption = (groupIdx: number, optIdx: number, patch: Partial<OptionDraft>) =>
    setGroups((prev) =>
      prev.map((g, i) =>
        i === groupIdx ? { ...g, options: g.options.map((o, j) => (j === optIdx ? { ...o, ...patch } : o)) } : g
      )
    );

  const saveOptionGroups = async (productId: string) => {
    if (product) {
      const { error: deleteError } = await supabase.from('product_option_groups').delete().eq('product_id', productId);
      if (deleteError) {
        throw new Error('Não foi possível atualizar os adicionais do produto.');
      }
    }

    const validGroups = groups.filter((g) => g.name.trim());

    for (let i = 0; i < validGroups.length; i++) {
      const g = validGroups[i];
      const { data: groupRow, error: groupError } = await supabase
        .from('product_option_groups')
        .insert({
          product_id: productId,
          name: g.name.trim(),
          is_required: g.is_required,
          min_select: g.min_select,
          max_select: g.max_select,
          sort_order: i,
        })
        .select('*')
        .single();

      if (groupError || !groupRow) {
        throw new Error(`Não foi possível salvar o grupo "${g.name.trim()}".`);
      }

      const validOptions = g.options.filter((o) => o.name.trim());
      if (validOptions.length === 0) continue;

      const { error: optionsError } = await supabase.from('product_options').insert(
        validOptions.map((o, j) => ({
          group_id: groupRow.id,
          name: o.name.trim(),
          price: parseDecimal(o.price) || 0,
          sort_order: j,
        }))
      );

      if (optionsError) {
        throw new Error(`Não foi possível salvar as opções do grupo "${g.name.trim()}".`);
      }
    }
  };

  const handleSave = async () => {
    const priceNumber = parseDecimal(price);
    const promoNumber = promoPrice.trim() ? parseDecimal(promoPrice) : NaN;
    const costNumber = costPrice.trim() ? parseDecimal(costPrice) : 0;
    const packagingNumber = packagingCost.trim() ? parseDecimal(packagingCost) : 0;
    const taxNumber = taxRate.trim() ? parseDecimal(taxRate) : 0;

    if (!name.trim() || !Number.isFinite(priceNumber) || priceNumber <= 0) {
      setError('Informe nome e um preço válido.');
      setActiveTab('info');
      return;
    }
    if (!Number.isFinite(costNumber) || costNumber < 0 || !Number.isFinite(packagingNumber) || packagingNumber < 0) {
      setError('Custos não podem ser negativos.');
      setActiveTab('preco');
      return;
    }
    if (!Number.isFinite(taxNumber) || taxNumber < 0 || taxNumber > 100) {
      setError('Informe um imposto entre 0% e 100%.');
      setActiveTab('preco');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      store_id: storeId,
      category_id: categoryId || null,
      name: name.trim(),
      description: description.trim() || null,
      price: priceNumber,
      promo_price: Number.isFinite(promoNumber) && promoNumber > 0 ? promoNumber : null,
      cost_price: costNumber,
      packaging_cost: packagingNumber,
      tax_rate: taxNumber,
      image_url: imageUrl.trim() || null,
      is_active: isActive,
      is_available: isAvailable,
      sort_order: product?.sort_order ?? sortOrder,
    };

    const isNew = !product;
    let productId = product?.id;

    try {
      if (product) {
        const { data: updated, error: updateError } = await supabase
          .from('products')
          .update(payload)
          .eq('id', product.id)
          .select('id');
        if (updateError || !updated || updated.length === 0) {
          throw new Error('Não foi possível salvar. Verifique se sua conta tem permissão de administrador.');
        }
      } else {
        const { data, error: insertError } = await supabase.from('products').insert(payload).select('id').single();
        if (insertError || !data) {
          throw new Error('Não foi possível criar o produto.');
        }
        productId = data.id;
      }

      if (!productId) {
        throw new Error('Não foi possível salvar o produto.');
      }

      await saveOptionGroups(productId);

      const { data: fullProduct, error: fetchError } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('id', productId)
        .single<Product>();

      if (fetchError || !fullProduct) {
        throw new Error('Produto salvo, mas não foi possível recarregar os dados. Atualize a página.');
      }

      onSaved(fullProduct, isNew);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o produto.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    setDeleting(true);
    setError(null);
    const { error: deleteError } = await supabase.from('products').delete().eq('id', product.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (deleteError) {
      setError('Não foi possível excluir o produto.');
      return;
    }
    onDeleted(product.id);
  };

  return (
    <>
      <Modal
        onClose={onClose}
        title={product ? 'Editar produto' : 'Novo produto'}
        subtitle="Cardápio"
        size="2xl"
        bodyClassName="p-0 gap-0 flex flex-col"
        headerActions={
          product ? (
            <button
              type="button"
              title="Excluir produto"
              aria-label="Excluir produto"
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40 sm:h-9 sm:w-9"
            >
              <Trash2 size={16} />
            </button>
          ) : undefined
        }
        footer={
          <ModalFooter>
            <Button variant="secondary" size="md" onClick={onClose} className="normal-case">
              Cancelar
            </Button>
            <Button variant="brand" size="md" onClick={handleSave} disabled={saving} className="min-w-[9rem] normal-case">
              {saving ? 'Salvando...' : 'Salvar produto'}
            </Button>
          </ModalFooter>
        }
      >
        {/* Barra fixa: status do dia a dia + navegação por abas — sempre visíveis, sem precisar rolar */}
        <div className="sticky top-0 z-10 shrink-0 space-y-3 border-b border-border bg-neutral-950 px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <StatusRow
              icon={PackageCheck}
              iconOff={PackageX}
              title="Disponível para venda"
              description={isAvailable ? 'Pode ser vendido agora' : 'Marcado como esgotado'}
              checked={isAvailable}
              onChange={setIsAvailable}
            />
            <StatusRow
              icon={Eye}
              iconOff={EyeOff}
              title="Visível no cardápio"
              description={isActive ? 'Aparece para o cliente' : 'Oculto do cardápio'}
              checked={isActive}
              onChange={setIsActive}
            />
          </div>

          <div role="tablist" aria-label="Seções do produto" className="flex gap-1 rounded-xl bg-neutral-900 p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors sm:text-[11px]',
                  activeTab === tab.id
                    ? 'bg-brand-400 text-neutral-950 shadow-sm'
                    : 'text-neutral-400 hover:text-ink'
                )}
              >
                {tab.label}
                {tab.id === 'adicionais' && groups.length > 0 && (
                  <span
                    className={cn(
                      'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px]',
                      activeTab === tab.id ? 'bg-neutral-950/20' : 'bg-neutral-800 text-neutral-300'
                    )}
                  >
                    {groups.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {activeTab === 'info' && (
            <div className="space-y-3.5">
              <div className="flex items-start gap-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-neutral-900">
                  {imageUrl.trim() ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl.trim()} alt="Prévia" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-neutral-600">
                      <ImagePlus size={22} />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <FieldGroup label="URL da imagem">
                    <Input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="min-h-11"
                    />
                  </FieldGroup>
                  {imageUrl.trim() && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="inline-flex items-center gap-1 text-xs font-bold text-red-400 hover:underline"
                    >
                      <ImageOff size={12} /> Remover foto
                    </button>
                  )}
                </div>
              </div>

              <FieldGroup label="Nome do produto">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: X-Burger especial"
                  autoFocus
                  className="min-h-11"
                />
              </FieldGroup>
              <FieldGroup label="Descrição">
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ingredientes ou detalhes"
                  className="min-h-11"
                />
              </FieldGroup>
              <FieldGroup label="Categoria">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="min-h-11">
                  <option value="">Sem categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </FieldGroup>
            </div>
          )}

          {activeTab === 'preco' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldGroup label="Preço (R$)">
                  <Input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0,00"
                    inputMode="decimal"
                    className="min-h-11 text-base font-semibold sm:text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Preço promocional">
                  <Input
                    value={promoPrice}
                    onChange={(e) => setPromoPrice(e.target.value)}
                    placeholder="Opcional"
                    inputMode="decimal"
                    className="min-h-11"
                  />
                </FieldGroup>
              </div>

              <MarginPreview {...marginValues} />

              <div className="rounded-2xl border border-border bg-neutral-900 p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-neutral-400">
                  Custos e impostos
                </p>
                <p className="mb-3 -mt-2 text-xs text-neutral-500">Usados no PDV para calcular lucro ao fechar a comanda.</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <FieldGroup label="Custo (R$)">
                    <Input value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0,00" inputMode="decimal" className="min-h-11" />
                  </FieldGroup>
                  <FieldGroup label="Embalagem (R$)">
                    <Input value={packagingCost} onChange={(e) => setPackagingCost(e.target.value)} placeholder="0,00" inputMode="decimal" className="min-h-11" />
                  </FieldGroup>
                  <FieldGroup label="Imposto (%)">
                    <Input value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="0" inputMode="decimal" className="min-h-11" />
                  </FieldGroup>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'adicionais' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-neutral-500">Grupos como tamanho, ponto da carne, extras...</p>
                <Button variant="secondary" size="sm" onClick={addGroup} type="button" className="shrink-0 normal-case">
                  + Novo grupo
                </Button>
              </div>

              {groups.map((group, gIdx) => (
                <div key={gIdx} className="rounded-xl border border-border bg-surface-elevated p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Input
                      value={group.name}
                      onChange={(e) => updateGroup(gIdx, { name: e.target.value })}
                      placeholder="Nome do grupo (ex: Adicionais)"
                      className="min-h-11 min-w-0 flex-1"
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeGroup(gIdx)} type="button" className="shrink-0 normal-case text-red-400">
                      Remover
                    </Button>
                  </div>
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={group.is_required} onChange={(e) => updateGroup(gIdx, { is_required: e.target.checked })} className="h-4 w-4 rounded" />
                      Obrigatório
                    </label>
                    <label className="flex items-center gap-1.5">
                      Mín.
                      <input type="number" min={0} value={group.min_select} onChange={(e) => updateGroup(gIdx, { min_select: Number(e.target.value) })} className="w-14 rounded-lg border border-border px-1.5 py-1.5" />
                    </label>
                    <label className="flex items-center gap-1.5">
                      Máx.
                      <input type="number" min={1} value={group.max_select} onChange={(e) => updateGroup(gIdx, { max_select: Number(e.target.value) })} className="w-14 rounded-lg border border-border px-1.5 py-1.5" />
                    </label>
                  </div>
                  <div className="space-y-2">
                    {group.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <Input value={opt.name} onChange={(e) => updateOption(gIdx, oIdx, { name: e.target.value })} placeholder="Nome da opção" className="min-h-11 min-w-0 flex-1" />
                        <Input value={opt.price} onChange={(e) => updateOption(gIdx, oIdx, { price: e.target.value })} placeholder="0,00" inputMode="decimal" className="min-h-11 w-24" />
                        <button onClick={() => removeOption(gIdx, oIdx)} type="button" aria-label="Remover opção" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-500/10 hover:text-red-400">×</button>
                      </div>
                    ))}
                    <button onClick={() => addOption(gIdx)} type="button" className="text-xs font-bold text-brand-300 hover:underline">
                      + Adicionar opção
                    </button>
                  </div>
                </div>
              ))}
              {groups.length === 0 && (
                <p className="py-6 text-center text-sm text-neutral-400">Nenhum adicional configurado.</p>
              )}
            </div>
          )}

          {error && <ModalAlert variant="error">{error}</ModalAlert>}
        </div>
      </Modal>

      {confirmDelete && product && (
        <Modal
          onClose={() => setConfirmDelete(false)}
          title="Excluir produto"
          subtitle={product.name}
          description="Essa ação não pode ser desfeita."
          size="md"
          variant="center"
          motionPreset="fade"
          footer={
            <ModalFooter>
              <Button variant="secondary" size="md" onClick={() => setConfirmDelete(false)} className="normal-case">
                Cancelar
              </Button>
              <Button variant="danger" size="md" onClick={handleDelete} disabled={deleting} className="normal-case">
                {deleting ? 'Excluindo...' : 'Excluir produto'}
              </Button>
            </ModalFooter>
          }
        >
          <ModalAlert variant="warning">
            O produto será removido do cardápio e do PDV. Vendas antigas não são alteradas.
          </ModalAlert>
        </Modal>
      )}
    </>
  );
}
