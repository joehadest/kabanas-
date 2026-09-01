'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { FieldGroup, Input } from '@/components/ui/input';
import { Modal, ModalAlert, ModalFooter } from '@/components/ui/modal';
import type { Category } from '@/lib/types/database';

interface Props {
  storeId: string;
  category: Category | null;
  sortOrder: number;
  onClose: () => void;
  onSaved: (category: Category, isNew: boolean) => void;
  onDeleted: (id: string) => void;
}

export function CategoryEditor({ storeId, category, sortOrder, onClose, onSaved, onDeleted }: Props) {
  const supabase = createClient();
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Dê um nome para a categoria.');
      return;
    }
    setSaving(true);
    setError(null);

    const isNew = !category;

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
      onSaved(data, false);
    } else {
      const { data, error: saveError } = await supabase
        .from('categories')
        .insert({
          store_id: storeId,
          name: name.trim(),
          description: description.trim() || null,
          is_active: isActive,
          sort_order: sortOrder,
        })
        .select('*')
        .single<Category>();
      setSaving(false);
      if (saveError || !data) {
        setError('Não foi possível criar a categoria.');
        return;
      }
      onSaved(data, true);
    }
  };

  const handleDelete = async () => {
    if (!category) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('categories').delete().eq('id', category.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (deleteError) {
      setError('Não foi possível excluir a categoria.');
      return;
    }
    onDeleted(category.id);
  };

  return (
    <>
      <Modal
        onClose={onClose}
        title={category ? 'Editar categoria' : 'Nova categoria'}
        subtitle="Cardápio"
        description="Organize os produtos em seções visíveis para o cliente."
        size="md"
        footer={
          <ModalFooter>
            {category && (
              <Button
                variant="danger"
                size="md"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
                className="sm:mr-auto normal-case"
              >
                Excluir categoria
              </Button>
            )}
            <Button variant="secondary" size="md" onClick={onClose} className="normal-case">
              Cancelar
            </Button>
            <Button variant="brand" size="md" onClick={handleSave} disabled={saving} className="min-w-[7rem] normal-case">
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4">
          <FieldGroup label="Nome da categoria">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Lanches, Bebidas..." autoFocus />
          </FieldGroup>
          <FieldGroup label="Descrição (opcional)">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Aparece abaixo do nome no cardápio"
            />
          </FieldGroup>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-elevated px-4 py-3.5 text-sm text-neutral-300 transition-colors hover:border-brand-400">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-border text-brand-500 focus:ring-brand-400"
            />
            <span>
              <span className="block font-semibold text-ink">Visível no cardápio</span>
              <span className="text-xs text-neutral-500">Desmarque para ocultar temporariamente</span>
            </span>
          </label>
          {error && <ModalAlert variant="error">{error}</ModalAlert>}
        </div>
      </Modal>

      {confirmDelete && category && (
        <Modal
          onClose={() => setConfirmDelete(false)}
          title="Excluir categoria"
          subtitle={category.name}
          description="Os produtos desta categoria não serão apagados."
          size="md"
          variant="center"
          motionPreset="fade"
          footer={
            <ModalFooter>
              <Button variant="secondary" size="md" onClick={() => setConfirmDelete(false)} className="normal-case">
                Cancelar
              </Button>
              <Button variant="danger" size="md" onClick={handleDelete} disabled={deleting} className="normal-case">
                {deleting ? 'Excluindo...' : 'Excluir categoria'}
              </Button>
            </ModalFooter>
          }
        >
          <ModalAlert variant="warning">
            Os produtos ficarão em &quot;Sem categoria&quot; até você reorganizá-los.
          </ModalAlert>
        </Modal>
      )}
    </>
  );
}
