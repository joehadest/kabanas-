'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import type { Category } from '@/lib/types/database';

interface Props {
  storeId: string;
  category: Category | null;
  sortOrder: number;
  onClose: () => void;
  onSaved: (category: Category) => void;
  onDeleted: (id: string) => void;
}

const INPUT_CLASS =
  'w-full border border-[#d8d4c9] bg-[#faf9f5] px-3.5 py-3 text-sm outline-none transition-colors focus:border-brand-500';

export function CategoryEditor({ storeId, category, sortOrder, onClose, onSaved, onDeleted }: Props) {
  const supabase = createClient();
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Dê um nome para a categoria.');
      return;
    }
    setSaving(true);
    setError(null);

    if (category) {
      const { data, error: saveError } = await supabase
        .from('categories')
        .update({ name: name.trim(), description: description.trim() || null, is_active: isActive })
        .eq('id', category.id)
        .select('*')
        .single<Category>();
      setSaving(false);
      if (saveError || !data) {
        setError('Não foi possível salvar a categoria.');
        return;
      }
      onSaved(data);
    } else {
      const { data, error: saveError } = await supabase
        .from('categories')
        .insert({ store_id: storeId, name: name.trim(), description: description.trim() || null, is_active: isActive, sort_order: sortOrder })
        .select('*')
        .single<Category>();
      setSaving(false);
      if (saveError || !data) {
        setError('Não foi possível criar a categoria.');
        return;
      }
      onSaved(data);
    }
  };

  const handleDelete = async () => {
    if (!category) return;
    if (!confirm(`Excluir a categoria "${category.name}"? Os produtos dela não serão apagados, mas ficarão sem categoria.`)) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('categories').delete().eq('id', category.id);
    setDeleting(false);
    if (deleteError) {
      setError('Não foi possível excluir a categoria.');
      return;
    }
    onDeleted(category.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-[#1c1d1a]/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md border border-[#d8d4c9] bg-[#faf9f5] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-slide-up sm:animate-scale-in sm:p-6">
        <h2 className="mb-4 font-serif text-xl font-bold text-[#1c1d1a]">{category ? 'Editar categoria' : 'Nova categoria'}</h2>

        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da categoria" className={INPUT_CLASS} />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            className={INPUT_CLASS}
          />
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Visível no cardápio
          </label>
        </div>

        {error && <p className="mt-3 text-xs text-red-500 animate-fade-in">{error}</p>}

        <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:items-center">
          {category && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="border border-red-300 px-3 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
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
            {saving ? 'Salvando...' : 'Salvar'}
          </HoverBorderGradient>
        </div>
      </div>
    </div>
  );
}
