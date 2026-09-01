export type PrintJobType = 'kitchen_ticket' | 'customer_receipt' | 'cash_report';

export type PrintJobStatus = 'queued' | 'printing' | 'printed' | 'failed';

export interface KitchenTicketItem {
  name: string;
  quantity: number;
  notes?: string | null;
}

export interface KitchenTicketPayload {
  tab: string;
  items: KitchenTicketItem[];
  printed_at?: string;
}

export interface CustomerReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes?: string | null;
}

export interface CustomerReceiptPayment {
  method: string;
  amount: number;
  received?: number;
  change?: number;
}

export interface CustomerReceiptPayload {
  tab: string;
  store_name?: string;
  customer?: string | null;
  waiter?: string | null;
  guest_count?: number;
  items: CustomerReceiptItem[];
  subtotal: number;
  service_rate?: number;
  service_amount?: number;
  cover_charge?: number;
  discount?: number;
  total: number;
  paid?: number;
  remaining?: number;
  payments?: CustomerReceiptPayment[];
  printed_at?: string;
}

export type PrintJobPayload = KitchenTicketPayload | CustomerReceiptPayload | Record<string, unknown>;

export interface PrintJobRecord {
  id: string;
  job_type: PrintJobType;
  status: PrintJobStatus;
  payload: PrintJobPayload;
  error_message?: string | null;
  created_at: string;
  printed_at?: string | null;
  thermal_printers?: { name: string } | { name: string }[] | null;
}

export interface ThermalPrinterRecord {
  id: string;
  name: string;
  connection_type: 'local_agent' | 'web_bluetooth' | 'web_usb';
  endpoint: string | null;
  paper_width: 58 | 80;
  purpose: 'cashier' | 'kitchen' | 'bar';
  is_active: boolean;
}

export interface PrintSettings {
  auto_print_kitchen: boolean;
  auto_print_customer: boolean;
  print_agent_url: string;
  print_agent_secret: string | null;
}
