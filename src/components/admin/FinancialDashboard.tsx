'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, CircleDollarSign, PackageSearch, Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { CollapsibleSection, ShowMoreToggle, useLimitedList } from '@/components/ui/collapsible-list';
import { PageContainer, PageHeader, Panel, ProgressBar, StatCard } from '@/components/ui/page-layout';

interface Props {
  sales: { total_amount: number; net_profit: number; occurred_at: string }[];
  expenses: { amount: number; paid_at: string | null; due_date: string }[];
  receivables: { amount: number; due_date: string; received_at: string | null }[];
  lowStock: { id: string; name: string; stock_quantity: number }[];
  goals: { goal_type: string; amount: number }[];
}

function LowStockList({ items }: { items: { id: string; name: string; stock_quantity: number }[] }) {
  const { visible, showAll, hiddenCount, toggle } = useLimitedList(items, 5);

  if (!items.length) {
    return <p className="py-2 text-sm text-neutral-500">Estoque em ordem.</p>;
  }

  return (
    <div className="space-y-0 divide-y divide-border">
      {visible.map((product) => (
        <div key={product.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <span className="min-w-0 truncate text-sm font-semibold text-ink">{product.name}</span>
          <span className="shrink-0 rounded-lg bg-red-500/10 px-2 py-1 text-xs font-bold text-red-400">
            {product.stock_quantity} un.
          </span>
        </div>
      ))}
      <ShowMoreToggle hiddenCount={hiddenCount} showingAll={showAll} onToggle={toggle} className="mt-2" />
    </div>
  );
}

export function FinancialDashboard({ sales, expenses, receivables, lowStock, goals }: Props) {
  const month = new Date().getMonth();
  const year = new Date().getFullYear();

  const currentSales = sales.filter((sale) => {
    const date = new Date(sale.occurred_at);
    return date.getMonth() === month && date.getFullYear() === year;
  });

  const currentExpenses = expenses.filter((expense) => {
    if (!expense.paid_at) return false;
    const date = new Date(expense.paid_at);
    return date.getMonth() === month && date.getFullYear() === year;
  });

  const revenue = currentSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
  const netProfit =
    currentSales.reduce((sum, sale) => sum + Number(sale.net_profit), 0) -
    currentExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const pending = receivables.filter((item) => !item.received_at).reduce((sum, item) => sum + Number(item.amount), 0);

  const byDay = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - index));
    const key = day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const daySales = sales.filter((sale) => new Date(sale.occurred_at).toDateString() === day.toDateString());
    return {
      day: key,
      faturamento: daySales.reduce((sum, sale) => sum + Number(sale.total_amount), 0),
      lucro: daySales.reduce((sum, sale) => sum + Number(sale.net_profit), 0),
    };
  });

  const profitGoal = goals.find((goal) => goal.goal_type === 'profit')?.amount || 0;
  const revenueGoal = goals.find((goal) => goal.goal_type === 'revenue')?.amount || 0;

  const cards: {
    label: string;
    value: number;
    icon: React.ReactNode;
    tone: 'default' | 'success' | 'warning' | 'danger' | 'info';
  }[] = [
    { label: 'Faturamento do mês', value: revenue, icon: <ArrowUpRight size={18} />, tone: 'info' },
    {
      label: 'Lucro real do mês',
      value: netProfit,
      icon: <CircleDollarSign size={18} />,
      tone: netProfit >= 0 ? 'success' : 'danger',
    },
    { label: 'A receber', value: pending, icon: <ArrowDownRight size={18} />, tone: 'warning' },
  ];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Visão financeira"
        title="O que realmente ficou"
        description="Faturamento menos custos, taxas, impostos e despesas."
        action={
          <Link href="/admin/pdv">
            <Button variant="primary" size="lg">
              <Plus size={16} />
              Abrir mesa
            </Button>
          </Link>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={formatCurrency(card.value)}
            icon={card.icon}
            tone={card.tone}
          />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <Panel eyebrow="Últimos 7 dias" title="Faturamento x lucro real">
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDay} barGap={4}>
                <CartesianGrid vertical={false} stroke="#2a2a2a" strokeDasharray="3 3" />
                <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: '#6b7280' }} />
                <YAxis hide />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #2a2a2a',
                    background: '#141414',
                    color: '#f5f5f5',
                  }}
                />
                <Bar dataKey="faturamento" fill="#dfc574" radius={[6, 6, 0, 0]} maxBarSize={32} />
                <Bar dataKey="lucro" fill="#d4af37" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <CollapsibleSection
          title="Precisa repor"
          subtitle="Estoque baixo"
          count={lowStock.length}
          defaultOpen={lowStock.length > 0 && lowStock.length <= 5}
        >
          <LowStockList items={lowStock} />
          <Link
            href="/admin/estoque"
            className="mt-4 inline-flex items-center gap-2 rounded-lg text-xs font-bold uppercase tracking-wide text-brand-300 transition-colors hover:text-brand-200"
          >
            <PackageSearch size={15} />
            Ver produtos
          </Link>
        </CollapsibleSection>
      </div>

      <Panel className="mt-6 bg-gradient-to-br from-brand-400/10 to-surface-elevated" noPadding>
        <div className="grid gap-6 p-5 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Meta de faturamento</p>
            <p className="mt-2 font-serif text-2xl font-bold text-ink">
              {formatCurrency(revenue)}{' '}
              <span className="text-base font-normal text-neutral-500">de {formatCurrency(revenueGoal)}</span>
            </p>
            <div className="mt-4">
              <ProgressBar value={revenueGoal ? (revenue / revenueGoal) * 100 : 0} tone="sky" />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Meta de lucro real</p>
            <p className="mt-2 font-serif text-2xl font-bold text-ink">
              {formatCurrency(netProfit)}{' '}
              <span className="text-base font-normal text-neutral-500">de {formatCurrency(profitGoal)}</span>
            </p>
            <div className="mt-4">
              <ProgressBar value={profitGoal ? (Math.max(0, netProfit) / profitGoal) * 100 : 0} tone="brand" />
            </div>
          </div>
        </div>
      </Panel>
    </PageContainer>
  );
}
