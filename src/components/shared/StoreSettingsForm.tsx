'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import type { StoreSettings } from '@/lib/types/database';

const INPUT_CLASS =
  'w-full border border-[#d8d4c9] bg-[#faf9f5] px-3.5 py-3 text-sm outline-none transition-colors focus:border-brand-500';

const SECTION_TITLE_CLASS = 'mb-1 font-serif text-lg font-bold text-[#1c1d1a]';
const SECTION_HINT_CLASS = 'mb-4 text-xs text-neutral-500';
const LABEL_CLASS = 'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      {children}
    </div>
  );
}

export function StoreSettingsForm({ store }: { store: StoreSettings }) {
  const supabase = createClient();
  const [form, setForm] = useState({
    name: store.name,
    tagline: store.tagline ?? '',
    logo_url: store.logo_url ?? '',
    banner_url: store.banner_url ?? '',
    phone: store.phone ?? '',
    address_street: store.address_street ?? '',
    address_city: store.address_city ?? '',
    address_state: store.address_state ?? '',
    delivery_fee_type: store.delivery_fee_type,
    delivery_fee_fixed: store.delivery_fee_fixed,
    delivery_fee_per_km: store.delivery_fee_per_km,
    min_order_value: store.min_order_value,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);

    const { data, error: saveError } = await supabase
      .from('store_settings')
      .update({
        ...form,
        tagline: form.tagline || null,
        logo_url: form.logo_url || null,
        banner_url: form.banner_url || null,
        phone: form.phone || null,
        address_street: form.address_street || null,
        address_city: form.address_city || null,
        address_state: form.address_state || null,
      })
      .eq('id', store.id)
      .select('id');

    setSaving(false);
    if (saveError || !data || data.length === 0) {
      setError('Não foi possível salvar. Verifique se sua conta tem permissão de administrador.');
      return;
    }
    setSaved(true);
  };

  return (
    <div className="space-y-6">
      <section className="border border-[#d8d4c9] bg-[#f7f5ef] p-4 shadow-[0_4px_0_rgba(28,29,26,0.06)] animate-fade-in-up sm:p-6">
        <h2 className={SECTION_TITLE_CLASS}>Identidade</h2>
        <p className={SECTION_HINT_CLASS}>Nome, frase de efeito e imagens usadas na hero e no cabeçalho do site.</p>
        <div className="space-y-4">
          <Field label="Nome da loja">
            <input value={form.name} onChange={set('name')} className={INPUT_CLASS} />
          </Field>
          <Field label="Tagline (frase curta da hero)">
            <input
              value={form.tagline}
              onChange={set('tagline')}
              placeholder="Ex: Sabor de verdade, entregue rápido."
              className={INPUT_CLASS}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="URL da logo">
              <input value={form.logo_url} onChange={set('logo_url')} placeholder="https://..." className={INPUT_CLASS} />
            </Field>
            <Field label="URL do banner (hero)">
              <input value={form.banner_url} onChange={set('banner_url')} placeholder="https://..." className={INPUT_CLASS} />
            </Field>
          </div>
          <p className="text-xs text-neutral-400">
            Sem hospedagem de imagens configurada ainda — cole a URL de uma imagem já publicada (ex: Supabase Storage, Imgur).
            Sem isso, a logo usa as iniciais da loja automaticamente.
          </p>
        </div>
      </section>

      <section className="border border-[#d8d4c9] bg-[#f7f5ef] p-4 shadow-[0_4px_0_rgba(28,29,26,0.06)] animate-fade-in-up [animation-delay:60ms] sm:p-6">
        <h2 className={SECTION_TITLE_CLASS}>Contato e endereço</h2>
        <p className={SECTION_HINT_CLASS}>Mostrado para os clientes e usado pela equipe para localizar a loja.</p>
        <div className="space-y-4">
          <Field label="Telefone / WhatsApp">
            <input value={form.phone} onChange={set('phone')} placeholder="(11) 99999-9999" className={INPUT_CLASS} />
          </Field>
          <Field label="Endereço (rua e número)">
            <input value={form.address_street} onChange={set('address_street')} className={INPUT_CLASS} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Cidade">
              <input value={form.address_city} onChange={set('address_city')} className={INPUT_CLASS} />
            </Field>
            <Field label="Estado (UF)">
              <input
                value={form.address_state}
                maxLength={2}
                onChange={(e) => setForm((f) => ({ ...f, address_state: e.target.value.toUpperCase() }))}
                className={INPUT_CLASS}
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="border border-[#d8d4c9] bg-[#f7f5ef] p-4 shadow-[0_4px_0_rgba(28,29,26,0.06)] animate-fade-in-up [animation-delay:120ms] sm:p-6">
        <h2 className={SECTION_TITLE_CLASS}>Entrega</h2>
        <p className={SECTION_HINT_CLASS}>Como a taxa de entrega é calculada e o valor mínimo para fechar um pedido.</p>
        <div className="space-y-4">
          <Field label="Tipo de taxa de entrega">
            <select
              value={form.delivery_fee_type}
              onChange={(e) => setForm((f) => ({ ...f, delivery_fee_type: e.target.value as 'fixed' | 'per_km' }))}
              className={INPUT_CLASS}
            >
              <option value="fixed">Taxa fixa</option>
              <option value="per_km">Por km</option>
            </select>
          </Field>

          {form.delivery_fee_type === 'fixed' ? (
            <div className="animate-fade-in">
              <Field label="Taxa fixa (R$)">
                <input
                  type="number"
                  step="0.01"
                  value={form.delivery_fee_fixed}
                  onChange={(e) => setForm((f) => ({ ...f, delivery_fee_fixed: Number(e.target.value) }))}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
          ) : (
            <div className="animate-fade-in">
              <Field label="Valor por km (R$)">
                <input
                  type="number"
                  step="0.01"
                  value={form.delivery_fee_per_km}
                  onChange={(e) => setForm((f) => ({ ...f, delivery_fee_per_km: Number(e.target.value) }))}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
          )}

          <Field label="Pedido mínimo (R$)">
            <input
              type="number"
              step="0.01"
              value={form.min_order_value}
              onChange={(e) => setForm((f) => ({ ...f, min_order_value: Number(e.target.value) }))}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
      </section>

      {error && <p className="text-sm text-red-500 animate-fade-in">{error}</p>}

      <HoverBorderGradient onClick={handleSave} disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar configurações'}
      </HoverBorderGradient>
      {saved && <p className="text-xs text-green-600 animate-fade-in">Configurações salvas com sucesso.</p>}
    </div>
  );
}
