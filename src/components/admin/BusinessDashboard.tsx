'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/format';

type TransactionKind = 'sale' | 'expense' | 'debt_payment';

interface Transaction {
  id: string;
  kind: TransactionKind;
  status: 'paid' | 'pending';
  description: string;
  amount: number;
  occurred_at: string;
}

interface Props {
  storeId: string;
  transactions: Transaction[];
  debtTotal: number;
  lowStockProducts: { id: string; name: string; stock_quantity: number; reorder_level: number }[];
}

const labels: Record<TransactionKind, string> = {
  sale: 'Venda',
  expense: 'Despesa',
  debt_payment: 'Recebimento de fiado',
};

export function BusinessDashboard({ storeId, transactions, debtTotal, lowStockProducts }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<TransactionKind>('sale');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toDateString();
  const todayTransactions = transactions.filter((transaction) => new Date(transaction.occurred_at).toDateString() === today);
  const salesToday = todayTransactions.filter((transaction) => transaction.kind === 'sale' && transaction.status === 'paid').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const expensesToday = todayTransactions.filter((transaction) => transaction.kind === 'expense').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const cashToday = salesToday - expensesToday;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = Number(amount.replace(',', '.'));
    if (!description.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Informe uma descricao e um valor maior que zero.');
      return;
    }

    setIsSaving(true);
    setError(null);
    const { error: insertError } = await createClient().from('financial_transactions').insert({
      store_id: storeId,
      kind,
      status: 'paid',
      description: description.trim(),
      amount: parsedAmount,
    });
    setIsSaving(false);

    if (insertError) {
      setError('Nao foi possivel registrar. Confirme se a migracao foi executada e se voce tem permissao.');
      return;
    }

    setDescription('');
    setAmount('');
    router.refresh();
  };

  const metrics = [
    { label: 'Entradas hoje', value: formatCurrency(salesToday), tone: 'text-brand-300' },
    { label: 'Saidas hoje', value: formatCurrency(expensesToday), tone: 'text-red-400' },
    { label: 'Caixa do dia', value: formatCurrency(cashToday), tone: 'text-ink' },
    { label: 'Fiado em aberto', value: formatCurrency(debtTotal), tone: 'text-amber-400' },
  ];

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-300">Controle do negocio</p>
          <h1 className="mt-2 font-serif text-3xl font-bold leading-none text-ink">Seu dia em numeros</h1>
        </div>
        <p className="text-sm text-neutral-500">Registre o movimento e acompanhe o caixa em tempo real.</p>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-surface-elevated p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">{metric.label}</p>
            <p className={`mt-3 font-serif text-2xl font-bold leading-none sm:text-3xl ${metric.tone}`}>{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_0.9fr]">
        <section className="border border-border bg-surface-elevated p-5 sm:p-6">
          <div className="mb-5 flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-300">Lancamento rapido</p>
              <h2 className="mt-1 font-serif text-xl font-bold">O que aconteceu agora?</h2>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-[1fr_9rem_auto]">
            <select value={kind} onChange={(event) => setKind(event.target.value as TransactionKind)} className="border border-border bg-surface-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-500">
              <option value="sale">Venda recebida</option>
              <option value="expense">Despesa paga</option>
              <option value="debt_payment">Recebimento de fiado</option>
            </select>
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descricao" className="border border-border bg-surface-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
            <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="R$ 0,00" className="border border-border bg-surface-elevated px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
            <button disabled={isSaving} className="border border-brand-500 bg-brand-400 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-neutral-950 transition-colors hover:bg-brand-300 disabled:opacity-50 sm:col-start-3">
              {isSaving ? 'Salvando...' : 'Registrar'}
            </button>
          </form>
          {error && <p className="mt-3 text-xs font-medium text-red-400">{error}</p>}
        </section>

        <section className="border border-border bg-surface-elevated p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-300">Estoque pede atencao</p>
          <h2 className="mt-1 font-serif text-xl font-bold">Itens para repor</h2>
          <div className="mt-4 divide-y divide-border">
            {lowStockProducts.length === 0 ? <p className="py-3 text-sm text-neutral-500">Nenhum alerta de estoque agora.</p> : lowStockProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-4 py-3">
                <p className="min-w-0 truncate text-sm font-semibold text-ink">{product.name}</p>
                <span className="shrink-0 text-xs font-bold text-red-400">{product.stock_quantity} un.</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 border border-border bg-surface-elevated">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-300">Movimentacoes</p>
            <h2 className="mt-1 font-serif text-xl font-bold">Ultimos registros</h2>
          </div>
        </div>
        <div className="divide-y divide-border">
          {transactions.length === 0 ? <p className="p-6 text-sm text-neutral-500">Comece registrando sua primeira venda ou despesa.</p> : transactions.slice(0, 7).map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{transaction.description}</p>
                <p className="mt-1 text-xs text-neutral-500">{labels[transaction.kind]} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(transaction.occurred_at))}</p>
              </div>
              <p className={`shrink-0 font-serif text-lg font-bold ${transaction.kind === 'expense' ? 'text-red-400' : 'text-brand-300'}`}>{transaction.kind === 'expense' ? '-' : '+'}{formatCurrency(Number(transaction.amount))}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}