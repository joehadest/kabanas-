'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { parseDecimal } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { FieldGroup, Input, Select } from '@/components/ui/input';
import { Modal, ModalAlert, ModalFooter, ModalSection } from '@/components/ui/modal';
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
      return;
    }
    if (!Number.isFinite(costNumber) || costNumber < 0 || !Number.isFinite(packagingNumber) || packagingNumber < 0) {
      setError('Custos não podem ser negativos.');
      return;
    }
    if (!Number.isFinite(taxNumber) || taxNumber < 0 || taxNumber > 100) {
      setError('Informe um imposto entre 0% e 100%.');
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
        description="Configure nome, preço, custos, categoria e adicionais do item."
        size="2xl"
        bodyClassName="space-y-4"
        footer={
          <ModalFooter>
            {product && (
              <Button
                variant="danger"
                size="md"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
                className="normal-case sm:mr-auto"
              >
                Excluir produto
              </Button>
            )}
            <Button variant="secondary" size="md" onClick={onClose} className="normal-case">
              Cancelar
            </Button>
            <Button variant="brand" size="md" onClick={handleSave} disabled={saving} className="min-w-[9rem] normal-case">
              {saving ? 'Salvando...' : 'Salvar produto'}
            </Button>
          </ModalFooter>
        }
      >
        <ModalSection title="Informações básicas">
          <div className="space-y-3">
            <FieldGroup label="Nome do produto">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: X-Burger especial" autoFocus />
            </FieldGroup>
            <FieldGroup label="Descrição">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ingredientes ou detalhes" />
            </FieldGroup>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldGroup label="Preço (R$)">
                <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" inputMode="decimal" />
              </FieldGroup>
              <FieldGroup label="Preço promocional">
                <Input value={promoPrice} onChange={(e) => setPromoPrice(e.target.value)} placeholder="Opcional" inputMode="decimal" />
              </FieldGroup>
            </div>
            <FieldGroup label="Categoria">
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </FieldGroup>
            <FieldGroup label="URL da imagem">
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
            </FieldGroup>
            {imageUrl.trim() && (
              <div className="overflow-hidden rounded-xl border border-border bg-black/40 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl.trim()} alt="Prévia" className="mx-auto h-28 w-28 rounded-lg object-cover" />
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded" />
                <span className="font-medium text-ink">Visível no cardápio</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm">
                <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} className="h-4 w-4 rounded" />
                <span className="font-medium text-ink">Disponível para venda</span>
              </label>
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Custos e impostos" description="Usados no PDV para calcular lucro ao fechar a comanda.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FieldGroup label="Custo (R$)">
              <Input value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </FieldGroup>
            <FieldGroup label="Embalagem (R$)">
              <Input value={packagingCost} onChange={(e) => setPackagingCost(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </FieldGroup>
            <FieldGroup label="Imposto (%)">
              <Input value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="0" inputMode="decimal" />
            </FieldGroup>
          </div>
        </ModalSection>

        <ModalSection
          title="Adicionais e opções"
          description="Grupos como tamanho, ponto da carne, extras..."
          action={
            <Button variant="secondary" size="sm" onClick={addGroup} type="button" className="normal-case">
              + Novo grupo
            </Button>
          }
        >
          <div className="space-y-3">
            {groups.map((group, gIdx) => (
              <div key={gIdx} className="rounded-xl border border-border bg-surface-elevated p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Input
                    value={group.name}
                    onChange={(e) => updateGroup(gIdx, { name: e.target.value })}
                    placeholder="Nome do grupo (ex: Adicionais)"
                    className="min-w-0 flex-1"
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeGroup(gIdx)} type="button" className="shrink-0 normal-case text-red-400">
                    Remover
                  </Button>
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={group.is_required} onChange={(e) => updateGroup(gIdx, { is_required: e.target.checked })} className="rounded" />
                    Obrigatório
                  </label>
                  <label className="flex items-center gap-1.5">
                    Mín.
                    <input type="number" min={0} value={group.min_select} onChange={(e) => updateGroup(gIdx, { min_select: Number(e.target.value) })} className="w-14 rounded-lg border border-border px-1.5 py-1" />
                  </label>
                  <label className="flex items-center gap-1.5">
                    Máx.
                    <input type="number" min={1} value={group.max_select} onChange={(e) => updateGroup(gIdx, { max_select: Number(e.target.value) })} className="w-14 rounded-lg border border-border px-1.5 py-1" />
                  </label>
                </div>
                <div className="space-y-2">
                  {group.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <Input value={opt.name} onChange={(e) => updateOption(gIdx, oIdx, { name: e.target.value })} placeholder="Nome da opção" className="min-w-0 flex-1" />
                      <Input value={opt.price} onChange={(e) => updateOption(gIdx, oIdx, { price: e.target.value })} placeholder="0,00" inputMode="decimal" className="w-24" />
                      <button onClick={() => removeOption(gIdx, oIdx)} type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-500/10 hover:text-red-400">×</button>
                    </div>
                  ))}
                  <button onClick={() => addOption(gIdx)} type="button" className="text-xs font-bold text-brand-300 hover:underline">
                    + Adicionar opção
                  </button>
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <p className="py-2 text-center text-sm text-neutral-400">Nenhum adicional configurado.</p>
            )}
          </div>
        </ModalSection>

        {error && <ModalAlert variant="error">{error}</ModalAlert>}
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
