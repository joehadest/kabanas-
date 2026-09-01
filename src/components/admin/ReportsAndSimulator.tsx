'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Calculator,
  CircleDollarSign,
  Download,
  FileText,
  Percent,
  Receipt,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency, parseDecimal } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { FloatingToast, useFloatingToast } from '@/components/ui/floating-toast';
import { FieldGroup, Input } from '@/components/ui/input';
import { ShowMoreToggle, useLimitedList } from '@/components/ui/collapsible-list';
import { EmptyState, PageContainer, PageHeader, Panel, StatCard } from '@/components/ui/page-layout';
import { cn } from '@/lib/utils';

type Period = '7d' | '30d' | 'month' | 'year' | 'all';

interface Sale {
  id?: string;
  total_amount: number;
  total_cost: number;
  payment_fee: number;
  tax_amount: number;
  net_profit: number;
  occurred_at: string;
}

interface Expense {
  description: string;
  amount: number;
  paid_at: string | null;
  due_date: string;
  expense_categories: { name: string } | { name: string }[] | null;
}

interface PaymentMethod {
  name: string;
  fee_rate: number;
}

interface Props {
  sales: Sale[];
  expenses: Expense[];
  payments: PaymentMethod[];
  defaultTaxRate?: number;
}

const PERIOD_OPTIONS: { id: Period; label: string }[] = [
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'month', label: 'Este mês' },
  { id: 'year', label: 'Este ano' },
  { id: 'all', label: 'Tudo' },
];

const CHART_COLORS = ['#d4af37', '#c19b2e', '#a37f24', '#85661d', '#6b5218'];

function categoryName(expense: Expense): string {
  if (Array.isArray(expense.expense_categories)) {
    return expense.expense_categories[0]?.name || 'Sem categoria';
  }
  return expense.expense_categories?.name || 'Sem categoria';
}

function expenseDate(expense: Expense): Date {
  return new Date(expense.paid_at || `${expense.due_date}T12:00:00`);
}

function periodStart(period: Period): Date | null {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case '7d':
      start.setDate(now.getDate() - 6);
      return start;
    case '30d':
      start.setDate(now.getDate() - 29);
      return start;
    case 'month':
      start.setDate(1);
      return start;
    case 'year':
      start.setMonth(0, 1);
      return start;
    default:
      return null;
  }
}

function filterByPeriod<T>(items: T[], getDate: (item: T) => Date, period: Period): T[] {
  const start = periodStart(period);
  if (!start) return items;
  return items.filter((item) => getDate(item) >= start);
}

function filterPaidExpensesInPeriod(expenses: Expense[], period: Period): Expense[] {
  const start = periodStart(period);
  return expenses.filter((expense) => {
    if (!expense.paid_at) return false;
    const paid = new Date(expense.paid_at);
    return !start || paid >= start;
  });
}

function periodLabel(period: Period): string {
  return PERIOD_OPTIONS.find((option) => option.id === period)?.label ?? 'Período';
}

function DreRow({
  label,
  value,
  tone = 'default',
  highlight,
}: {
  label: string;
  value: number;
  tone?: 'default' | 'negative' | 'positive';
  highlight?: boolean;
}) {
  const valueClass =
    tone === 'negative' ? 'text-red-400' : tone === 'positive' ? 'text-brand-300' : 'text-ink';

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 py-2.5 text-sm',
        highlight && 'border-t border-border pt-4 font-serif text-lg font-bold'
      )}
    >
      <span className={highlight ? 'text-ink' : 'text-neutral-400'}>{label}</span>
      <strong className={valueClass}>{formatCurrency(value)}</strong>
    </div>
  );
}

function exportReportCsv(params: {
  period: Period;
  sales: Sale[];
  expenses: Expense[];
  dre: {
    revenue: number;
    productCosts: number;
    paymentFees: number;
    taxes: number;
    salesProfit: number;
    operationalExpenses: number;
    netProfit: number;
  };
}) {
  const { period, sales, expenses, dre } = params;
  const lines = [
    'Relatório financeiro Kabanas',
    `Período,${periodLabel(period)}`,
    `Gerado em,${new Date().toLocaleString('pt-BR')}`,
    '',
    'DRE simplificada',
    'Receita bruta,' + dre.revenue,
    'Custos de produtos,' + dre.productCosts,
    'Taxas de pagamento,' + dre.paymentFees,
    'Impostos,' + dre.taxes,
    'Lucro das vendas,' + dre.salesProfit,
    'Despesas operacionais,' + dre.operationalExpenses,
    'Lucro líquido,' + dre.netProfit,
    '',
    'Vendas',
    'Data,Receita,Custo,Taxa pagamento,Imposto,Lucro',
    ...sales.map(
      (sale) =>
        `${new Date(sale.occurred_at).toLocaleDateString('pt-BR')},${sale.total_amount},${sale.total_cost},${sale.payment_fee},${sale.tax_amount},${sale.net_profit}`
    ),
    '',
    'Despesas',
    'Data,Descrição,Categoria,Valor',
    ...expenses.map(
      (expense) =>
        `${expenseDate(expense).toLocaleDateString('pt-BR')},"${expense.description.replace(/"/g, '""')}","${categoryName(expense)}",${expense.amount}`
    ),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorio-kabanas-${period}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsAndSimulator({ sales, expenses, payments, defaultTaxRate = 0 }: Props) {
  const { toast, showToast, clearToast } = useFloatingToast();
  const [period, setPeriod] = useState<Period>('30d');
  const [price, setPrice] = useState('100');
  const [cost, setCost] = useState('40');
  const [tax, setTax] = useState(String(defaultTaxRate || 6));
  const [fee, setFee] = useState(payments[0]?.fee_rate.toString() || '0');

  const filteredSales = useMemo(
    () => filterByPeriod(sales, (sale) => new Date(sale.occurred_at), period),
    [sales, period]
  );

  const filteredExpenses = useMemo(
    () => filterByPeriod(expenses, expenseDate, period),
    [expenses, period]
  );

  const paidExpenses = useMemo(
    () => filterPaidExpensesInPeriod(expenses, period),
    [expenses, period]
  );

  const metrics = useMemo(() => {
    const revenue = filteredSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
    const productCosts = filteredSales.reduce((sum, sale) => sum + Number(sale.total_cost), 0);
    const paymentFees = filteredSales.reduce((sum, sale) => sum + Number(sale.payment_fee), 0);
    const taxes = filteredSales.reduce((sum, sale) => sum + Number(sale.tax_amount), 0);
    const salesProfit = filteredSales.reduce((sum, sale) => sum + Number(sale.net_profit), 0);
    const operationalExpenses = paidExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    const netProfit = salesProfit - operationalExpenses;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      revenue,
      productCosts,
      paymentFees,
      taxes,
      salesProfit,
      operationalExpenses,
      netProfit,
      margin,
      salesCount: filteredSales.length,
    };
  }, [filteredSales, paidExpenses]);

  const chartData = useMemo(() => {
    if (!filteredSales.length) return [];

    if (period === 'year' || period === 'all') {
      const buckets = new Map<string, { label: string; faturamento: number; lucro: number }>();
      for (const sale of filteredSales) {
        const date = new Date(sale.occurred_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const label = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const current = buckets.get(key) ?? { label, faturamento: 0, lucro: 0 };
        current.faturamento += Number(sale.total_amount);
        current.lucro += Number(sale.net_profit);
        buckets.set(key, current);
      }
      return Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, value]) => value);
    }

    const days = period === '7d' ? 7 : period === '30d' ? 30 : new Date().getDate();
    const start = periodStart(period === 'month' ? 'month' : period) ?? new Date();

    return Array.from({ length: days }, (_, index) => {
      const day = new Date(start);
      if (period !== 'month') {
        day.setDate(start.getDate() + index);
      } else {
        day.setDate(index + 1);
      }
      const key = day.toDateString();
      const daySales = filteredSales.filter((sale) => new Date(sale.occurred_at).toDateString() === key);
      return {
        label: day.toLocaleDateString('pt-BR', { day: '2-digit', month: period === '7d' ? '2-digit' : 'short' }),
        faturamento: daySales.reduce((sum, sale) => sum + Number(sale.total_amount), 0),
        lucro: daySales.reduce((sum, sale) => sum + Number(sale.net_profit), 0),
      };
    });
  }, [filteredSales, period]);

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const expense of paidExpenses) {
      const name = categoryName(expense);
      map.set(name, (map.get(name) ?? 0) + Number(expense.amount));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [paidExpenses]);

  const recentSales = useMemo(
    () =>
      [...filteredSales]
        .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
        .slice(0, 20),
    [filteredSales]
  );

  const recentSalesList = useLimitedList(recentSales, 6);
  const expensesList = useLimitedList(
    [...filteredExpenses].sort((a, b) => expenseDate(b).getTime() - expenseDate(a).getTime()),
    6
  );

  const salePrice = Number.isFinite(parseDecimal(price)) ? parseDecimal(price) : 0;
  const saleCost = Number.isFinite(parseDecimal(cost)) ? parseDecimal(cost) : 0;
  const saleTax = Number.isFinite(parseDecimal(tax)) ? parseDecimal(tax) : 0;
  const saleFee = Number.isFinite(parseDecimal(fee)) ? parseDecimal(fee) : 0;
  const simulatedProfit = salePrice - saleCost - salePrice * ((saleTax + saleFee) / 100);
  const simulatedMargin = salePrice > 0 ? (simulatedProfit / salePrice) * 100 : 0;

  const paymentComparison = payments.map((payment) => {
    const profit = salePrice - saleCost - salePrice * ((saleTax + payment.fee_rate) / 100);
    return {
      ...payment,
      profit,
      margin: salePrice > 0 ? (profit / salePrice) * 100 : 0,
    };
  });

  const bestPayment = paymentComparison.reduce(
    (best, current) => (current.profit > best.profit ? current : best),
    paymentComparison[0] ?? { name: '-', fee_rate: 0, profit: 0, margin: 0 }
  );

  const hasData = filteredSales.length > 0 || filteredExpenses.length > 0 || paidExpenses.length > 0;

  const handleExportCsv = () => {
    exportReportCsv({
      period,
      sales: filteredSales,
      expenses: paidExpenses,
      dre: metrics,
    });
    showToast('Relatório exportado.', 'success');
  };

  return (
    <PageContainer className="max-w-7xl print:max-w-none">
      <PageHeader
        eyebrow="Análises"
        title="Relatórios e simulador"
        description="DRE do período, evolução de faturamento e simulação de margem por forma de pagamento."
        action={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" size="md" onClick={handleExportCsv}>
              <Download size={16} />
              Exportar CSV
            </Button>
            <Button variant="primary" size="md" onClick={() => window.print()}>
              <FileText size={16} />
              Imprimir
            </Button>
          </div>
        }
      />

      <div className="mt-6 flex flex-wrap gap-2 print:hidden">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setPeriod(option.id)}
            className={cn(
              'rounded-xl border px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition-colors',
              period === option.id
                ? 'border-brand-400 bg-brand-400/10 text-brand-300'
                : 'border-border text-neutral-400 hover:border-brand-400/40 hover:text-neutral-200'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {!hasData ? (
        <Panel className="mt-8">
          <EmptyState
            message={`Nenhuma venda ou despesa encontrada em ${periodLabel(period).toLowerCase()}.`}
            action={{ label: 'Abrir mesa', href: '/admin/pdv' }}
          />
        </Panel>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Receita bruta"
              value={formatCurrency(metrics.revenue)}
              icon={<TrendingUp size={18} />}
              tone="info"
            />
            <StatCard
              label="Lucro das vendas"
              value={formatCurrency(metrics.salesProfit)}
              icon={<CircleDollarSign size={18} />}
              tone={metrics.salesProfit >= 0 ? 'success' : 'danger'}
            />
            <StatCard
              label="Despesas"
              value={formatCurrency(metrics.operationalExpenses)}
              icon={<TrendingDown size={18} />}
              tone="warning"
            />
            <StatCard
              label="Lucro líquido"
              value={formatCurrency(metrics.netProfit)}
              icon={<Receipt size={18} />}
              tone={metrics.netProfit >= 0 ? 'success' : 'danger'}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-neutral-500 print:text-neutral-700">
            <span>{metrics.salesCount} vendas no período</span>
            <span>·</span>
            <span>{paidExpenses.length} despesas pagas</span>
            <span>·</span>
            <span className={metrics.margin >= 0 ? 'text-brand-300' : 'text-red-400'}>
              Margem líquida: {metrics.margin.toFixed(1)}%
            </span>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            <Panel eyebrow="Evolução" title={`Faturamento x lucro · ${periodLabel(period)}`}>
              <div className="h-72 w-full min-w-0">
                {chartData.some((point) => point.faturamento > 0 || point.lucro > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={4}>
                      <CartesianGrid vertical={false} stroke="#2a2a2a" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#737373' }}
                        interval={period === '30d' || period === 'month' ? 'preserveStartEnd' : 0}
                      />
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
                      <Bar dataKey="faturamento" name="Faturamento" fill="#dfc574" radius={[6, 6, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="lucro" name="Lucro" fill="#d4af37" radius={[6, 6, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="Sem movimentação para exibir no gráfico." />
                )}
              </div>
            </Panel>

            <Panel eyebrow="DRE" title="Resultado do período">
              <div className="space-y-0 divide-y divide-border/60">
                <DreRow label="Receita bruta" value={metrics.revenue} />
                <DreRow label="(-) Custos de produtos" value={metrics.productCosts} tone="negative" />
                <DreRow label="(-) Taxas de pagamento" value={metrics.paymentFees} tone="negative" />
                <DreRow label="(-) Impostos" value={metrics.taxes} tone="negative" />
                <DreRow label="Lucro das vendas" value={metrics.salesProfit} tone="positive" />
                <DreRow label="(-) Despesas operacionais (pagas)" value={metrics.operationalExpenses} tone="negative" />
                <DreRow
                  label="Lucro líquido"
                  value={metrics.netProfit}
                  tone={metrics.netProfit >= 0 ? 'positive' : 'negative'}
                  highlight
                />
              </div>
              <div className="mt-5 rounded-xl border border-border bg-black/30 p-4">
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>Margem sobre receita</span>
                  <span className={metrics.margin >= 0 ? 'font-bold text-brand-300' : 'font-bold text-red-400'}>
                    {metrics.margin.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className={cn('h-full rounded-full', metrics.margin >= 0 ? 'bg-brand-400' : 'bg-red-500')}
                    style={{ width: `${Math.min(100, Math.abs(metrics.margin))}%` }}
                  />
                </div>
              </div>
            </Panel>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Panel eyebrow="Despesas" title="Por categoria" noPadding>
              {expensesByCategory.length ? (
                <div className="grid gap-5 p-5 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expensesByCategory}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={52}
                          outerRadius={78}
                          paddingAngle={2}
                        >
                          {expensesByCategory.map((entry, index) => (
                            <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => formatCurrency(Number(value))}
                          contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid #2a2a2a',
                            background: '#141414',
                            color: '#f5f5f5',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {expensesByCategory.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                          />
                          <span className="truncate text-neutral-300">{item.name}</span>
                        </div>
                        <strong className="shrink-0 text-red-400">{formatCurrency(item.value)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState message="Nenhuma despesa no período." />
              )}
            </Panel>

            <Panel eyebrow="Movimentação" title="Despesas do período" noPadding>
              {filteredExpenses.length ? (
                <>
                  <div className="divide-y divide-border">
                    {expensesList.visible.map((expense, index) => (
                      <div key={`${expense.description}-${index}`} className="flex items-center justify-between gap-4 px-5 py-3.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{expense.description}</p>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {categoryName(expense)} · {expenseDate(expense).toLocaleDateString('pt-BR')}
                            {!expense.paid_at && ' · pendente'}
                          </p>
                        </div>
                        <strong className="shrink-0 text-sm text-red-400">{formatCurrency(expense.amount)}</strong>
                      </div>
                    ))}
                  </div>
                  <ShowMoreToggle
                    hiddenCount={expensesList.hiddenCount}
                    showingAll={expensesList.showAll}
                    onToggle={expensesList.toggle}
                    className="mx-5 mb-4"
                  />
                </>
              ) : (
                <EmptyState message="Nenhuma despesa no período." />
              )}
            </Panel>
          </div>

          <Panel className="mt-6" eyebrow="Vendas" title="Últimas vendas do período" noPadding>
            {recentSales.length ? (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        <th className="px-5 py-3">Data</th>
                        <th className="px-5 py-3">Receita</th>
                        <th className="px-5 py-3">Custos</th>
                        <th className="px-5 py-3">Lucro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {recentSalesList.visible.map((sale, index) => (
                        <tr key={sale.id ?? `${sale.occurred_at}-${index}`} className="hover:bg-white/[0.03]">
                          <td className="px-5 py-3 text-neutral-300">
                            {new Date(sale.occurred_at).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-5 py-3 font-medium text-ink">{formatCurrency(sale.total_amount)}</td>
                          <td className="px-5 py-3 text-red-400">
                            {formatCurrency(Number(sale.total_cost) + Number(sale.payment_fee) + Number(sale.tax_amount))}
                          </td>
                          <td className={cn('px-5 py-3 font-semibold', sale.net_profit >= 0 ? 'text-brand-300' : 'text-red-400')}>
                            {formatCurrency(sale.net_profit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ShowMoreToggle
                  hiddenCount={recentSalesList.hiddenCount}
                  showingAll={recentSalesList.showAll}
                  onToggle={recentSalesList.toggle}
                  className="mx-5 mb-4"
                />
              </>
            ) : (
              <EmptyState message="Nenhuma venda no período." />
            )}
          </Panel>
        </>
      )}

      <Panel
        className="mt-6 print:break-before-page"
        eyebrow="Simulador"
        title="Quanto sobra desta venda?"
        action={<Calculator className="text-brand-300 print:hidden" size={20} />}
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="Preço de venda">
              <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="100" />
            </FieldGroup>
            <FieldGroup label="Custo total">
              <Input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder="40" />
            </FieldGroup>
            <FieldGroup label="Impostos (%)">
              <Input value={tax} onChange={(e) => setTax(e.target.value)} inputMode="decimal" placeholder="6" />
            </FieldGroup>
            <FieldGroup label="Taxa pagamento (%)">
              <Input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" placeholder="0" />
            </FieldGroup>
          </div>

          <div
            className={cn(
              'rounded-2xl border p-5',
              simulatedProfit >= 0
                ? 'border-brand-400/30 bg-brand-400/10'
                : 'border-red-500/30 bg-red-500/10'
            )}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Lucro simulado</p>
            <p className={cn('mt-2 font-serif text-4xl font-bold', simulatedProfit >= 0 ? 'text-brand-300' : 'text-red-400')}>
              {formatCurrency(simulatedProfit)}
            </p>
            <div className="mt-3 flex items-center gap-2 text-sm text-neutral-400">
              <Percent size={14} />
              Margem:{' '}
              <strong className={simulatedMargin >= 0 ? 'text-brand-300' : 'text-red-400'}>
                {simulatedMargin.toFixed(1)}%
              </strong>
            </div>
            {bestPayment && payments.length > 0 && (
              <p className="mt-3 text-xs text-neutral-500">
                Melhor opção: <span className="font-bold text-brand-300">{bestPayment.name}</span> (
                {bestPayment.fee_rate}% de taxa)
              </p>
            )}
          </div>
        </div>

        {payments.length > 0 && (
          <div className="mt-6 border-t border-border pt-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Compare formas de pagamento
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {paymentComparison.map((payment) => (
                <button
                  key={payment.name}
                  type="button"
                  onClick={() => setFee(String(payment.fee_rate))}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left transition-colors',
                    parseDecimal(fee) === payment.fee_rate
                      ? 'border-brand-400 bg-brand-400/10'
                      : 'border-border hover:border-brand-400/40'
                  )}
                >
                  <p className="text-sm font-semibold text-ink">{payment.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">Taxa: {payment.fee_rate}%</p>
                  <p className={cn('mt-2 font-serif text-lg font-bold', payment.profit >= 0 ? 'text-brand-300' : 'text-red-400')}>
                    {formatCurrency(payment.profit)}
                  </p>
                  <p className="text-xs text-neutral-500">Margem {payment.margin.toFixed(1)}%</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <FloatingToast toast={toast} onClose={clearToast} />
    </PageContainer>
  );
}
