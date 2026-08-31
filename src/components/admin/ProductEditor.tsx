'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import type { Category, Product, ProductOptionGroup } from '@/lib/types/database';

interface Props {
  storeId: string;
  categories: Category[];
  product: Product | null;
  defaultCategoryId?: string | null;
  sortOrder: number;
  onClose: () => void;
  onSaved: (product: Product) => void;
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

const INPUT_CLASS =
  'w-full border border-[#d8d4c9] bg-[#faf9f5] px-3.5 py-3 text-sm outline-none transition-colors focus:border-brand-500';
const LABEL_CLASS = 'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600';

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

export function ProductEditor({ storeId, categories, product, defaultCategoryId, sortOrder, onClose, onSaved, onDeleted }: Props) {
  const supabase = createClient();
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [promoPrice, setPromoPrice] = useState(product?.promo_price != null ? String(product.promo_price) : '');
  const [categoryId, setCategoryId] = useState(product?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? '');
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '');
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [isAvailable, setIsAvailable] = useState(product?.is_available ?? true);
  const [groups, setGroups] = useState<GroupDraft[]>(groupsFromProduct(product?.option_groups));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const handleSave = async () => {
    const priceNumber = Number(price);
    if (!name.trim() || !priceNumber || priceNumber <= 0) {
      setError('Informe nome e um preço válido.');
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
      promo_price: promoPrice ? Number(promoPrice) : null,
      image_url: imageUrl.trim() || null,
      is_active: isActive,
      is_available: isAvailable,
      sort_order: sortOrder,
    };

    let productId = product?.id;

    if (product) {
      const { data: updated, error: updateError } = await supabase
        .from('products')
        .update(payload)
        .eq('id', product.id)
        .select('id');
      // RLS bloqueia silenciosamente (sem erro, 0 linhas) se a conta não for
      // admin/restaurant — sem checar `updated`, isso pareceria ter salvo.
      if (updateError || !updated || updated.length === 0) {
        setSaving(false);
        setError('Não foi possível salvar. Verifique se sua conta tem permissão de administrador.');
        return;
      }
    } else {
      const { data, error: insertError } = await supabase.from('products').insert(payload).select('id').single();
      if (insertError || !data) {
        setSaving(false);
        setError('Não foi possível criar o produto.');
        return;
      }
      productId = data.id;
    }

    if (!productId) {
      setSaving(false);
      setError('Não foi possível salvar o produto.');
      return;
    }

    // Substitui todos os grupos de adicionais pelo estado atual do formulário
    // (mais simples e confiável do que tentar diferenciar o que mudou).
    if (product) {
      await supabase.from('product_option_groups').delete().eq('product_id', productId);
    }

    const validGroups = groups.filter((g) => g.name.trim());
    const savedGroups: ProductOptionGroup[] = [];

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

      if (groupError || !groupRow) continue;

      const validOptions = g.options.filter((o) => o.name.trim());
      let optionRows: ProductOptionGroup['options'] = [];

      if (validOptions.length > 0) {
        const { data: insertedOptions } = await supabase
          .from('product_options')
          .insert(
            validOptions.map((o, j) => ({
              group_id: groupRow.id,
              name: o.name.trim(),
              price: Number(o.price) || 0,
              sort_order: j,
            }))
          )
          .select('*');
        optionRows = insertedOptions ?? [];
      }

      savedGroups.push({ ...groupRow, options: optionRows });
    }

    setSaving(false);
    onSaved({ ...payload, id: productId, option_groups: savedGroups } as Product);
  };

  const handleDelete = async () => {
    if (!product) return;
    if (!confirm(`Excluir "${product.name}"? Essa ação não pode ser desfeita.`)) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('products').delete().eq('id', product.id);
    setDeleting(false);
    if (deleteError) {
      setError('Não foi possível excluir o produto.');
      return;
    }
    onDeleted(product.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-[#1c1d1a]/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-y-auto border border-[#d8d4c9] bg-[#faf9f5] shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-slide-up sm:max-h-[88vh] sm:animate-scale-in">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#d8d4c9] bg-[#faf9f5] px-5 py-4 sm:px-6">
          <h2 className="font-serif text-xl font-bold text-[#1c1d1a]">{product ? 'Editar produto' : 'Novo produto'}</h2>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center border border-[#d8d4c9] text-2xl leading-none text-neutral-400 transition-colors hover:bg-brand-100 hover:text-neutral-900" aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLASS}>Nome</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Descrição</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT_CLASS} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>Preço (R$)</label>
                <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Preço promocional</label>
                <input
                  type="number"
                  step="0.01"
                  value={promoPrice}
                  onChange={(e) => setPromoPrice(e.target.value)}
                  placeholder="Opcional"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            <div>
              <label className={LABEL_CLASS}>Categoria</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={INPUT_CLASS}>
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>URL da imagem</label>
              <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className={INPUT_CLASS} />
            </div>
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Visível no cardápio
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
                Em estoque
              </label>
            </div>
          </div>

          <div className="border-t border-[#d8d4c9] pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-[#1c1d1a]">Adicionais</h3>
              <button
                onClick={addGroup}
                type="button"
                className="border border-[#d8d4c9] px-3 py-1.5 text-xs font-bold text-neutral-600 transition-colors hover:border-brand-500 hover:text-brand-700"
              >
                + Grupo de opções
              </button>
            </div>

            <div className="space-y-4">
              {groups.map((group, gIdx) => (
                <div key={gIdx} className="border border-[#d8d4c9] bg-white p-3.5">
                  <div className="mb-2.5 flex items-center gap-2">
                    <input
                      value={group.name}
                      onChange={(e) => updateGroup(gIdx, { name: e.target.value })}
                      placeholder="Nome do grupo (ex: Adicionais)"
                      className="min-w-0 flex-1 border border-[#d8d4c9] px-2.5 py-2 text-sm outline-none focus:border-brand-500"
                    />
                    <button
                      onClick={() => removeGroup(gIdx)}
                      type="button"
                      className="shrink-0 px-2 py-2 text-xs font-bold text-red-500 hover:bg-red-50"
                    >
                      Remover
                    </button>
                  </div>

                  <div className="mb-2.5 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={group.is_required}
                        onChange={(e) => updateGroup(gIdx, { is_required: e.target.checked })}
                      />
                      Obrigatório
                    </label>
                    <label className="flex items-center gap-1.5">
                      Mín.
                      <input
                        type="number"
                        min={0}
                        value={group.min_select}
                        onChange={(e) => updateGroup(gIdx, { min_select: Number(e.target.value) })}
                        className="w-14 border border-[#d8d4c9] px-1.5 py-1"
                      />
                    </label>
                    <label className="flex items-center gap-1.5">
                      Máx.
                      <input
                        type="number"
                        min={1}
                        value={group.max_select}
                        onChange={(e) => updateGroup(gIdx, { max_select: Number(e.target.value) })}
                        className="w-14 border border-[#d8d4c9] px-1.5 py-1"
                      />
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    {group.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-1.5">
                        <input
                          value={opt.name}
                          onChange={(e) => updateOption(gIdx, oIdx, { name: e.target.value })}
                          placeholder="Nome da opção"
                          className="min-w-0 flex-1 border border-[#d8d4c9] px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={opt.price}
                          onChange={(e) => updateOption(gIdx, oIdx, { price: e.target.value })}
                          placeholder="0,00"
                          className="w-20 border border-[#d8d4c9] px-2 py-1.5 text-sm outline-none focus:border-brand-500"
                        />
                        <button
                          onClick={() => removeOption(gIdx, oIdx)}
                          type="button"
                          className="px-1.5 text-neutral-400 hover:text-red-500"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addOption(gIdx)}
                      type="button"
                      className="mt-1 text-xs font-bold text-brand-700 hover:underline"
                    >
                      + Opção
                    </button>
                  </div>
                </div>
              ))}
              {groups.length === 0 && <p className="text-xs text-neutral-400">Nenhum adicional configurado.</p>}
            </div>
          </div>

          {error && <p className="text-sm text-red-500 animate-fade-in">{error}</p>}
        </div>

        <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-[#d8d4c9] bg-[#faf9f5] px-5 py-4 sm:flex sm:items-center sm:px-6">
          {product && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="border border-red-300 px-3 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40 sm:col-auto"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </button>
          )}
          <button
            onClick={onClose}
            className="border border-[#d8d4c9] px-3 py-2.5 text-sm font-bold text-neutral-600 transition-colors hover:bg-neutral-100"
          >
            Cancelar
          </button>
          <HoverBorderGradient
            onClick={handleSave}
            disabled={saving}
            containerClassName="col-span-2 w-full sm:ml-auto sm:flex-1"
            className="w-full text-center"
          >
            {saving ? 'Salvando...' : 'Salvar produto'}
          </HoverBorderGradient>
        </div>
      </div>
    </div>
  );
}
