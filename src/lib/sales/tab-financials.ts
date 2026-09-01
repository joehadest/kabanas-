import { relationOne } from '@/lib/utils/format';

/** Cálculos financeiros da comanda — espelham a função `close_tab_to_sale` no Supabase. */

export interface TabFinancialItem {
  quantity: number;
  unit_price: number;
  unit_cost: number;
  tax_rate: number;
  status?: string;
}

export interface TabFinancialTab {
  service_rate: number;
  cover_charge: number;
  guest_count: number;
  discount_amount: number;
}

export interface TabFinancialPayment {
  amount: number;
  fee_rate?: number;
}

export interface TabFinancials {
  subtotal: number;
  serviceAmount: number;
  coverTotal: number;
  discount: number;
  total: number;
  costTotal: number;
  taxTotal: number;
  paymentFees: number;
  netProfit: number;
  margin: number;
}

export function calculateTabFinancials(
  items: TabFinancialItem[],
  tab: TabFinancialTab,
  payments: TabFinancialPayment[] = []
): TabFinancials {
  const active = items.filter((item) => item.status !== 'cancelled');

  const subtotal = active.reduce((sum, item) => sum + item.quantity * Number(item.unit_price), 0);
  const costTotal = active.reduce((sum, item) => sum + item.quantity * Number(item.unit_cost), 0);
  const taxTotal = active.reduce(
    (sum, item) => sum + item.quantity * Number(item.unit_price) * (Number(item.tax_rate) / 100),
    0
  );

  const serviceAmount = (subtotal * Number(tab.service_rate || 0)) / 100;
  const coverTotal = Number(tab.cover_charge || 0) * Number(tab.guest_count || 0);
  const discount = Number(tab.discount_amount || 0);
  const total = subtotal + serviceAmount + coverTotal - discount;

  const paymentFees = payments.reduce(
    (sum, payment) => sum + Number(payment.amount) * (Number(payment.fee_rate || 0) / 100),
    0
  );

  const netProfit = total - costTotal - paymentFees - taxTotal;
  const margin = total > 0 ? (netProfit / total) * 100 : 0;

  return {
    subtotal,
    serviceAmount,
    coverTotal,
    discount,
    total,
    costTotal,
    taxTotal,
    paymentFees,
    netProfit,
    margin,
  };
}

export function paymentsWithFees(
  tabPayments: { amount: number; payment_methods: { fee_rate: number; name?: string } | { fee_rate: number; name?: string }[] | null }[]
): TabFinancialPayment[] {
  return tabPayments.map((payment) => {
    const method = relationOne(payment.payment_methods);
    return {
      amount: Number(payment.amount),
      fee_rate: method?.fee_rate ?? 0,
    };
  });
}
