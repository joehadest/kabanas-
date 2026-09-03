'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  ArrowDownToLine,
  ArrowLeft,
  Banknote,
  LockKeyhole,
  Minus,
  MinusCircle,
  Plus,
  PlusCircle,
  Receipt,
  RefreshCw,
  Trash2,
  WalletCards,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, parseDecimal, relationOne, tableDisplayLabel } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_LIST_LIMIT,
  ListSearchBar,
  ShowMoreToggle,
} from '@/components/ui/collapsible-list';
import { FieldGroup, Input, Select, Textarea } from '@/components/ui/input';
import { FloatingToast, useFloatingToast } from '@/components/ui/floating-toast';
import { Modal, ModalAlert, ModalFooter } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Alert, EmptyState, PageContainer, PageHeader, Panel, StatCard } from '@/components/ui/page-layout';

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05];

type SessionSale = {
  id: string;
  total_amount: number;
  occurred_at: string;
  notes: string | null;
  payment_methods: { name: string } | { name: string }[] | null;
};

type SessionTabPayment = {
  id: string;
  amount: number;
  created_at: string;
  payment_methods: { name: string } | { name: string }[] | null;
  tabs: { identifier: string | null; status: string } | { identifier: string | null; status: string }[] | null;
};

type Session = {
  id: string;
  operator_id: string;
  terminal_name: string;
  opening_balance: number;
  opened_at: string;
  status: 'open' | 'closed';
  expected_cash: number | null;
  counted_cash: number | null;
  difference: number | null;
  cash_movements: { movement_type: string; amount: number; reason: string; created_at: string }[];
  sales?: SessionSale[];
  tab_payments?: SessionTabPayment[];
};

function openTabPayments(session: Session): SessionTabPayment[] {
  return (session.tab_payments ?? []).filter((payment) => {
    const tab = relationOne(payment.tabs);
    return tab?.status !== 'closed' && tab?.status !== 'cancelled';
  });
}

function closedTabPaymentsForSale(session: Session, saleNotes: string | null): SessionTabPayment[] {
  const label = saleNotes?.startsWith('Comanda') ? tableDisplayLabel(saleNotes) : null;
  if (!label) return [];
  return (session.tab_payments ?? []).filter((payment) => {
    const tab = relationOne(payment.tabs);
    return tab?.status === 'closed' && tableDisplayLabel(tab.identifier) === label;
  });
}

function sessionLinks(session: Session) {
  const sales = session.sales ?? [];
  const tabPayments = openTabPayments(session);
  const movements = session.cash_movements ?? [];
  return {
    sales,
    tabPayments,
    movements,
    salesTotal: sales.reduce((sum, sale) => sum + Number(sale.total_amount), 0),
    tabPaymentsTotal: tabPayments.reduce((sum, payment) => sum + Number(payment.amount), 0),
    hasLinks: sales.length > 0 || tabPayments.length > 0 || movements.length > 0,
  };
}

function voidBlockReason(session: Session): string | null {
  const { sales, tabPayments, movements } = sessionLinks(session);
  const parts: string[] = [];
  if (sales.length) parts.push(`${sales.length} venda${sales.length > 1 ? 's' : ''} fechada${sales.length > 1 ? 's' : ''}`);
  if (tabPayments.length) {
    parts.push(
      `${tabPayments.length} pagamento${tabPayments.length > 1 ? 's' : ''} de comanda (remova no PDV se foi teste)`
    );
  }
  if (movements.length) {
    parts.push(`${movements.length} sangria${movements.length > 1 ? 's' : ''}/suprimento${movements.length > 1 ? 's' : ''}`);
  }
  if (!parts.length) return null;
  return `Este caixa possui ${parts.join(', ')} e não pode ser removido.`;
}

type ActivityItem =
  | { kind: 'sale'; id: string; at: string; title: string; subtitle: string; amount: number }
  | { kind: 'tab_payment'; id: string; at: string; title: string; subtitle: string; amount: number; pending: boolean }
  | { kind: 'movement'; id: string; at: string; title: string; subtitle: string; amount: number; outflow: boolean };

function buildActivity(session: Session): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const sale of session.sales ?? []) {
    const relatedPayments = closedTabPaymentsForSale(session, sale.notes);
    const paymentNames = relatedPayments
      .map((payment) => relationOne(payment.payment_methods)?.name)
      .filter(Boolean);
    items.push({
      kind: 'sale',
      id: sale.id,
      at: sale.occurred_at,
      title: sale.notes?.startsWith('Comanda') ? tableDisplayLabel(sale.notes) : 'Venda fechada',
      subtitle:
        paymentNames.length > 0
          ? paymentNames.join(', ')
          : relationOne(sale.payment_methods)?.name ?? 'Venda fechada',
      amount: Number(sale.total_amount),
    });
  }

  for (const payment of openTabPayments(session)) {
    const tab = relationOne(payment.tabs);
    const tabLabel = tableDisplayLabel(tab?.identifier);
    items.push({
      kind: 'tab_payment',
      id: payment.id,
      at: payment.created_at,
      title: `Pagamento · ${tabLabel}`,
      subtitle: relationOne(payment.payment_methods)?.name ?? 'Pagamento',
      amount: Number(payment.amount),
      pending: tab?.status !== 'closed',
    });
  }

  for (const [index, movement] of (session.cash_movements ?? []).entries()) {
    items.push({
      kind: 'movement',
      id: `${movement.created_at}-${index}`,
      at: movement.created_at,
      title: movement.movement_type === 'cash_out' ? 'Sangria' : 'Suprimento',
      subtitle: movement.reason,
      amount: Number(movement.amount),
      outflow: movement.movement_type === 'cash_out',
    });
  }

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

interface Props {
  storeId: string;
  operatorId: string;
  sessions: Session[];
}

function parseAmount(value: string): number {
  const parsed = parseDecimal(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function denominationLabel(value: number) {
  const formatted = value.toFixed(2).replace('.', ',');
  return value >= 2 ? `R$ ${formatted}` : `R$ ${formatted}`;
}

function CashNoteCounter({
  counts,
  onCountChange,
  closingNote,
  onClosingNoteChange,
  countedTotal,
  onSubmit,
  submitting,
}: {
  counts: Record<string, string>;
  onCountChange: (denomination: number, value: string) => void;
  closingNote: string;
  onClosingNoteChange: (value: string) => void;
  countedTotal: number;
  onSubmit: (event: FormEvent) => void;
  submitting?: boolean;
}) {
  const adjustCount = (denomination: number, delta: number) => {
    const current = Number(counts[String(denomination)]) || 0;
    onCountChange(denomination, String(Math.max(0, current + delta)));
  };

  return (
    <form id="close-cash-form" onSubmit={onSubmit} className="flex flex-col">
      <div className="max-h-[min(52vh,560px)] space-y-2 overflow-y-auto overscroll-y-contain pr-1">
        {DENOMINATIONS.map((denomination) => {
          const qty = Number(counts[String(denomination)]) || 0;
          const lineTotal = denomination * qty;

          return (
            <div
              key={denomination}
              className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-xl border border-brand-400/30 bg-surface-elevated px-3 py-2.5 sm:grid-cols-[7rem_auto_1fr] sm:gap-3"
            >
              <div>
                <p className="text-sm font-bold text-ink">{denominationLabel(denomination)}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                  {denomination >= 2 ? 'Cédula' : 'Moeda'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => adjustCount(denomination, -1)}
                  disabled={qty <= 0}
                  aria-label={`Diminuir 1 ${denominationLabel(denomination)}`}
                  className="flex h-10 w-9 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-border bg-neutral-900 text-neutral-300 transition-colors hover:border-brand-400 hover:text-brand-300 disabled:pointer-events-none disabled:opacity-40"
                >
                  <Minus size={15} />
                </button>
                <Input
                  value={counts[String(denomination)] || ''}
                  onChange={(event) => onCountChange(denomination, event.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  placeholder="0"
                  aria-label={`Quantidade de ${denominationLabel(denomination)}`}
                  className="h-10 w-12 shrink-0 px-1 text-center font-semibold sm:w-14"
                />
                <button
                  type="button"
                  onClick={() => adjustCount(denomination, 1)}
                  aria-label={`Adicionar 1 ${denominationLabel(denomination)}`}
                  className="flex h-10 w-9 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-border bg-neutral-900 text-neutral-300 transition-colors hover:border-brand-400 hover:text-brand-300"
                >
                  <Plus size={15} />
                </button>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-neutral-500">
                  {qty} × {formatCurrency(denomination)}
                </p>
                <p className={clsx('text-sm font-bold', lineTotal > 0 ? 'text-brand-300' : 'text-neutral-400')}>
                  {formatCurrency(lineTotal)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-brand-400/30 bg-surface-elevated px-4 py-4">
        <p className="text-[10px] font-bold uppercase tracking-wide text-brand-300">Total contado</p>
        <p className="mt-1 font-serif text-3xl font-bold text-brand-300">{formatCurrency(countedTotal)}</p>
      </div>

      <FieldGroup label="Observação do fechamento" className="mt-4">
        <Textarea
          value={closingNote}
          onChange={(event) => onClosingNoteChange(event.target.value)}
          placeholder="Opcional"
          rows={3}
        />
      </FieldGroup>

      <Button variant="primary" size="lg" type="submit" fullWidth disabled={submitting} className="mt-5 normal-case">
        <ArrowDownToLine size={18} />
        {submitting ? 'Fechando caixa...' : 'Conferir e fechar caixa'}
      </Button>
    </form>
  );
}

export function CashRegisterNormal({ storeId, operatorId, sessions: initialSessions }: Props) {
  const router = useRouter();
  const { toast, showToast, clearToast } = useFloatingToast();
  const [sessions, setSessions] = useState(initialSessions);

  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);
  const [terminal, setTerminal] = useState('Caixa principal');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [movementType, setMovementType] = useState<'cash_in' | 'cash_out'>('cash_out');
  const [movementAmount, setMovementAmount] = useState('');
  const [reason, setReason] = useState('');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [closingNote, setClosingNote] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [closing, setClosing] = useState(false);
  const [opening, setOpening] = useState(false);

  const [openModal, setOpenModal] = useState(false);
  const [movementModal, setMovementModal] = useState(false);
  const [closeConfirmModal, setCloseConfirmModal] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Session | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [cancelModal, setCancelModal] = useState(false);
  const [manageSession, setManageSession] = useState<Session | null>(null);
  const [removingLinkId, setRemovingLinkId] = useState<string | null>(null);
  const [pendingLinkedRemoval, setPendingLinkedRemoval] = useState<
    { type: 'payment'; sessionId: string; paymentId: string } | { type: 'sale'; sessionId: string; saleId: string } | null
  >(null);

  const active = sessions.find((session) => session.status === 'open' && session.operator_id === operatorId);
  const otherOpenSession = sessions.find(
    (session) => session.status === 'open' && session.operator_id !== operatorId
  );
  const countedTotal = DENOMINATIONS.reduce(
    (total, denomination) => total + denomination * (Number(counts[String(denomination)]) || 0),
    0
  );

  const normalizedHistorySearch = historySearch.trim().toLowerCase();
  const filteredHistory = useMemo(() => {
    if (!normalizedHistorySearch) return sessions;
    return sessions.filter((session) => session.terminal_name.toLowerCase().includes(normalizedHistorySearch));
  }, [sessions, normalizedHistorySearch]);

  const visibleHistory =
    showAllHistory || normalizedHistorySearch ? filteredHistory : filteredHistory.slice(0, DEFAULT_LIST_LIMIT);
  const hiddenHistoryCount = Math.max(0, filteredHistory.length - DEFAULT_LIST_LIMIT);

  const open = async (event: FormEvent) => {
    event.preventDefault();
    const balance = parseAmount(openingBalance);
    if (balance < 0) {
      showToast('O fundo de troco não pode ser negativo.', 'error');
      return;
    }
    if (active) {
      showToast('Você já tem um caixa aberto neste turno.', 'error');
      return;
    }

    setOpening(true);
    clearToast();
    const { data, error } = await createClient()
      .from('cash_sessions')
      .insert({
        store_id: storeId,
        operator_id: operatorId,
        terminal_name: terminal.trim() || 'Caixa principal',
        currency_code: 'BRL',
        opening_balance: balance,
      })
      .select(
        'id,operator_id,terminal_name,opening_balance,opened_at,status,expected_cash,counted_cash,difference,cash_movements(movement_type,amount,reason,created_at),sales(id,total_amount,occurred_at,notes,payment_methods(name)),tab_payments(id,amount,created_at,payment_methods(name),tabs(identifier,status))'
      )
      .single();
    setOpening(false);

    if (error || !data) {
      const msg = error?.message ?? '';
      showToast(
        msg.includes('unique') || msg.includes('duplicate')
          ? 'Já existe um caixa aberto neste terminal para o seu usuário.'
          : msg || 'Não foi possível abrir o caixa.',
        'error'
      );
      return;
    }

    setSessions((current) => [data, ...current]);
    setOpenModal(false);
    setOpeningBalance('0');
    showToast('Caixa aberto. Vendas e pagamentos serão vinculados a este turno.', 'success');
  };

  const registerMovement = async (event: FormEvent) => {
    event.preventDefault();
    if (!active) return;
    const amount = parseAmount(movementAmount);
    if (amount <= 0 || !reason.trim()) {
      showToast('Informe valor e motivo da movimentação.', 'error');
      return;
    }

    const { data, error } = await createClient()
      .from('cash_movements')
      .insert({
        cash_session_id: active.id,
        movement_type: movementType,
        amount,
        reason: reason.trim(),
        created_by: operatorId,
      })
      .select('movement_type,amount,reason,created_at')
      .single();

    if (error || !data) {
      showToast(error?.message || 'Não foi possível registrar a movimentação.', 'error');
      return;
    }

    setSessions((current) =>
      current.map((session) =>
        session.id === active.id ? { ...session, cash_movements: [data, ...session.cash_movements] } : session
      )
    );
    setMovementAmount('');
    setReason('');
    setMovementModal(false);
    showToast(movementType === 'cash_out' ? 'Sangria registrada.' : 'Suprimento registrado.', 'success');
  };

  const requestClose = (event: FormEvent) => {
    event.preventDefault();
    if (!active) return;
    setCloseConfirmModal(true);
  };

  const confirmClose = async () => {
    if (!active) return;

    const noteCounts = Object.fromEntries(
      DENOMINATIONS.map((denomination) => [String(denomination), Number(counts[String(denomination)]) || 0])
    );

    setClosing(true);
    const { data, error } = await createClient()
      .rpc('close_cash_session_detailed', {
        session_to_close: active.id,
        physical_cash: countedTotal,
        note: closingNote || null,
        note_counts: noteCounts,
      })
      .single();
    setClosing(false);

    if (error || !data) {
      showToast(error?.message || 'Não foi possível fechar o caixa.', 'error');
      return;
    }

    const result = data as { expected_cash: number; difference: number };
    setSessions((current) =>
      current.map((session) =>
        session.id === active.id
          ? {
              ...session,
              status: 'closed',
              expected_cash: result.expected_cash,
              counted_cash: countedTotal,
              difference: result.difference,
            }
          : session
      )
    );
    setCounts({});
    setClosingNote('');
    setCloseConfirmModal(false);
    showToast(
      `Caixa fechado. Esperado ${formatCurrency(result.expected_cash)} · Diferença ${formatCurrency(result.difference)}.`,
      Math.abs(result.difference) <= 0.01 ? 'success' : 'info'
    );
  };

  const removeFromHistory = async (event: FormEvent) => {
    event.preventDefault();
    if (!removeTarget || !removeReason.trim()) return;

    const { error } = await createClient().rpc('void_cash_session', {
      session_id: removeTarget.id,
      correction_reason: removeReason.trim(),
    });

    if (error) {
      showToast(error.message, 'error');
      return;
    }

    setSessions((current) => current.filter((item) => item.id !== removeTarget.id));
    setRemoveTarget(null);
    setRemoveReason('');
    showToast('Turno removido do histórico (preservado na auditoria).', 'success');
  };

  const cancelAccidentalOpening = async () => {
    if (!active) return;

    const block = voidBlockReason(active);
    if (block) {
      showToast(block, 'error');
      setCancelModal(false);
      return;
    }

    const { error } = await createClient().rpc('void_cash_session', {
      session_id: active.id,
      correction_reason: 'Abertura feita por engano',
    });

    if (error) {
      showToast(error.message, 'error');
      return;
    }

    setSessions((current) => current.filter((item) => item.id !== active.id));
    setCancelModal(false);
    setCounts({});
    setClosingNote('');
    showToast('Abertura cancelada.', 'success');
    router.refresh();
  };

  const handleCountChange = (denomination: number, value: string) => {
    setCounts((current) => ({ ...current, [String(denomination)]: value }));
  };

  const patchSessionLinks = (sessionId: string, patch: (session: Session) => Session) => {
    setSessions((current) => current.map((session) => (session.id === sessionId ? patch(session) : session)));
    setManageSession((current) => (current?.id === sessionId ? patch(current) : current));
  };

  const removeLinkedTabPayment = async (sessionId: string, paymentId: string) => {
    setRemovingLinkId(paymentId);
    const { error } = await createClient().from('tab_payments').delete().eq('id', paymentId);
    setRemovingLinkId(null);
    if (error) {
      showToast(error.message || 'Não foi possível remover o pagamento.', 'error');
      return;
    }
    patchSessionLinks(sessionId, (session) => ({
      ...session,
      tab_payments: (session.tab_payments ?? []).filter((payment) => payment.id !== paymentId),
    }));
    showToast('Pagamento removido.', 'success');
  };

  const removeLinkedSale = async (sessionId: string, saleId: string) => {
    const session = sessions.find((item) => item.id === sessionId);
    const sale = session?.sales?.find((item) => item.id === saleId);
    const relatedPayments = session && sale ? closedTabPaymentsForSale(session, sale.notes) : [];

    setRemovingLinkId(saleId);
    const { error } = await createClient().from('sales').delete().eq('id', saleId);
    if (!error && relatedPayments.length) {
      await createClient()
        .from('tab_payments')
        .delete()
        .in(
          'id',
          relatedPayments.map((payment) => payment.id)
        );
    }
    setRemovingLinkId(null);
    if (error) {
      showToast(error.message || 'Não foi possível remover a venda.', 'error');
      return;
    }
    patchSessionLinks(sessionId, (current) => ({
      ...current,
      sales: (current.sales ?? []).filter((item) => item.id !== saleId),
      tab_payments: (current.tab_payments ?? []).filter(
        (payment) => !relatedPayments.some((related) => related.id === payment.id)
      ),
    }));
    showToast('Venda removida.', 'success');
  };

  const renderActivityRow = (sessionId: string, item: ActivityItem) => (
    <div key={item.id} className="flex items-start justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-ink">{item.title}</p>
          {item.kind === 'sale' && (
            <span className="rounded-full bg-brand-400/15 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-300">
              Venda
            </span>
          )}
          {item.kind === 'tab_payment' && (
            <span
              className={clsx(
                'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                item.pending ? 'bg-amber-500/15 text-amber-300' : 'bg-neutral-800 text-neutral-400'
              )}
            >
              {item.pending ? 'Comanda aberta' : 'Comanda fechada'}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-neutral-500">{item.subtitle}</p>
        <p className="mt-1 text-[10px] text-neutral-600">
          {new Date(item.at).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <strong
          className={clsx(
            'text-sm font-bold',
            item.kind === 'movement' && item.outflow
              ? 'text-red-400'
              : item.kind === 'movement'
                ? 'text-brand-300'
                : 'text-brand-300'
          )}
        >
          {item.kind === 'movement' && item.outflow ? '-' : '+'}
          {formatCurrency(item.amount)}
        </strong>
        {item.kind === 'tab_payment' && (
          <button
            type="button"
            disabled={removingLinkId === item.id}
            onClick={() => setPendingLinkedRemoval({ type: 'payment', sessionId, paymentId: item.id })}
            className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2 py-1 text-[10px] font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            <Trash2 size={12} />
            Remover
          </button>
        )}
        {item.kind === 'sale' && (
          <button
            type="button"
            disabled={removingLinkId === item.id}
            onClick={() => setPendingLinkedRemoval({ type: 'sale', sessionId, saleId: item.id })}
            className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2 py-1 text-[10px] font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            <Trash2 size={12} />
            Remover
          </button>
        )}
      </div>
    </div>
  );

  const openRemoveModal = (session: Session) => {
    if (session.status === 'open') {
      showToast('Feche o caixa antes de removê-lo do histórico.', 'error');
      return;
    }
    if (session.operator_id !== operatorId) {
      showToast('Só é possível remover turnos do seu usuário.', 'error');
      return;
    }
    const block = voidBlockReason(session);
    if (block) {
      showToast(block, 'error');
      return;
    }
    setRemoveReason('');
    setRemoveTarget(session);
  };

  const movementSummary = useMemo(() => {
    if (!active) return { cashIn: 0, cashOut: 0 };
    return active.cash_movements.reduce(
      (acc, movement) => {
        if (movement.movement_type === 'cash_in') acc.cashIn += Number(movement.amount);
        else acc.cashOut += Number(movement.amount);
        return acc;
      },
      { cashIn: 0, cashOut: 0 }
    );
  }, [active]);

  const activeLinks = active ? sessionLinks(active) : null;
  const activeActivity = useMemo(() => (active ? buildActivity(active) : []), [active]);
  const activeVoidBlock = active ? voidBlockReason(active) : null;

  return (
    <PageContainer className="max-w-6xl">
      <PageHeader
        eyebrow="Operação de caixa"
        title="Caixa"
        description="Abertura, sangria, suprimento e fechamento com conferência por cédula."
        action={
          active ? (
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/pdv">
                <Button variant="primary" size="md" className="normal-case">
                  <Banknote size={16} />
                  Vendas e mesas
                </Button>
              </Link>
              <Button variant="secondary" size="md" onClick={() => setMovementModal(true)} className="normal-case">
                <MinusCircle size={16} />
                Movimentar
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => router.refresh()}
                className="normal-case"
              >
                <RefreshCw size={16} />
                Atualizar
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="md" onClick={() => setOpenModal(true)} className="normal-case">
              <LockKeyhole size={16} />
              Abrir caixa
            </Button>
          )
        }
      />

      {otherOpenSession && !active && (
        <Alert variant="warning" className="mt-4">
          Outro operador tem um caixa aberto em <strong>{otherOpenSession.terminal_name}</strong>. Abra o seu turno
          para registrar vendas no PDV.
        </Alert>
      )}

      {!active && (
        <Alert variant="info" className="mt-4">
          Vendas e pagamentos de comandas só funcionam com um caixa aberto no seu usuário.
        </Alert>
      )}

      <FloatingToast toast={toast} onClose={clearToast} />

      {!active ? (
        <Panel className="mt-6">
          <div className="flex flex-col items-center py-10 text-center sm:py-14">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-400/10 text-brand-300">
              <WalletCards size={28} />
            </div>
            <h2 className="mt-5 font-serif text-2xl font-bold text-ink">Nenhum caixa aberto</h2>
            <p className="mt-2 max-w-md text-sm text-neutral-500">
              Abra um turno para registrar vendas, sangrias e suprimentos do dia.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/admin">
                <Button variant="secondary" size="md" className="normal-case">
                  <ArrowLeft size={16} />
                  Voltar
                </Button>
              </Link>
              <Button variant="primary" size="md" onClick={() => setOpenModal(true)} className="normal-case">
                <LockKeyhole size={16} />
                Abrir caixa
              </Button>
            </div>
          </div>
        </Panel>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Terminal" value={active.terminal_name} tone="info" icon={<WalletCards size={18} />} />
            <StatCard
              label="Vendas fechadas"
              value={formatCurrency(activeLinks?.salesTotal ?? 0)}
              tone="success"
              icon={<Receipt size={18} />}
            />
            <StatCard
              label="Pagamentos pendentes"
              value={formatCurrency(activeLinks?.tabPaymentsTotal ?? 0)}
              tone="warning"
              icon={<Banknote size={18} />}
            />
            <StatCard
              label="Total contado"
              value={formatCurrency(countedTotal)}
              tone="default"
              icon={<ArrowDownToLine size={18} />}
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Panel
              eyebrow="Turno em operação"
              title={active.terminal_name}
              action={
                <span className="rounded-full bg-brand-400/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-300">
                  Aberto
                </span>
              }
            >
              <p className="text-sm text-neutral-500">
                Aberto em {new Date(active.opened_at).toLocaleString('pt-BR')} · Fundo{' '}
                {formatCurrency(active.opening_balance)}
                {(movementSummary.cashIn > 0 || movementSummary.cashOut > 0) && (
                  <>
                    {' '}
                    · Sangrias {formatCurrency(movementSummary.cashOut)} · Suprimentos{' '}
                    {formatCurrency(movementSummary.cashIn)}
                  </>
                )}
              </p>

              {activeVoidBlock && (
                <Alert variant="warning" className="mt-4">
                  <p>{activeVoidBlock}</p>
                  <p className="mt-2 text-xs text-neutral-400">
                    Remova vendas e pagamentos de teste na lista abaixo antes de cancelar o caixa.
                  </p>
                </Alert>
              )}

              <div className="mt-5 max-h-[min(44vh,380px)] divide-y divide-border overflow-y-auto overscroll-y-contain rounded-2xl border border-border bg-surface-elevated">
                {activeActivity.length ? (
                  activeActivity.map((item) => renderActivityRow(active.id, item))
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-neutral-500">
                    Nenhuma venda ou movimentação neste turno ainda.
                  </p>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="secondary" size="md" onClick={() => setMovementModal(true)} className="normal-case">
                  <MinusCircle size={16} />
                  Sangria ou suprimento
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setCancelModal(true)}
                  disabled={!!activeVoidBlock}
                  className="normal-case border-red-500/30 text-red-400 hover:border-red-500/50 hover:bg-red-500/10 disabled:opacity-40"
                >
                  <Trash2 size={16} />
                  Cancelar abertura
                </Button>
              </div>
            </Panel>

            <Panel
              eyebrow="Conferência por cédula"
              title="Contagem de notas"
              className="border-brand-400/30 bg-gradient-to-br from-brand-400/10 to-surface-elevated"
              bodyClassName="p-5"
            >
              <CashNoteCounter
                counts={counts}
                onCountChange={handleCountChange}
                closingNote={closingNote}
                onClosingNoteChange={setClosingNote}
                countedTotal={countedTotal}
                onSubmit={requestClose}
                submitting={closing}
              />
            </Panel>
          </div>
        </>
      )}

      <Panel title="Histórico de caixas" className="mt-6">
        <ListSearchBar
          value={historySearch}
          onChange={setHistorySearch}
          placeholder="Buscar terminal..."
          className="mb-4 max-w-md"
        />

        {visibleHistory.length ? (
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface-elevated">
            {visibleHistory.map((session) => (
              <div
                key={session.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{session.terminal_name}</p>
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                        session.status === 'open'
                          ? 'bg-brand-400/15 text-brand-300'
                          : 'bg-neutral-800 text-neutral-400'
                      )}
                    >
                      {session.status === 'open' ? 'Aberto' : 'Fechado'}
                    </span>
                    {session.operator_id === operatorId && (
                      <span className="rounded-full bg-brand-400/10 px-2 py-0.5 text-[10px] font-bold text-brand-300">
                        Seu turno
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {new Date(session.opened_at).toLocaleString('pt-BR')}
                    {session.status === 'closed' && session.expected_cash != null && (
                      <> · Esperado {formatCurrency(Number(session.expected_cash))}</>
                    )}
                    {(() => {
                      const links = sessionLinks(session);
                      if (!links.hasLinks) return null;
                      const bits: string[] = [];
                      if (links.sales.length) bits.push(`${links.sales.length} venda${links.sales.length > 1 ? 's' : ''}`);
                      if (links.tabPayments.length) {
                        bits.push(`${links.tabPayments.length} pag. comanda`);
                      }
                      if (links.movements.length) bits.push(`${links.movements.length} mov.`);
                      return <> · {bits.join(' · ')}</>;
                    })()}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const links = sessionLinks(session);
                    if (!links.hasLinks || session.status !== 'closed') return null;
                    return (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setManageSession(session)}
                        className="normal-case border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                      >
                        Corrigir lançamentos
                      </Button>
                    );
                  })()}
                  <button
                    type="button"
                    disabled={session.status === 'open' || session.operator_id !== operatorId}
                    onClick={() => openRemoveModal(session)}
                    title={
                      session.operator_id !== operatorId
                        ? 'Somente o operador do turno pode remover'
                        : 'Remover do histórico'
                    }
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-red-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 size={16} />
                  </button>
                  {session.status === 'closed' && (
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Diferença</p>
                      <p
                        className={clsx(
                          'font-serif text-lg font-bold',
                          Number(session.difference) === 0
                            ? 'text-brand-300'
                            : Number(session.difference) > 0
                              ? 'text-brand-300'
                              : 'text-red-400'
                        )}
                      >
                        {formatCurrency(Number(session.difference))}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message={normalizedHistorySearch ? 'Nenhum caixa encontrado.' : 'Nenhum turno registrado ainda.'} />
        )}

        <ShowMoreToggle
          hiddenCount={hiddenHistoryCount}
          showingAll={showAllHistory || !!normalizedHistorySearch}
          onToggle={() => setShowAllHistory((value) => !value)}
          className="mt-3"
        />
      </Panel>

      {openModal && (
        <Modal
          onClose={() => setOpenModal(false)}
          title="Abrir caixa"
          subtitle="Novo turno"
          description="Informe o terminal e o fundo de troco inicial."
          size="lg"
          variant="center"
          motionPreset="fade"
          footer={
            <ModalFooter>
              <Button variant="secondary" size="md" onClick={() => setOpenModal(false)} className="normal-case">
                Cancelar
              </Button>
              <Button variant="primary" size="md" type="submit" form="open-cash-form" disabled={opening} className="normal-case">
                <LockKeyhole size={16} />
                {opening ? 'Abrindo...' : 'Abrir caixa'}
              </Button>
            </ModalFooter>
          }
        >
          <form id="open-cash-form" onSubmit={open} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldGroup label="Terminal">
                <Input value={terminal} onChange={(event) => setTerminal(event.target.value)} />
              </FieldGroup>
              <FieldGroup label="Fundo de troco (R$)">
                <Input
                  value={openingBalance}
                  onChange={(event) => setOpeningBalance(event.target.value)}
                  inputMode="decimal"
                />
              </FieldGroup>
            </div>
          </form>
        </Modal>
      )}

      {movementModal && active && (
        <Modal
          onClose={() => setMovementModal(false)}
          title="Movimentar dinheiro"
          subtitle={active.terminal_name}
          description="Registre sangria (saída) ou suprimento (entrada) de numerário."
          size="lg"
          variant="center"
          motionPreset="fade"
          footer={
            <ModalFooter>
              <Button variant="secondary" size="md" onClick={() => setMovementModal(false)} className="normal-case">
                Cancelar
              </Button>
              <Button variant="primary" size="md" type="submit" form="movement-form" className="normal-case">
                {movementType === 'cash_out' ? <MinusCircle size={16} /> : <PlusCircle size={16} />}
                Registrar
              </Button>
            </ModalFooter>
          }
        >
          <form id="movement-form" onSubmit={registerMovement} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldGroup label="Tipo">
                <Select
                  value={movementType}
                  onChange={(event) => setMovementType(event.target.value as 'cash_in' | 'cash_out')}
                >
                  <option value="cash_out">Sangria</option>
                  <option value="cash_in">Suprimento</option>
                </Select>
              </FieldGroup>
              <FieldGroup label="Valor (R$)">
                <Input
                  value={movementAmount}
                  onChange={(event) => setMovementAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                />
              </FieldGroup>
            </div>
            <FieldGroup label="Motivo">
              <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Descreva o motivo" />
            </FieldGroup>
          </form>
        </Modal>
      )}

      {removeTarget && (
        <Modal
          onClose={() => setRemoveTarget(null)}
          title="Remover do histórico"
          description={`O turno "${removeTarget.terminal_name}" será ocultado, mas permanece no log de auditoria.`}
          size="md"
          variant="center"
          motionPreset="fade"
          footer={
            <ModalFooter>
              <Button variant="secondary" size="md" onClick={() => setRemoveTarget(null)} className="normal-case">
                Cancelar
              </Button>
              <Button variant="primary" size="md" type="submit" form="remove-form" className="normal-case">
                Confirmar remoção
              </Button>
            </ModalFooter>
          }
        >
          <form id="remove-form" onSubmit={removeFromHistory}>
            <FieldGroup label="Motivo da correção">
              <Textarea
                value={removeReason}
                onChange={(event) => setRemoveReason(event.target.value)}
                placeholder="Descreva o motivo..."
                rows={3}
                required
              />
            </FieldGroup>
          </form>
        </Modal>
      )}

      {cancelModal && active && (
        <Modal
          onClose={() => setCancelModal(false)}
          title="Cancelar abertura"
          size="md"
          variant="center"
          motionPreset="fade"
          footer={
            <ModalFooter>
              <Button variant="secondary" size="md" onClick={() => setCancelModal(false)} className="normal-case">
                Voltar
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={cancelAccidentalOpening}
                disabled={!!activeVoidBlock}
                className="normal-case border-red-500/30 text-red-400 hover:border-red-500/50 hover:bg-red-500/10 disabled:opacity-40"
              >
                Cancelar abertura
              </Button>
            </ModalFooter>
          }
        >
          <ModalAlert variant="warning">
            {activeVoidBlock ? (
              <>
                <p>{activeVoidBlock}</p>
                <p className="mt-2 text-xs text-neutral-400">
                  Remova os lançamentos de teste na lista do turno antes de cancelar a abertura.
                </p>
              </>
            ) : (
              <>
                O caixa <strong>{active.terminal_name}</strong> será fechado e removido. Use apenas se a abertura foi
                feita por engano e ainda não houve vendas ou movimentações.
              </>
            )}
          </ModalAlert>
        </Modal>
      )}

      {closeConfirmModal && active && (
        <Modal
          onClose={() => setCloseConfirmModal(false)}
          title="Confirmar fechamento"
          subtitle={active.terminal_name}
          description="Revise o total contado antes de encerrar o turno."
          size="md"
          variant="center"
          motionPreset="fade"
          footer={
            <ModalFooter>
              <Button variant="secondary" size="md" onClick={() => setCloseConfirmModal(false)} className="normal-case">
                Voltar
              </Button>
              <Button variant="primary" size="md" onClick={confirmClose} disabled={closing} className="normal-case">
                {closing ? 'Fechando...' : 'Confirmar fechamento'}
              </Button>
            </ModalFooter>
          }
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-brand-400/30 bg-brand-400/10 px-4 py-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wide text-brand-300">Total contado</p>
              <p className="mt-1 font-serif text-3xl font-bold text-brand-300">{formatCurrency(countedTotal)}</p>
            </div>
            <p className="text-sm text-neutral-500">
              O sistema calculará o valor esperado com base nas vendas em dinheiro, sangrias e suprimentos do turno.
            </p>
          </div>
        </Modal>
      )}

      {manageSession && (
        <Modal
          onClose={() => setManageSession(null)}
          title="Corrigir lançamentos"
          subtitle={manageSession.terminal_name}
          description="Remova vendas ou pagamentos de teste vinculados a este turno."
          size="lg"
          variant="center"
          motionPreset="fade"
          footer={
            <ModalFooter>
              <Button variant="secondary" size="md" onClick={() => setManageSession(null)} className="normal-case">
                Fechar
              </Button>
            </ModalFooter>
          }
        >
          <div className="max-h-[min(50vh,420px)] divide-y divide-border overflow-y-auto overscroll-y-contain rounded-2xl border border-border bg-surface-elevated">
            {buildActivity(manageSession).filter((item) => item.kind !== 'movement').length ? (
              buildActivity(manageSession)
                .filter((item) => item.kind !== 'movement')
                .map((item) => renderActivityRow(manageSession.id, item))
            ) : (
              <p className="px-4 py-8 text-center text-sm text-neutral-500">Nenhum lançamento para corrigir.</p>
            )}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={pendingLinkedRemoval !== null}
        title={pendingLinkedRemoval?.type === 'sale' ? 'Remover venda' : 'Remover pagamento'}
        description={
          pendingLinkedRemoval?.type === 'sale'
            ? 'Remover esta venda? Use apenas para corrigir testes.'
            : 'Remover este pagamento de comanda?'
        }
        confirmLabel="Remover"
        destructive
        onCancel={() => setPendingLinkedRemoval(null)}
        onConfirm={() => {
          if (pendingLinkedRemoval?.type === 'payment') {
            void removeLinkedTabPayment(pendingLinkedRemoval.sessionId, pendingLinkedRemoval.paymentId);
          } else if (pendingLinkedRemoval?.type === 'sale') {
            void removeLinkedSale(pendingLinkedRemoval.sessionId, pendingLinkedRemoval.saleId);
          }
          setPendingLinkedRemoval(null);
        }}
      />
    </PageContainer>
  );
}
