'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { createClient } from '@/lib/supabase/client';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import type { StoreSettings } from '@/lib/types/database';

type DayHours = { open: string; close: string; closed: boolean };
type OpeningHours = Record<string, DayHours>;

const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Segunda' },
  { key: 'tue', label: 'Terça' },
  { key: 'wed', label: 'Quarta' },
  { key: 'thu', label: 'Quinta' },
  { key: 'fri', label: 'Sexta' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];

const DEFAULT_DAY: DayHours = { open: '18:00', close: '23:00', closed: false };

const OVERRIDE_OPTIONS: { value: 'auto' | 'open' | 'closed'; label: string; hint: string }[] = [
  { value: 'auto', label: 'Seguir horário programado', hint: 'Abre e fecha automaticamente pelos horários abaixo' },
  { value: 'open', label: 'Forçar aberto agora', hint: 'Ignora o horário e aceita pedidos mesmo fechado' },
  { value: 'closed', label: 'Forçar fechado agora', hint: 'Ignora o horário e não aparece como aberto' },
];

export function HoursForm({ store }: { store: StoreSettings }) {
  const supabase = createClient();
  const [hours, setHours] = useState<OpeningHours>(store.opening_hours ?? {});
  const [override, setOverride] = useState<'auto' | 'open' | 'closed'>(
    store.is_open_override === true ? 'open' : store.is_open_override === false ? 'closed' : 'auto'
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dayValue = (key: string): DayHours => hours[key] ?? DEFAULT_DAY;

  const updateDay = (key: string, patch: Partial<DayHours>) => {
    setHours((prev) => ({ ...prev, [key]: { ...dayValue(key), ...patch } }));
  };

  const applyToAll = () => {
    const monday = dayValue('mon');
    const next: OpeningHours = {};
    DAYS.forEach(({ key }) => {
      next[key] = { ...monday };
    });
    setHours(next);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const { data, error } = await supabase
      .from('store_settings')
      .update({
        opening_hours: hours,
        is_open_override: override === 'auto' ? null : override === 'open',
      })
      .eq('id', store.id)
      .select('id');
    setSaving(false);
    if (error || !data || data.length === 0) {
      alert('Não foi possível salvar. Verifique se sua conta tem permissão de administrador.');
      return;
    }
    setSaved(true);
  };

  return (
    <div className="space-y-6">
      <section className="border border-[#d8d4c9] bg-[#f7f5ef] p-4 shadow-[0_4px_0_rgba(28,29,26,0.06)] animate-fade-in-up sm:p-6">
        <h2 className="mb-1 font-serif text-lg font-bold text-[#1c1d1a]">Status agora</h2>
        <p className="mb-4 text-xs text-neutral-500">Sobrepõe o horário programado quando você precisar de uma exceção rápida.</p>
        <div className="space-y-2">
          {OVERRIDE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={clsx(
                'flex cursor-pointer items-center justify-between border px-3.5 py-3 text-sm transition-colors',
                override === opt.value ? 'border-brand-500 bg-brand-50' : 'border-[#d8d4c9] bg-[#faf9f5] hover:border-neutral-400'
              )}
            >
              <span>
                <span className="block font-bold text-[#1c1d1a]">{opt.label}</span>
                <span className="text-xs text-neutral-500">{opt.hint}</span>
              </span>
              <input
                type="radio"
                name="override"
                checked={override === opt.value}
                onChange={() => setOverride(opt.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="border border-[#d8d4c9] bg-[#f7f5ef] p-4 shadow-[0_4px_0_rgba(28,29,26,0.06)] animate-fade-in-up [animation-delay:60ms] sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#1c1d1a]">Horário programado</h2>
            <p className="text-xs text-neutral-500">Vale quando "Seguir horário programado" está selecionado acima.</p>
          </div>
          <button
            onClick={applyToAll}
            type="button"
            className="w-full border border-[#d8d4c9] px-3 py-2.5 text-xs font-bold text-neutral-600 transition-colors hover:border-brand-500 hover:text-brand-700 sm:w-auto"
          >
            Copiar segunda p/ todos
          </button>
        </div>

        <div className="space-y-2">
          {DAYS.map(({ key, label }) => {
            const day = dayValue(key);
            return (
              <div
                key={key}
                className={clsx(
                  'grid grid-cols-2 items-center gap-3 border border-[#d8d4c9] bg-[#faf9f5] px-3.5 py-3 text-sm sm:grid-cols-[6rem_auto_1fr]',
                  day.closed && 'opacity-50'
                )}
              >
                <span className="font-bold text-[#1c1d1a]">{label}</span>
                <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1">
                  <input
                    type="time"
                    disabled={day.closed}
                    value={day.open}
                    onChange={(e) => updateDay(key, { open: e.target.value })}
                    className="border border-[#d8d4c9] bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-500 disabled:bg-transparent"
                  />
                  <span className="text-neutral-400">até</span>
                  <input
                    type="time"
                    disabled={day.closed}
                    value={day.close}
                    onChange={(e) => updateDay(key, { close: e.target.value })}
                    className="border border-[#d8d4c9] bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-500 disabled:bg-transparent"
                  />
                </div>
                <label className="col-start-2 row-start-1 justify-self-end flex items-center gap-1.5 text-xs font-medium text-neutral-600 sm:col-auto sm:ml-auto">
                  <input type="checkbox" checked={day.closed} onChange={(e) => updateDay(key, { closed: e.target.checked })} />
                  Fechado
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <HoverBorderGradient onClick={handleSave} disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar horários'}
      </HoverBorderGradient>
      {saved && <p className="text-xs text-green-600 animate-fade-in">Horários salvos com sucesso.</p>}
    </div>
  );
}
