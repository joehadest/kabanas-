'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Address } from '@/lib/types/database';

interface Props {
  userId: string | null;
  guestId: string | null;
  onSaved: (address: Address) => void;
  onCancel?: () => void;
}

const INPUT_CLASS =
  'w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 transition-colors';

const EMPTY_FORM = {
  label: 'Casa',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zip_code: '',
};

export function AddressForm({ userId, guestId, onSaved, onCancel }: Props) {
  const supabase = createClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.street || !form.number || !form.neighborhood || !form.city || !form.state) {
      setError('Preencha rua, número, bairro, cidade e estado.');
      return;
    }
    setSaving(true);
    setError(null);

    const { data, error: saveError } = await supabase
      .from('addresses')
      .insert({
        ...form,
        complement: form.complement || null,
        user_id: userId,
        guest_id: userId ? null : guestId,
        is_default: true,
      })
      .select('*')
      .single<Address>();

    setSaving(false);
    if (saveError || !data) {
      setError('Não foi possível salvar o endereço. Tente novamente.');
      return;
    }
    onSaved(data);
  };

  return (
    <div className="rounded-xl border border-neutral-200 p-3.5 space-y-2.5 animate-fade-in">
      <input placeholder="Rótulo (Casa, Trabalho...)" value={form.label} onChange={set('label')} className={INPUT_CLASS} />
      <div className="grid grid-cols-2 gap-2.5">
        <input placeholder="CEP" value={form.zip_code} onChange={set('zip_code')} className={INPUT_CLASS} />
        <input placeholder="Número" value={form.number} onChange={set('number')} className={INPUT_CLASS} />
      </div>
      <input placeholder="Rua" value={form.street} onChange={set('street')} className={INPUT_CLASS} />
      <input placeholder="Complemento (opcional)" value={form.complement} onChange={set('complement')} className={INPUT_CLASS} />
      <div className="grid grid-cols-2 gap-2.5">
        <input placeholder="Bairro" value={form.neighborhood} onChange={set('neighborhood')} className={INPUT_CLASS} />
        <input placeholder="Cidade" value={form.city} onChange={set('city')} className={INPUT_CLASS} />
      </div>
      <input
        placeholder="Estado (UF)"
        maxLength={2}
        value={form.state}
        onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))}
        className={INPUT_CLASS}
      />

      {error && <p className="text-xs text-red-500 animate-fade-in">{error}</p>}

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 h-10 rounded-xl border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 h-10 rounded-xl bg-brand-500 text-neutral-900 text-sm font-bold disabled:opacity-40 hover:bg-brand-400 active:scale-[0.98] transition-all"
        >
          {saving ? 'Salvando...' : 'Salvar endereço'}
        </button>
      </div>
    </div>
  );
}
