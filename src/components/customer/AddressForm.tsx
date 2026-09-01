'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { inputClass } from '@/components/ui/input';
import type { Address } from '@/lib/types/database';

interface Props {
  userId: string | null;
  guestId: string | null;
  onSaved: (address: Address) => void;
  onCancel?: () => void;
}

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
    <div className="card-muted space-y-2.5 p-3.5 animate-fade-in">
      <input placeholder="Rótulo (Casa, Trabalho...)" value={form.label} onChange={set('label')} className={inputClass} />
      <div className="grid grid-cols-2 gap-2.5">
        <input placeholder="CEP" value={form.zip_code} onChange={set('zip_code')} className={inputClass} />
        <input placeholder="Número" value={form.number} onChange={set('number')} className={inputClass} />
      </div>
      <input placeholder="Rua" value={form.street} onChange={set('street')} className={inputClass} />
      <input placeholder="Complemento (opcional)" value={form.complement} onChange={set('complement')} className={inputClass} />
      <div className="grid grid-cols-2 gap-2.5">
        <input placeholder="Bairro" value={form.neighborhood} onChange={set('neighborhood')} className={inputClass} />
        <input placeholder="Cidade" value={form.city} onChange={set('city')} className={inputClass} />
      </div>
      <input
        placeholder="Estado (UF)"
        maxLength={2}
        value={form.state}
        onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))}
        className={inputClass}
      />

      {error && <p className="text-xs text-red-400 animate-fade-in">{error}</p>}

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-xl border border-border px-4 text-sm text-neutral-400 transition-colors hover:bg-white/5"
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-10 flex-1 rounded-xl bg-brand-400 text-sm font-bold text-neutral-950 transition-all hover:bg-brand-300 active:scale-[0.98] disabled:opacity-40"
        >
          {saving ? 'Salvando...' : 'Salvar endereço'}
        </button>
      </div>
    </div>
  );
}
