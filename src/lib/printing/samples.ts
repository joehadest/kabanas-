import type { CustomerReceiptPayload, KitchenTicketPayload } from './types';

export const SAMPLE_KITCHEN: KitchenTicketPayload = {
  tab: 'Mesa 05',
  items: [
    { name: 'Picanha na chapa', quantity: 2, notes: 'Mal passada' },
    { name: 'Batata frita', quantity: 1 },
    { name: 'Caipirinha', quantity: 2, notes: 'Sem açúcar' },
  ],
};

export const SAMPLE_CUSTOMER: CustomerReceiptPayload = {
  tab: 'Mesa 05',
  store_name: 'Kabanas',
  customer: 'João',
  waiter: 'Maria',
  guest_count: 3,
  items: [
    { name: 'Picanha na chapa', quantity: 2, unit_price: 89.9, total: 179.8 },
    { name: 'Batata frita', quantity: 1, unit_price: 32, total: 32 },
    { name: 'Caipirinha', quantity: 2, unit_price: 24, total: 48 },
  ],
  subtotal: 259.8,
  service_rate: 10,
  service_amount: 25.98,
  cover_charge: 45,
  discount: 0,
  total: 330.78,
  paid: 350,
  remaining: 0,
  payments: [{ method: 'Dinheiro', amount: 330.78, received: 350, change: 19.22 }],
};
