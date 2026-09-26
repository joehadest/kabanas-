'use client';

import { useEffect, useState } from 'react';
import { BRAND } from '@/lib/brand';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils';

export type ReportPrintMetrics = {
  revenue: number;
  productCosts: number;
  paymentFees: number;
  taxes: number;
  salesProfit: number;
  operationalExpenses: number;
  netProfit: number;
  margin: number;
  salesCount: number;
};

export type ReportPrintSale = {
  id?: string;
  total_amount: number;
  total_cost: number;
  payment_fee: number;
  tax_amount: number;
  net_profit: number;
  occurred_at: string;
};

export type ReportPrintExpense = {
  description: string;
  amount: number;
  paid_at: string | null;
  due_date: string;
  category: string;
};

export type ReportPrintCategory = {
  name: string;
  value: number;
};

interface Props {
  storeName?: string;
  periodLabel: string;
  metrics: ReportPrintMetrics;
  expensesByCategory: ReportPrintCategory[];
  sales: ReportPrintSale[];
  expenses: ReportPrintExpense[];
  paidExpensesCount: number;
}

function Money({
  value,
  tone = 'neutral',
}: {
  value: number;
  tone?: 'neutral' | 'negative' | 'positive';
}) {
  return (
    <span
      className={cn(
        'tabular-nums font-semibold',
        tone === 'negative' && 'text-red-700',
        tone === 'positive' && 'text-emerald-800',
        tone === 'neutral' && 'text-neutral-900'
      )}
    >
      {formatCurrency(value)}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 border-b border-neutral-300 pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-600">
      {children}
    </h2>
  );
}

/** Documento A4 claro — só aparece na impressão / “Salvar como PDF”. */
export function ReportPrintDocument({
  storeName,
  periodLabel,
  metrics,
  expensesByCategory,
  sales,
  expenses,
  paidExpensesCount,
}: Props) {
  const brand = storeName?.trim() || BRAND.name;
  const salesRows = sales.slice(0, 40);
  const expenseRows = expenses.slice(0, 30);
  // Evita hydration mismatch: servidor e cliente podem divergir em 1s no relógio.
  const [generatedAt, setGeneratedAt] = useState('');
  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString('pt-BR'));
  }, []);

  return (
    <div className="report-print-document hidden bg-white text-neutral-900 print:block">
      <header className="mb-6 border-b-2 border-neutral-900 pb-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a6d1a]">
              {BRAND.shortName}
            </p>
            <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-neutral-950">
              {brand}
            </h1>
            <p className="mt-1 text-sm text-neutral-600">Relatório financeiro</p>
          </div>
          <div className="text-right text-xs text-neutral-600">
            <p>
              <span className="font-semibold text-neutral-800">Período:</span> {periodLabel}
            </p>
            <p className="mt-1">
              <span className="font-semibold text-neutral-800">Gerado em:</span>{' '}
              {generatedAt || '—'}
            </p>
          </div>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-4 gap-3">
        {[
          { label: 'Receita bruta', value: metrics.revenue, tone: 'neutral' as const },
          { label: 'Lucro das vendas', value: metrics.salesProfit, tone: metrics.salesProfit >= 0 ? ('positive' as const) : ('negative' as const) },
          { label: 'Despesas pagas', value: metrics.operationalExpenses, tone: 'negative' as const },
          { label: 'Lucro líquido', value: metrics.netProfit, tone: metrics.netProfit >= 0 ? ('positive' as const) : ('negative' as const) },
        ].map((item) => (
          <div key={item.label} className="rounded border border-neutral-300 px-3 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">{item.label}</p>
            <p className="mt-1 text-sm">
              <Money value={item.value} tone={item.tone} />
            </p>
          </div>
        ))}
      </section>

      <p className="mb-6 text-xs text-neutral-600">
        {metrics.salesCount} venda{metrics.salesCount === 1 ? '' : 's'} · {paidExpensesCount} despesa
        {paidExpensesCount === 1 ? '' : 's'} paga{paidExpensesCount === 1 ? '' : 's'} · Margem líquida{' '}
        <strong className={metrics.margin >= 0 ? 'text-emerald-800' : 'text-red-700'}>
          {metrics.margin.toFixed(1)}%
        </strong>
      </p>

      <div className="mb-6 grid grid-cols-2 gap-6">
        <section>
          <SectionTitle>DRE simplificada</SectionTitle>
          <table className="w-full border-collapse text-xs">
            <tbody>
              {(
                [
                  ['Receita bruta', metrics.revenue, 'neutral'],
                  ['(-) Custos de produtos', metrics.productCosts, 'negative'],
                  ['(-) Taxas de pagamento', metrics.paymentFees, 'negative'],
                  ['(-) Impostos', metrics.taxes, 'negative'],
                  ['Lucro das vendas', metrics.salesProfit, metrics.salesProfit >= 0 ? 'positive' : 'negative'],
                  ['(-) Despesas operacionais', metrics.operationalExpenses, 'negative'],
                ] as const
              ).map(([label, value, tone]) => (
                <tr key={label} className="border-b border-neutral-200">
                  <td className="py-1.5 pr-3 text-neutral-600">{label}</td>
                  <td className="py-1.5 text-right">
                    <Money value={value} tone={tone} />
                  </td>
                </tr>
              ))}
              <tr>
                <td className="pt-3 font-serif text-sm font-bold text-neutral-950">Lucro líquido</td>
                <td className="pt-3 text-right font-serif text-sm">
                  <Money
                    value={metrics.netProfit}
                    tone={metrics.netProfit >= 0 ? 'positive' : 'negative'}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <SectionTitle>Despesas por categoria</SectionTitle>
          {expensesByCategory.length ? (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-[9px] uppercase tracking-wider text-neutral-500">
                  <th className="pb-1.5 font-bold">Categoria</th>
                  <th className="pb-1.5 text-right font-bold">Valor</th>
                  <th className="pb-1.5 text-right font-bold">%</th>
                </tr>
              </thead>
              <tbody>
                {expensesByCategory.map((item) => {
                  const share =
                    metrics.operationalExpenses > 0
                      ? (item.value / metrics.operationalExpenses) * 100
                      : 0;
                  return (
                    <tr key={item.name} className="border-b border-neutral-200">
                      <td className="py-1.5 pr-2 text-neutral-800">{item.name}</td>
                      <td className="py-1.5 text-right">
                        <Money value={item.value} tone="negative" />
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-neutral-500">
                        {share.toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-neutral-500">Nenhuma despesa paga no período.</p>
          )}
        </section>
      </div>

      <section className="mb-6 break-inside-avoid">
        <SectionTitle>
          Vendas do período
          {sales.length > salesRows.length ? ` (mostrando ${salesRows.length} de ${sales.length})` : ''}
        </SectionTitle>
        {salesRows.length ? (
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-[9px] uppercase tracking-wider text-neutral-500">
                <th className="pb-1.5 font-bold">Data</th>
                <th className="pb-1.5 text-right font-bold">Receita</th>
                <th className="pb-1.5 text-right font-bold">Custos</th>
                <th className="pb-1.5 text-right font-bold">Lucro</th>
              </tr>
            </thead>
            <tbody>
              {salesRows.map((sale, index) => {
                const costs =
                  Number(sale.total_cost) + Number(sale.payment_fee) + Number(sale.tax_amount);
                return (
                  <tr
                    key={sale.id ?? `${sale.occurred_at}-${index}`}
                    className="border-b border-neutral-200"
                  >
                    <td className="py-1.5 text-neutral-700">
                      {new Date(sale.occurred_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-1.5 text-right">
                      <Money value={sale.total_amount} />
                    </td>
                    <td className="py-1.5 text-right">
                      <Money value={costs} tone="negative" />
                    </td>
                    <td className="py-1.5 text-right">
                      <Money value={sale.net_profit} tone={sale.net_profit >= 0 ? 'positive' : 'negative'} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-neutral-500">Nenhuma venda no período.</p>
        )}
      </section>

      <section className="break-inside-avoid">
        <SectionTitle>
          Despesas do período
          {expenses.length > expenseRows.length
            ? ` (mostrando ${expenseRows.length} de ${expenses.length})`
            : ''}
        </SectionTitle>
        {expenseRows.length ? (
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-[9px] uppercase tracking-wider text-neutral-500">
                <th className="pb-1.5 font-bold">Data</th>
                <th className="pb-1.5 font-bold">Descrição</th>
                <th className="pb-1.5 font-bold">Categoria</th>
                <th className="pb-1.5 text-right font-bold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {expenseRows.map((expense, index) => (
                <tr key={`${expense.description}-${index}`} className="border-b border-neutral-200">
                  <td className="py-1.5 whitespace-nowrap text-neutral-700">
                    {new Date(expense.paid_at || `${expense.due_date}T12:00:00`).toLocaleDateString(
                      'pt-BR'
                    )}
                    {!expense.paid_at && (
                      <span className="ml-1 text-[9px] uppercase text-amber-700">pendente</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-neutral-800">{expense.description}</td>
                  <td className="py-1.5 text-neutral-600">{expense.category}</td>
                  <td className="py-1.5 text-right">
                    <Money value={expense.amount} tone="negative" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-neutral-500">Nenhuma despesa no período.</p>
        )}
      </section>

      <footer className="mt-8 border-t border-neutral-300 pt-3 text-[10px] text-neutral-500">
        Documento gerado pelo sistema {BRAND.name} · uso interno
        {generatedAt ? ` · ${generatedAt}` : ''}
      </footer>
    </div>
  );
}
