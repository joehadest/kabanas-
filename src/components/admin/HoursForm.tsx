'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { FloatingToast, useFloatingToast } from '@/components/ui/floating-toast';
import { Panel } from '@/components/ui/page-layout';
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
  const { toast, showToast, clearToast } = useFloatingToast();
  const [hours, setHours] = useState<OpeningHours>(store.opening_hours ?? {});
  const [override, setOverride] = useState<'auto' | 'open' | 'closed'>(
    store.is_open_override === true ? 'open' : store.is_open_override === false ? 'closed' : 'auto'
  );
  const [saving, setSaving] = useState(false);

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
    showToast('Horário de segunda copiado para todos os dias.', 'info');
  };

  const handleSave = async () => {
    setSaving(true);
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
      showToast('Não foi possível salvar. Verifique se sua conta tem permissão de administrador.', 'error');
      return;
    }
    showToast('Horários salvos com sucesso.', 'success');
  };

  return (
    <div className="space-y-6">
      <Panel title="Status agora" eyebrow="Exceção manual" noPadding>
        <div className="space-y-2 p-5">
          <p className="mb-2 text-xs text-neutral-500">
            Sobrepõe o horário programado quando você precisar de uma exceção rápida.
          </p>
          {OVERRIDE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={clsx(
                'flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-3 text-sm transition-colors',
                override === opt.value
                  ? 'border-brand-400 bg-brand-400/10'
                  : 'border-border bg-surface-elevated hover:border-brand-400/40'
              )}
            >
              <span>
                <span className="block font-bold text-ink">{opt.label}</span>
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
      </Panel>

      <Panel
        title="Horário programado"
        eyebrow="Semana"
        noPadding
        action={
          <button
            onClick={applyToAll}
            type="button"
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-neutral-400 transition-colors hover:border-brand-400 hover:text-brand-300"
          >
            Copiar segunda p/ todos
          </button>
        }
      >
        <div className="divide-y divide-border">
          {DAYS.map(({ key, label }) => {
            const day = dayValue(key);
            return (
              <div
                key={key}
                className={clsx(
                  'grid grid-cols-2 items-center gap-3 px-5 py-3.5 text-sm sm:grid-cols-[6rem_auto_1fr]',
                  day.closed && 'opacity-50'
                )}
              >
                <span className="font-bold text-ink">{label}</span>
                <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1">
                  <input
                    type="time"
                    disabled={day.closed}
                    value={day.open}
                    onChange={(e) => updateDay(key, { open: e.target.value })}
                    className="rounded-lg border border-border bg-surface-elevated px-2 py-1.5 text-sm outline-none focus:border-brand-400 disabled:bg-transparent"
                  />
                  <span className="text-neutral-400">até</span>
                  <input
                    type="time"
                    disabled={day.closed}
                    value={day.close}
                    onChange={(e) => updateDay(key, { close: e.target.value })}
                    className="rounded-lg border border-border bg-surface-elevated px-2 py-1.5 text-sm outline-none focus:border-brand-400 disabled:bg-transparent"
                  />
                </div>
                <label className="col-start-2 row-start-1 flex items-center gap-1.5 justify-self-end text-xs font-medium text-neutral-400 sm:col-auto sm:ml-auto">
                  <input type="checkbox" checked={day.closed} onChange={(e) => updateDay(key, { closed: e.target.checked })} />
                  Fechado
                </label>
              </div>
            );
          })}
        </div>
      </Panel>

      <Button variant="brand" size="lg" onClick={handleSave} disabled={saving} fullWidth className="normal-case">
        {saving ? 'Salvando...' : 'Salvar horários'}
      </Button>

      <FloatingToast toast={toast} onClose={clearToast} />
    </div>
  );
}
