import type { CustomerReceiptPayload, KitchenTicketPayload } from './types';

type TabItemLike = {
  product_name: string;
  quantity: number;
  unit_price: number;
  notes?: string | null;
};

export function buildKitchenPayload(params: {
  tabName: string;
  items: TabItemLike[];
}): KitchenTicketPayload {
  return {
    tab: params.tabName,
    items: params.items.map((item) => ({
      name: item.product_name,
      quantity: item.quantity,
      notes: item.notes,
    })),
    printed_at: new Date().toISOString(),
  };
}

export function buildCustomerReceiptPayload(params: {
  tabName: string;
  storeName?: string;
  customer?: string | null;
  waiter?: string | null;
  guestCount?: number;
  items: TabItemLike[];
  subtotal: number;
  serviceRate: number;
  serviceAmount: number;
  coverCharge: number;
  discount: number;
  total: number;
  paid: number;
  remaining: number;
  payments?: CustomerReceiptPayload['payments'];
}): CustomerReceiptPayload {
  return {
    tab: params.tabName,
    store_name: params.storeName,
    customer: params.customer,
    waiter: params.waiter,
    guest_count: params.guestCount,
    items: params.items.map((item) => ({
      name: item.product_name,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      total: item.quantity * Number(item.unit_price),
      notes: item.notes,
    })),
    subtotal: params.subtotal,
    service_rate: params.serviceRate,
    service_amount: params.serviceAmount,
    cover_charge: params.coverCharge,
    discount: params.discount,
    total: params.total,
    paid: params.paid,
    remaining: params.remaining,
    payments: params.payments,
    printed_at: new Date().toISOString(),
  };
}
