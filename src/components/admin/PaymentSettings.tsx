'use client';

import { FormEvent, useState } from 'react';
import {
  Banknote,
  CreditCard,
  Percent,
  Smartphone,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, parseDecimal } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { FloatingToast, useFloatingToast } from '@/components/ui/floating-toast';
import { FieldGroup, Input, Select } from '@/components/ui/input';
import { Modal, ModalAlert, ModalFooter } from '@/components/ui/modal';
import { Alert, PageContainer, PageHeader, Panel, StatCard } from '@/components/ui/page-layout';
import { cn } from '@/lib/utils';

interface PaymentMethod {
  id: string;
  name: string;
  fee_rate: number;
  settlement_days: number;
  is_active: boolean;
}

interface Props {
  storeId: string;
  taxRegime: string;
  defaultTaxRate: number;
  defaultServiceRate: number;
  defaultCoverCharge: number;
  revenueGoal: number;
  profitGoal: number;
  initialPayments: PaymentMethod[];
}

const PRESETS = [
  { name: 'Dinheiro', fee_rate: 0, settlement_days: 0, icon: Banknote },
  { name: 'Pix', fee_rate: 0, settlement_days: 0, icon: Smartphone },
  { name: 'Débito', fee_rate: 1.5, settlement_days: 1, icon: CreditCard },
  { name: 'Crédito', fee_rate: 3.5, settlement_days: 30, icon: CreditCard },
] as const;

const TAX_REGIMES = ['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real'] as const;

function paymentIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('pix')) return Smartphone;
  if (lower.includes('dinheiro') || lower.includes('espécie')) return Banknote;
  if (lower.includes('créd') || lower.includes('credit')) return CreditCard;
  return Wallet;
}

function currentMonthKey() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

export function PaymentSettings({
  storeId,
  taxRegime: initialTaxRegime,
  defaultTaxRate: initialDefaultTaxRate,
  defaultServiceRate: initialDefaultServiceRate,
  defaultCoverCharge: initialDefaultCoverCharge,
  revenueGoal: initialRevenueGoal,
  profitGoal: initialProfitGoal,
  initialPayments,
}: Props) {
  const { toast, showToast, clearToast } = useFloatingToast();
  const [payments, setPayments] = useState(initialPayments);
  const [taxRegime, setTaxRegime] = useState(initialTaxRegime);
  const [defaultTaxRate, setDefaultTaxRate] = useState(String(initialDefaultTaxRate));
  const [defaultServiceRate, setDefaultServiceRate] = useState(String(initialDefaultServiceRate));
  const [defaultCoverCharge, setDefaultCoverCharge] = useState(String(initialDefaultCoverCharge));
  const [revenueGoal, setRevenueGoal] = useState(String(initialRevenueGoal || ''));
  const [profitGoal, setProfitGoal] = useState(String(initialProfitGoal || ''));
  const [name, setName] = useState('');
  const [fee, setFee] = useState('');
  const [days, setDays] = useState('0');
  const [savingTax, setSavingTax] = useState(false);
  const [savingRestaurant, setSavingRestaurant] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PaymentMethod | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);

  const activePayments = payments.filter((payment) => payment.is_active);
  const avgFee =
    activePayments.length > 0
      ? activePayments.reduce((sum, payment) => sum + Number(payment.fee_rate), 0) / activePayments.length
      : 0;

  const saveTaxSettings = async (event: FormEvent) => {
    event.preventDefault();
    setSavingTax(true);
    const { error } = await createClient()
      .from('store_settings')
      .update({
        tax_regime: taxRegime,
        default_tax_rate: Number.isFinite(parseDecimal(defaultTaxRate)) ? parseDecimal(defaultTaxRate) : 0,
      })
      .eq('id', storeId);
    setSavingTax(false);
    if (error) {
      showToast('Não foi possível salvar os impostos.', 'error');
      return;
    }
    showToast('Impostos atualizados.', 'success');
  };

  const saveRestaurantDefaults = async (event: FormEvent) => {
    event.preventDefault();
    setSavingRestaurant(true);
    const { error } = await createClient()
      .from('store_settings')
      .update({
        default_service_rate: Number.isFinite(parseDecimal(defaultServiceRate)) ? parseDecimal(defaultServiceRate) : 0,
        default_cover_charge: Number.isFinite(parseDecimal(defaultCoverCharge)) ? parseDecimal(defaultCoverCharge) : 0,
      })
      .eq('id', storeId);
    setSavingRestaurant(false);
    if (error) {
      showToast('Não foi possível salvar os padrões de mesa.', 'error');
      return;
    }
    showToast('Padrões de mesa atualizados.', 'success');
  };

  const saveGoals = async (event: FormEvent) => {
    event.preventDefault();
    setSavingGoals(true);
    const month = currentMonthKey();
    const supabase = createClient();
    const revenue = parseDecimal(revenueGoal);
    const profit = parseDecimal(profitGoal);

    if (revenue <= 0 && profit <= 0) {
      setSavingGoals(false);
      showToast('Informe ao menos uma meta com valor maior que zero.', 'info');
      return;
    }

    const ops = [];
    if (revenue > 0) {
      ops.push(
        supabase.from('financial_goals').upsert(
          { store_id: storeId, goal_type: 'revenue', amount: revenue, month },
          { onConflict: 'store_id,goal_type,month' }
        )
      );
    }
    if (profit > 0) {
      ops.push(
        supabase.from('financial_goals').upsert(
          { store_id: storeId, goal_type: 'profit', amount: profit, month },
          { onConflict: 'store_id,goal_type,month' }
        )
      );
    }

    const results = await Promise.all(ops);
    setSavingGoals(false);
    if (results.some((result) => result.error)) {
      showToast('Não foi possível salvar as metas.', 'error');
      return;
    }
    showToast('Metas do mês salvas.', 'success');
  };

  const addPayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setAddingPayment(true);
    const { data, error } = await createClient()
      .from('payment_methods')
      .insert({
        store_id: storeId,
        name: name.trim(),
        fee_rate: Number.isFinite(parseDecimal(fee)) ? parseDecimal(fee) : 0,
        settlement_days: Number(days) || 0,
      })
      .select('id,name,fee_rate,settlement_days,is_active')
      .single();
    setAddingPayment(false);
    if (error || !data) {
      showToast('Não foi possível adicionar a forma de pagamento.', 'error');
      return;
    }
    setPayments((previous) => [...previous, data]);
    setName('');
    setFee('');
    setDays('0');
    showToast(`${data.name} cadastrado.`, 'success');
  };

  const addPreset = async (preset: (typeof PRESETS)[number]) => {
    if (payments.some((payment) => payment.name.toLowerCase() === preset.name.toLowerCase())) {
      showToast(`${preset.name} já está cadastrado.`, 'info');
      return;
    }
    setAddingPayment(true);
    const { data, error } = await createClient()
      .from('payment_methods')
      .insert({
        store_id: storeId,
        name: preset.name,
        fee_rate: preset.fee_rate,
        settlement_days: preset.settlement_days,
      })
      .select('id,name,fee_rate,settlement_days,is_active')
      .single();
    setAddingPayment(false);
    if (error || !data) {
      showToast('Não foi possível adicionar.', 'error');
      return;
    }
    setPayments((previous) => [...previous, data]);
    showToast(`${preset.name} adicionado.`, 'success');
  };

  const updatePayment = async (payment: PaymentMethod, patch: Partial<Pick<PaymentMethod, 'fee_rate' | 'settlement_days' | 'is_active'>>) => {
    const { error } = await createClient().from('payment_methods').update(patch).eq('id', payment.id);
    if (error) {
      showToast('Não foi possível atualizar.', 'error');
      return;
    }
    setPayments((previous) =>
      previous.map((item) => (item.id === payment.id ? { ...item, ...patch } : item))
    );
    showToast('Forma de pagamento atualizada.', 'success');
  };

  const removePayment = async () => {
    if (!pendingDelete) return;
    setDeletingPayment(true);
    const { error } = await createClient().from('payment_methods').delete().eq('id', pendingDelete.id);
    setDeletingPayment(false);
    if (error) {
      showToast('Não foi possível remover.', 'error');
      return;
    }
    setPayments((previous) => previous.filter((item) => item.id !== pendingDelete.id));
    setPendingDelete(null);
    showToast('Forma de pagamento removida.', 'success');
  };

  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        eyebrow="Configuração financeira"
        title="Taxas e ajustes"
        description="Taxas de pagamento, impostos padrão e metas entram automaticamente no lucro real das vendas e nos relatórios."
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Formas ativas"
          value={activePayments.length}
          icon={<Wallet size={18} />}
          tone="info"
        />
        <StatCard
          label="Taxa média"
          value={`${avgFee.toFixed(1)}%`}
          icon={<Percent size={18} />}
          tone="warning"
        />
        <StatCard
          label="Imposto padrão"
          value={`${parseDecimal(defaultTaxRate)}%`}
          icon={<Target size={18} />}
          tone="success"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Impostos" eyebrow="Padrão da loja" noPadding>
          <form onSubmit={saveTaxSettings} className="space-y-4 p-5">
            <FieldGroup label="Regime tributário">
              <Select value={taxRegime} onChange={(e) => setTaxRegime(e.target.value)}>
                {TAX_REGIMES.map((regime) => (
                  <option key={regime} value={regime}>
                    {regime}
                  </option>
                ))}
              </Select>
            </FieldGroup>
            <FieldGroup label="Alíquota padrão (%)">
              <Input
                value={defaultTaxRate}
                onChange={(e) => setDefaultTaxRate(e.target.value)}
                inputMode="decimal"
                placeholder="Ex.: 6"
              />
            </FieldGroup>
            <p className="text-xs leading-relaxed text-neutral-500">
              Usada como referência no simulador e ao cadastrar produtos. Cada produto pode ter alíquota própria na precificação.
            </p>
            <Button type="submit" variant="primary" size="md" disabled={savingTax}>
              {savingTax ? 'Salvando...' : 'Salvar impostos'}
            </Button>
          </form>
        </Panel>

        <Panel title="Mesas e comandas" eyebrow="Padrões do PDV" noPadding>
          <form onSubmit={saveRestaurantDefaults} className="space-y-4 p-5">
            <FieldGroup label="Taxa de serviço padrão (%)">
              <Input
                value={defaultServiceRate}
                onChange={(e) => setDefaultServiceRate(e.target.value)}
                inputMode="decimal"
                placeholder="Ex.: 10"
              />
            </FieldGroup>
            <FieldGroup label="Couvert por pessoa (R$)">
              <Input
                value={defaultCoverCharge}
                onChange={(e) => setDefaultCoverCharge(e.target.value)}
                inputMode="decimal"
                placeholder="Ex.: 15"
              />
            </FieldGroup>
            <p className="text-xs leading-relaxed text-neutral-500">
              Aplicados automaticamente ao abrir uma mesa. Podem ser alterados na comanda antes de fechar.
            </p>
            <Button type="submit" variant="primary" size="md" disabled={savingRestaurant}>
              {savingRestaurant ? 'Salvando...' : 'Salvar padrões de mesa'}
            </Button>
          </form>
        </Panel>

        <Panel title="Metas do mês" eyebrow={new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} noPadding>
          <form onSubmit={saveGoals} className="space-y-4 p-5">
            <FieldGroup label="Meta de faturamento (R$)">
              <Input
                value={revenueGoal}
                onChange={(e) => setRevenueGoal(e.target.value)}
                inputMode="decimal"
                placeholder="Ex.: 50000"
              />
            </FieldGroup>
            <FieldGroup label="Meta de lucro real (R$)">
              <Input
                value={profitGoal}
                onChange={(e) => setProfitGoal(e.target.value)}
                inputMode="decimal"
                placeholder="Ex.: 12000"
              />
            </FieldGroup>
            <p className="text-xs leading-relaxed text-neutral-500">
              Aparecem na visão geral do admin para acompanhar o progresso do mês.
            </p>
            <Button type="submit" variant="primary" size="md" disabled={savingGoals}>
              {savingGoals ? 'Salvando...' : 'Salvar metas'}
            </Button>
          </form>
        </Panel>
      </div>

      <Panel className="mt-6" title="Formas de pagamento" eyebrow="Taxas automáticas no PDV" noPadding>
        <div className="border-b border-border px-5 py-4">
          <p className="text-xs text-neutral-500">Atalhos rápidos</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((preset) => {
              const Icon = preset.icon;
              return (
                <button
                  key={preset.name}
                  type="button"
                  disabled={addingPayment}
                  onClick={() => addPreset(preset)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-black/30 px-3 py-2 text-xs font-bold text-neutral-300 transition-colors hover:border-brand-400 hover:text-brand-300 disabled:opacity-50"
                >
                  <Icon size={14} />
                  {preset.name} · {preset.fee_rate}%
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={addPayment} className="grid gap-3 border-b border-border p-5 sm:grid-cols-2 lg:grid-cols-[1fr_7rem_7rem_auto]">
          <FieldGroup label="Nome">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Crédito 3x" required />
          </FieldGroup>
          <FieldGroup label="Taxa (%)">
            <Input value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" inputMode="decimal" required />
          </FieldGroup>
          <FieldGroup label="Prazo (dias)">
            <Input value={days} onChange={(e) => setDays(e.target.value)} placeholder="0" inputMode="numeric" />
          </FieldGroup>
          <div className="flex items-end">
            <Button type="submit" variant="primary" size="md" fullWidth disabled={addingPayment}>
              {addingPayment ? '...' : 'Adicionar'}
            </Button>
          </div>
        </form>

        {payments.length ? (
          <div className="divide-y divide-border">
            {payments.map((payment) => {
              const Icon = paymentIcon(payment.name);
              return (
                <div
                  key={payment.id}
                  className={cn(
                    'flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between',
                    !payment.is_active && 'opacity-60'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-400/10 text-brand-300">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{payment.name}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        Simulação: {formatCurrency(100)} → lucro ≈{' '}
                        {formatCurrency(100 - 100 * (Number(payment.fee_rate) / 100))} após taxa
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs">
                      <span className="text-neutral-500">Taxa</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        defaultValue={payment.fee_rate}
                        onBlur={(e) => {
                          const next = parseDecimal(e.target.value);
                          if (Number.isFinite(next) && next !== payment.fee_rate) {
                            updatePayment(payment, { fee_rate: next });
                          }
                        }}
                        className="w-14 bg-transparent text-right font-bold text-ink outline-none"
                      />
                      <span className="text-neutral-500">%</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs">
                      <span className="text-neutral-500">Cai em</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        defaultValue={payment.settlement_days}
                        onBlur={(e) => {
                          const next = Number(e.target.value);
                          if (!Number.isNaN(next) && next !== payment.settlement_days) {
                            updatePayment(payment, { settlement_days: next });
                          }
                        }}
                        className="w-10 bg-transparent text-right font-bold text-ink outline-none"
                      />
                      <span className="text-neutral-500">d</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => updatePayment(payment, { is_active: !payment.is_active })}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-xs font-bold transition-colors',
                        payment.is_active
                          ? 'border-brand-400/40 bg-brand-400/10 text-brand-300'
                          : 'border-border text-neutral-500 hover:border-neutral-500'
                      )}
                    >
                      {payment.is_active ? 'Ativa' : 'Inativa'}
                    </button>
                    <button
                      type="button"
                      title="Remover"
                      onClick={() => setPendingDelete(payment)}
                      className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Alert variant="info" className="m-5">
            Cadastre Dinheiro, Pix, Débito e Crédito para o PDV calcular taxas e lucro automaticamente.
          </Alert>
        )}
      </Panel>

      {pendingDelete && (
        <Modal
          onClose={() => setPendingDelete(null)}
          title="Remover forma de pagamento"
          subtitle={pendingDelete.name}
          description="Vendas antigas não serão afetadas."
          size="md"
          variant="center"
          motionPreset="fade"
          footer={
            <ModalFooter>
              <Button variant="secondary" size="md" onClick={() => setPendingDelete(null)} className="normal-case">
                Cancelar
              </Button>
              <Button variant="danger" size="md" onClick={removePayment} disabled={deletingPayment} className="normal-case">
                {deletingPayment ? 'Removendo...' : 'Remover'}
              </Button>
            </ModalFooter>
          }
        >
          <ModalAlert variant="warning">
            O PDV deixará de oferecer esta forma de pagamento em novas comandas.
          </ModalAlert>
        </Modal>
      )}

      <FloatingToast toast={toast} onClose={clearToast} />
    </PageContainer>
  );
}
