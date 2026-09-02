'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChefHat, LayoutGrid, ListOrdered, MoreHorizontal, Plus, Printer, Receipt, ReceiptText, Trash2, Users, UtensilsCrossed, WalletCards, Banknote } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, parseDecimal, relationOne, tableDisplayLabel } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import {
  CollapsibleSection,
  DEFAULT_LIST_LIMIT,
  ExpandCollapseControls,
  ListSearchBar,
  ShowMoreToggle,
} from '@/components/ui/collapsible-list';
import { FieldGroup, Input, Select } from '@/components/ui/input';
import { FloatingToast, useFloatingToast } from '@/components/ui/floating-toast';
import { Modal, ModalFooter, ModalSection } from '@/components/ui/modal';
import { Alert, PageContainer, PageHeader } from '@/components/ui/page-layout';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { calculateTabFinancials, paymentsWithFees } from '@/lib/sales/tab-financials';
import {
  calculateCashChange,
  CASH_RECEIVE_PRESETS,
  formatCashPresetLabel,
  isCashPaymentName,
  parseCashReceived,
} from '@/lib/sales/cash-payment';
import { buildCustomerReceiptPayload, buildKitchenPayload } from '@/lib/printing/build-payloads';
import { queuePrintJob } from '@/lib/printing/queue';
import type { PrintSettings } from '@/lib/printing/types';
import { PosProductPicker } from './PosProductPicker';
import { RestaurantSalesHistory, type RestaurantSale } from './RestaurantSalesHistory';
import { TableManager } from './TableManager';

type Area = { id: string; name: string };

type Table = {
  id: string;
  name: string;
  seats: number;
  area_id: string | null;
  dining_areas: { name: string }[];
  tabs: Tab[];
};

type Tab = {
  id: string;
  status: 'open' | 'payment' | 'attention' | 'closed' | 'cancelled';
  identifier: string | null;
  customer_name: string | null;
  waiter_name: string | null;
  guest_count: number;
  service_rate: number;
  cover_charge: number;
  discount_amount: number;
  tab_items: TabItem[];
  tab_payments: TabPayment[];
};

type TabItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  tax_rate: number;
  notes: string | null;
  status: string;
};

type TabPayment = {
  id: string;
  amount: number;
  amount_received?: number | null;
  change_amount?: number | null;
  payment_method_id: string | null;
  payment_methods: { name: string; fee_rate: number } | { name: string; fee_rate: number }[] | null;
};

type Product = {
  id: string;
  name: string;
  price: number;
  cost_price: number;
  packaging_cost: number;
  other_variable_cost: number;
  tax_rate: number;
  category_id: string | null;
  image_url: string | null;
  is_available?: boolean;
};

type Category = { id: string; name: string };

type Payment = { id: string; name: string; fee_rate: number };

type CashSession = { id: string; terminal_name: string };

interface Props {
  storeId: string;
  storeName: string;
  areas: Area[];
  tables: Table[];
  products: Product[];
  categories: Category[];
  payments: Payment[];
  recentSales: RestaurantSale[];
  cashSession: CashSession | null;
  defaultServiceRate: number;
  defaultCoverCharge: number;
  printSettings: Pick<PrintSettings, 'auto_print_kitchen' | 'auto_print_customer' | 'print_agent_url'>;
}

type ComandaTab = 'add' | 'items' | 'pay';
type SidebarTab = 'items' | 'pay';

function useCompactComanda(breakpoint = 768) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);

  return compact;
}

const statusStyle: Record<string, string> = {
  free: 'border-border bg-surface-elevated text-neutral-400 hover:border-neutral-600',
  open: 'border-brand-400/40 bg-brand-400/10 text-brand-300 hover:border-brand-400',
  payment: 'border-amber-400/50 bg-amber-500/10 text-amber-300 hover:border-amber-400',
  attention: 'border-red-400 bg-red-500/10 text-red-400 animate-pulse hover:border-red-500',
};

const statusLabel: Record<string, string> = {
  free: 'Livre',
  open: 'Ocupada',
  payment: 'Pagamento',
  attention: 'Chamar garçom',
};

function cashRequiredMessage(errorMessage?: string): string {
  const msg = errorMessage?.trim() ?? '';
  if (msg.includes('Abra o caixa')) {
    return 'Abra o caixa antes de registrar pagamentos. Vá em Caixa e abra um turno.';
  }
  return msg || 'Não foi possível concluir a operação.';
}

function paymentBalance(total: number, paid: number) {
  const delta = total - paid;
  const maxPayment = Math.max(0, delta);
  const isBalanced = Math.abs(delta) <= 0.01;
  const isOverpaid = delta < -0.01;
  const isUnderpaid = delta > 0.01;
  return { delta, maxPayment, isBalanced, isOverpaid, isUnderpaid };
}

function TableCard({ table, onClick }: { table: Table; onClick: () => void }) {
  const currentTab = table.tabs[0];
  const status: string = currentTab?.status || 'free';
  const itemCount =
    currentTab?.tab_items.filter((item) => item.status !== 'cancelled').length ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'min-h-[6.5rem] rounded-2xl border p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-panel',
        statusStyle[status]
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">
          {table.dining_areas[0]?.name || 'Salão'}
        </p>
        {table.seats > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] font-bold opacity-70">
            <Users size={11} />
            {table.seats}
          </span>
        )}
      </div>
      <p className="mt-2 font-serif text-2xl font-bold">{table.name}</p>
      <p className="mt-1 text-xs font-semibold">
        {statusLabel[status] ?? status}
        {itemCount > 0 ? ` · ${itemCount} item${itemCount > 1 ? 's' : ''}` : ''}
      </p>
    </button>
  );
}

export function TablePOS({
  storeId,
  storeName,
  areas: initialAreas,
  tables: initialTables,
  products,
  categories,
  payments,
  recentSales: initialRecentSales,
  cashSession,
  defaultServiceRate,
  defaultCoverCharge,
  printSettings,
}: Props) {
  const isCompact = useCompactComanda();
  const [areas, setAreas] = useState(initialAreas);
  const [tables, setTables] = useState(initialTables);
  const [recentSales, setRecentSales] = useState(initialRecentSales);
  const [selected, setSelected] = useState<Table | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [itemNotes, setItemNotes] = useState('');
  const [comandaTab, setComandaTab] = useState<ComandaTab>('add');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('items');
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState(payments[0]?.id || '');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const { toast, showToast, clearToast } = useFloatingToast();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initialAreas.slice(0, 2).map((a) => a.id)));
  const [showAllInGroup, setShowAllInGroup] = useState<Set<string>>(new Set());
  const [showAllItems, setShowAllItems] = useState(false);
  const [tabDetailsOpen, setTabDetailsOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [waiterName, setWaiterName] = useState('');
  const [guestCount, setGuestCount] = useState('1');
  const [serviceRate, setServiceRate] = useState(String(defaultServiceRate));
  const [coverCharge, setCoverCharge] = useState(String(defaultCoverCharge));
  const [discountAmount, setDiscountAmount] = useState('0');
  const [savingTabDetails, setSavingTabDetails] = useState(false);
  const [removingSaleId, setRemovingSaleId] = useState<string | null>(null);
  const [voidingComanda, setVoidingComanda] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<
    | { type: 'cancelItem'; itemId: string; itemName: string }
    | { type: 'removeTabPayment'; paymentId: string }
    | { type: 'removeSale'; saleId: string }
    | { type: 'voidComanda'; hasContent: boolean }
    | null
  >(null);

  const normalizedSearch = search.trim().toLowerCase();

  const grouped = useMemo(() => {
    const map = new Map<string, Table[]>();
    for (const area of areas) map.set(area.id, []);
    const uncategorized: Table[] = [];

    for (const table of tables) {
      if (normalizedSearch && !table.name.toLowerCase().includes(normalizedSearch)) continue;
      if (!table.area_id) uncategorized.push(table);
      else map.get(table.area_id)?.push(table);
    }

    return { map, uncategorized };
  }, [tables, areas, normalizedSearch]);

  const visibleAreas = useMemo(() => {
    if (!normalizedSearch) return areas;
    return areas.filter((area) => (grouped.map.get(area.id)?.length ?? 0) > 0);
  }, [areas, normalizedSearch, grouped.map]);

  const tab = selected?.tabs[0];
  const items = tab?.tab_items.filter((item) => item.status !== 'cancelled') || [];
  const financials = useMemo(() => {
    if (!tab) {
      return calculateTabFinancials([], { service_rate: 0, cover_charge: 0, guest_count: 0, discount_amount: 0 }, []);
    }
    return calculateTabFinancials(
      items,
      {
        service_rate: Number(tab.service_rate || 0),
        cover_charge: Number(tab.cover_charge || 0),
        guest_count: Number(tab.guest_count || 0),
        discount_amount: Number(tab.discount_amount || 0),
      },
      paymentsWithFees(tab.tab_payments || [])
    );
  }, [items, tab]);
  const subtotal = financials.subtotal;
  const total = financials.total;
  const paid = (tab?.tab_payments || []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const { delta: paymentDelta, maxPayment, isBalanced, isOverpaid, isUnderpaid } = paymentBalance(total, paid);

  const selectedPayment = useMemo(
    () => payments.find((payment) => payment.id === paymentId),
    [payments, paymentId]
  );
  const isCashPayment = selectedPayment ? isCashPaymentName(selectedPayment.name) : false;
  const cashBillAmount = isCashPayment && maxPayment > 0 ? maxPayment : parseDecimal(paymentAmount);
  const paymentDueAmount = Number.isFinite(cashBillAmount) && cashBillAmount > 0 ? cashBillAmount : parseDecimal(paymentAmount);
  const cashReceivedAmount = parseCashReceived(cashReceived);
  const cashChangePreview =
    isCashPayment && Number.isFinite(paymentDueAmount) && paymentDueAmount > 0 && Number.isFinite(cashReceivedAmount)
      ? calculateCashChange(cashReceivedAmount, paymentDueAmount)
      : 0;
  const cashReceivedInsufficient =
    isCashPayment &&
    cashReceived.trim() !== '' &&
    Number.isFinite(paymentDueAmount) &&
    paymentDueAmount > 0 &&
    Number.isFinite(cashReceivedAmount) &&
    cashReceivedAmount + 0.009 < paymentDueAmount;
  const cashPaymentReady =
    !isCashPayment ||
    (Number.isFinite(paymentDueAmount) &&
      paymentDueAmount > 0 &&
      Number.isFinite(cashReceivedAmount) &&
      cashReceivedAmount + 0.009 >= paymentDueAmount);

  const totalCashChange = useMemo(
    () =>
      (tab?.tab_payments || []).reduce((sum, payment) => sum + Number(payment.change_amount || 0), 0),
    [tab]
  );

  const prevPaymentIdRef = useRef(paymentId);

  useEffect(() => {
    const payment = payments.find((item) => item.id === paymentId);
    if (!payment) return;

    if (prevPaymentIdRef.current !== paymentId) {
      setCashReceived('');
      prevPaymentIdRef.current = paymentId;
    }

    if (isCashPaymentName(payment.name) && maxPayment > 0) {
      setPaymentAmount(maxPayment.toFixed(2));
    }
  }, [paymentId, maxPayment, payments]);

  useEffect(() => {
    if (!tab) return;
    setCustomerName(tab.customer_name ?? '');
    setWaiterName(tab.waiter_name ?? '');
    setGuestCount(String(tab.guest_count || 1));
    setServiceRate(String(tab.service_rate ?? defaultServiceRate));
    setCoverCharge(String(tab.cover_charge ?? defaultCoverCharge));
    setDiscountAmount(String(tab.discount_amount || 0));
  }, [tab?.id, defaultServiceRate, defaultCoverCharge]);

  const visibleItems = showAllItems ? items : items.slice(0, DEFAULT_LIST_LIMIT);
  const hiddenItemCount = Math.max(0, items.length - DEFAULT_LIST_LIMIT);

  const patchTable = (tableId: string, patch: (table: Table) => Table) => {
    setTables((prev) => prev.map((table) => (table.id === tableId ? patch(table) : table)));
    setSelected((prev) => (prev?.id === tableId ? patch(prev) : prev));
  };

  const openTab = async (table: Table) => {
    if (!table.tabs[0]) {
      const { data: newTab, error } = await createClient()
        .from('tabs')
        .insert({
          store_id: storeId,
          table_id: table.id,
          identifier: table.name,
          service_rate: defaultServiceRate,
          cover_charge: defaultCoverCharge,
          guest_count: 1,
        })
        .select(
          'id,status,identifier,customer_name,waiter_name,guest_count,service_rate,cover_charge,discount_amount'
        )
        .single();
      if (error || !newTab) {
        showToast('Não foi possível abrir a comanda. Execute a migração do PDV.', 'error');
        return;
      }
      const opened: Table = {
        ...table,
        tabs: [{ ...newTab, tab_items: [], tab_payments: [] } as Tab],
      };
      patchTable(table.id, () => opened);
      setSelected(opened);
      setShowAllItems(false);
      setItemNotes('');
      setComandaTab('add');
      setSidebarTab('items');
      clearToast();
      return;
    }
    setSelected(table);
    setShowAllItems(false);
    setItemNotes('');
    setComandaTab('add');
    setSidebarTab('items');
    clearToast();
  };

  const addProduct = async (picked: { id: string }, qty: number) => {
    const product = products.find((item) => item.id === picked.id);
    const quantity = Math.max(1, Math.min(99, qty));
    if (!product || !tab || !selected || product.is_available === false) return;
    setAddingProductId(product.id);
    const note = itemNotes.trim() || null;
    const { data, error } = await createClient()
      .from('tab_items')
      .insert({
        tab_id: tab.id,
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: product.price,
        unit_cost: product.cost_price + product.packaging_cost + product.other_variable_cost,
        tax_rate: product.tax_rate,
        notes: note,
      })
      .select('id,product_name,quantity,unit_price,unit_cost,tax_rate,notes,status')
      .single();
    setAddingProductId(null);
    if (error || !data) {
      showToast('Não foi possível lançar o item.', 'error');
      return;
    }
    patchTable(selected.id, (table) => ({
      ...table,
      tabs: table.tabs.map((currentTab, index) =>
        index === 0 ? { ...currentTab, tab_items: [...currentTab.tab_items, data as TabItem] } : currentTab
      ),
    }));
    setItemNotes('');
    showToast(`${quantity}x ${product.name} adicionado à comanda.`, 'success');
    if (printSettings.auto_print_kitchen) {
      void enqueuePrint('kitchen_ticket', { items: [data as TabItem], silent: true });
    }
  };

  const cancelItem = async (itemId: string) => {
    if (!selected) return;
    const { error } = await createClient()
      .from('tab_items')
      .update({
        status: 'cancelled',
        cancellation_reason: null,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', itemId);
    if (error) {
      showToast('Não foi possível cancelar o item.', 'error');
      return;
    }
    patchTable(selected.id, (table) => ({
      ...table,
      tabs: table.tabs.map((currentTab, index) =>
        index === 0
          ? {
              ...currentTab,
              tab_items: currentTab.tab_items.map((item) =>
                item.id === itemId ? { ...item, status: 'cancelled' } : item
              ),
            }
          : currentTab
      ),
    }));
    showToast('Item removido da comanda.', 'success');
  };

  const saveTabDetails = async () => {
    if (!tab || !selected) return;
    const parsedGuestCount = Math.max(1, Math.min(99, Math.round(parseDecimal(guestCount) || 1)));
    const parsedServiceRate = Math.max(0, parseDecimal(serviceRate) || 0);
    const parsedCoverCharge = Math.max(0, parseDecimal(coverCharge) || 0);
    const parsedDiscount = Math.max(0, parseDecimal(discountAmount) || 0);

    setSavingTabDetails(true);
    const payload = {
      customer_name: customerName.trim() || null,
      waiter_name: waiterName.trim() || null,
      guest_count: parsedGuestCount,
      service_rate: parsedServiceRate,
      cover_charge: parsedCoverCharge,
      discount_amount: parsedDiscount,
    };
    const { data, error } = await createClient()
      .from('tabs')
      .update(payload)
      .eq('id', tab.id)
      .select('customer_name,waiter_name,guest_count,service_rate,cover_charge,discount_amount')
      .single();
    setSavingTabDetails(false);

    if (error || !data) {
      showToast('Não foi possível salvar os dados da mesa.', 'error');
      return;
    }

    patchTable(selected.id, (table) => ({
      ...table,
      tabs: table.tabs.map((currentTab, index) => (index === 0 ? { ...currentTab, ...data } : currentTab)),
    }));
    showToast('Dados da mesa atualizados.', 'success');
  };

  const removeTabPayment = async (tabPaymentId: string) => {
    if (!tab || !selected) return;
    const { error } = await createClient().from('tab_payments').delete().eq('id', tabPaymentId);
    if (error) {
      showToast('Não foi possível remover o pagamento.', 'error');
      return;
    }
    patchTable(selected.id, (table) => ({
      ...table,
      tabs: table.tabs.map((currentTab, index) =>
        index === 0
          ? {
              ...currentTab,
              tab_payments: currentTab.tab_payments.filter((payment) => payment.id !== tabPaymentId),
            }
          : currentTab
      ),
    }));
    showToast('Pagamento removido.', 'success');
  };

  const removeSale = async (saleId: string) => {
    const sale = recentSales.find((item) => item.id === saleId);
    setRemovingSaleId(saleId);
    const supabase = createClient();
    const { error } = await supabase.from('sales').delete().eq('id', saleId);
    if (!error && sale?.notes?.startsWith('Comanda')) {
      const label = tableDisplayLabel(sale.notes);
      const { data: tabs } = await supabase
        .from('tabs')
        .select('id')
        .eq('status', 'closed')
        .eq('identifier', label);
      const tabIds = (tabs ?? []).map((tab) => tab.id);
      if (tabIds.length) {
        await supabase.from('tab_payments').delete().in('tab_id', tabIds);
      }
    }
    setRemovingSaleId(null);
    if (error) {
      showToast(error.message || 'Não foi possível remover a venda.', 'error');
      return;
    }
    setRecentSales((previous) => previous.filter((item) => item.id !== saleId));
    showToast('Venda removida.', 'success');
  };

  const voidOpenComanda = async () => {
    if (!tab || !selected) return;
    setVoidingComanda(true);
    const tableId = selected.id;
    const { error } = await createClient().from('tabs').delete().eq('id', tab.id);
    setVoidingComanda(false);
    if (error) {
      showToast(error.message || 'Não foi possível cancelar a comanda.', 'error');
      return;
    }
    patchTable(tableId, (table) => ({ ...table, tabs: [] }));
    setSelected(null);
    showToast('Comanda cancelada. Mesa liberada.', 'success');
  };

  const addPayment = async () => {
    if (!tab || !selected) return;
    if (!cashSession) {
      showToast('Abra o caixa antes de registrar pagamentos. Vá em Caixa e abra um turno.', 'error');
      return;
    }
    if (!payments.length) {
      showToast('Cadastre formas de pagamento em Taxas e ajustes.', 'error');
      return;
    }
    let amount = parseDecimal(paymentAmount);
    if (isCashPayment) {
      if (!Number.isFinite(amount) || amount <= 0) {
        amount = maxPayment;
      }
      amount = Math.min(amount, maxPayment);
    }
    if (!paymentId || !Number.isFinite(amount) || amount <= 0) {
      showToast('Informe forma de pagamento e valor válido.', 'error');
      return;
    }
    if (amount > maxPayment + 0.01) {
      showToast(
        maxPayment <= 0
          ? 'A comanda já está quitada. Remova um pagamento para ajustar.'
          : `O valor máximo é ${formatCurrency(maxPayment)}.`,
        'error'
      );
      return;
    }

    let received: number | null = null;
    let change = 0;
    if (isCashPayment) {
      received = parseCashReceived(cashReceived);
      if (!Number.isFinite(received) || received + 0.009 < amount) {
        showToast(`Informe quanto o cliente pagou (mín. ${formatCurrency(amount)}).`, 'error');
        return;
      }
      change = calculateCashChange(received, amount);
    }

    const insertPayload: {
      tab_id: string;
      payment_method_id: string;
      amount: number;
      amount_received?: number;
      change_amount?: number;
    } = {
      tab_id: tab.id,
      payment_method_id: paymentId,
      amount,
    };

    if (isCashPayment && received != null) {
      insertPayload.amount_received = received;
      insertPayload.change_amount = change;
    }

    let data: TabPayment | null = null;
    let error: { message: string } | null = null;

    const primary = await createClient()
      .from('tab_payments')
      .insert(insertPayload)
      .select('id,amount,amount_received,change_amount,payment_method_id,payment_methods(name,fee_rate)')
      .single();

    data = (primary.data as TabPayment | null) ?? null;
    error = primary.error;

    if (error && isCashPayment && (error.message.includes('amount_received') || error.message.includes('change_amount'))) {
      const fallback = await createClient()
        .from('tab_payments')
        .insert({ tab_id: tab.id, payment_method_id: paymentId, amount })
        .select('id,amount,payment_method_id,payment_methods(name,fee_rate)')
        .single();
      data = (fallback.data as TabPayment | null) ?? null;
      error = fallback.error;
      if (!error) {
        showToast('Pagamento registrado. Execute migration_tab_payment_change.sql para salvar troco.', 'info');
      }
    }

    if (error || !data) {
      showToast(cashRequiredMessage(error?.message), 'error');
      return;
    }
    patchTable(selected.id, (table) => ({
      ...table,
      tabs: table.tabs.map((currentTab, index) =>
        index === 0
          ? { ...currentTab, tab_payments: [...currentTab.tab_payments, data as TabPayment] }
          : currentTab
      ),
    }));
    setPaymentAmount('');
    setCashReceived('');
    setComandaTab('pay');
    setSidebarTab('pay');
    if (isCashPayment && change > 0) {
      showToast(`Pagamento registrado. Troco: ${formatCurrency(change)}.`, 'success');
    } else {
      showToast('Pagamento registrado.', 'success');
    }
  };

  const close = async () => {
    if (!tab || !selected) return;
    if (!cashSession) {
      showToast('Abra o caixa antes de fechar a comanda. Vá em Caixa e abra um turno.', 'error');
      return;
    }
    setClosing(true);
    const tableId = selected.id;
    const snapshotItems = items.map((item) => ({
      product_name: item.product_name,
      quantity: item.quantity,
    }));
    const snapshotFinancials = financials;
    const snapshotNote = `Comanda ${tab.identifier || selected.name}`;

    const { data: saleId, error } = await createClient().rpc('close_tab_to_sale', { tab_to_close: tab.id });
    setClosing(false);
    setCloseConfirmOpen(false);
    if (error) {
      showToast(cashRequiredMessage(error.message), 'error');
      return;
    }

    if (saleId) {
      setRecentSales((previous) => [
        {
          id: String(saleId),
          total_amount: snapshotFinancials.total,
          total_cost: snapshotFinancials.costTotal,
          payment_fee: snapshotFinancials.paymentFees,
          tax_amount: snapshotFinancials.taxTotal,
          net_profit: snapshotFinancials.netProfit,
          occurred_at: new Date().toISOString(),
          notes: snapshotNote,
          sale_items: snapshotItems,
        },
        ...previous,
      ]);
    }

    if (printSettings.auto_print_customer) {
      await enqueuePrint('customer_receipt', { silent: true });
    }

    patchTable(tableId, (table) => ({ ...table, tabs: [] }));
    setSelected(null);
    if (totalCashChange > 0) {
      showToast(`Comanda fechada. Troco entregue: ${formatCurrency(totalCashChange)}.`, 'success');
    } else {
      showToast('Comanda fechada. Custos, taxas e lucro registrados.', 'success');
    }
  };

  const requestClose = () => {
    if (!tab || !selected) return;
    if (totalCashChange > 0.009) {
      setCloseConfirmOpen(true);
      return;
    }
    void close();
  };

  const sendKitchen = async () => {
    await enqueuePrint('kitchen_ticket');
  };

  const sendCustomerReceipt = async () => {
    await enqueuePrint('customer_receipt');
  };

  const enqueuePrint = async (
    jobType: 'kitchen_ticket' | 'customer_receipt',
    options?: { items?: TabItem[]; silent?: boolean }
  ) => {
    if (!tab || !selected) return;

    const printItems = options?.items ?? items;
    if (!printItems.length) {
      if (!options?.silent) showToast('Nada para imprimir na comanda.', 'error');
      return;
    }

    const serviceAmount = financials.serviceAmount;
    const coverTotal = financials.coverTotal;

    const payload =
      jobType === 'kitchen_ticket'
        ? buildKitchenPayload({ tabName: selected.name, items: printItems })
        : buildCustomerReceiptPayload({
            tabName: selected.name,
            storeName,
            customer: tab.customer_name,
            waiter: tab.waiter_name,
            guestCount: tab.guest_count,
            items: printItems,
            subtotal,
            serviceRate: Number(tab.service_rate || 0),
            serviceAmount,
            coverCharge: coverTotal,
            discount: Number(tab.discount_amount || 0),
            total,
            paid,
            remaining: Math.max(0, paymentDelta),
            payments: (tab.tab_payments || []).map((payment) => ({
              method: relationOne(payment.payment_methods)?.name || 'Pagamento',
              amount: Number(payment.amount),
              received: payment.amount_received != null ? Number(payment.amount_received) : undefined,
              change: payment.change_amount != null ? Number(payment.change_amount) : undefined,
            })),
          });

    const { error } = await queuePrintJob({
      storeId,
      tabId: tab.id,
      jobType,
      payload,
      agentUrl: printSettings.print_agent_url,
    });

    if (options?.silent) return;

    showToast(
      error
        ? 'Não foi possível incluir a impressão na fila.'
        : jobType === 'kitchen_ticket'
          ? 'Ficha da cozinha na fila de impressão.'
          : 'Conta do cliente na fila de impressão.',
      error ? 'error' : 'success'
    );
  };

  const renderTableGrid = (areaTables: Table[], groupKey: string) => {
    if (!areaTables.length) {
      return <p className="py-2 text-sm text-neutral-400">Nenhuma mesa neste ambiente.</p>;
    }

    const showAll = showAllInGroup.has(groupKey) || !!normalizedSearch;
    const visible = showAll ? areaTables : areaTables.slice(0, DEFAULT_LIST_LIMIT);
    const hiddenCount = areaTables.length - DEFAULT_LIST_LIMIT;

    return (
      <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((table) => (
            <TableCard key={table.id} table={table} onClick={() => openTab(table)} />
          ))}
        </div>
        <ShowMoreToggle hiddenCount={hiddenCount} showingAll={showAll} onToggle={() => {
          setShowAllInGroup((prev) => {
            const next = new Set(prev);
            if (next.has(groupKey)) next.delete(groupKey);
            else next.add(groupKey);
            return next;
          });
        }} />
      </>
    );
  };

  const handleTablesUpdate = (nextAreas: Area[], nextTables: Table[]) => {
    setAreas(nextAreas);
    setTables(nextTables);
  };

  const totalVisible = normalizedSearch
    ? tables.filter((t) => t.name.toLowerCase().includes(normalizedSearch)).length
    : tables.length;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Vendas"
        title="Mesas e comandas"
        description="Lance os pedidos na mesa. Ao fechar a comanda, custos, taxas, impostos e lucro são calculados automaticamente."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="md" onClick={() => setManagerOpen(true)} className="normal-case">
              <LayoutGrid size={16} />
              Gerenciar salão
            </Button>
            <Link href="/admin/kds">
              <Button variant="primary" size="md" className="normal-case">
                <ChefHat size={16} />
                Cozinha
              </Button>
            </Link>
          </div>
        }
      />

      {!cashSession ? (
        <Alert variant="warning" className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <WalletCards size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Caixa fechado</p>
                <p className="mt-1 text-neutral-400">
                  Pagamentos e fechamento de comandas exigem um caixa aberto no seu usuário.
                </p>
              </div>
            </div>
            <Link href="/admin/caixa" className="shrink-0">
              <Button variant="primary" size="md" className="normal-case">
                Abrir caixa
              </Button>
            </Link>
          </div>
        </Alert>
      ) : (
        <p className="mt-4 text-xs text-neutral-500">
          Caixa aberto: <span className="font-semibold text-brand-300">{cashSession.terminal_name}</span>
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ListSearchBar value={search} onChange={setSearch} placeholder="Buscar mesa..." />
        {!normalizedSearch && areas.length > 1 && (
          <ExpandCollapseControls
            onExpandAll={() => setExpanded(new Set([...areas.map((a) => a.id), '__none__']))}
            onCollapseAll={() => setExpanded(new Set())}
          />
        )}
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        {totalVisible} mesa{totalVisible !== 1 ? 's' : ''}
      </p>

      <div className="mt-4 space-y-3">
        {visibleAreas.map((area) => {
          const areaTables = grouped.map.get(area.id) ?? [];
          const isOpen = !!normalizedSearch || expanded.has(area.id);

          return (
            <CollapsibleSection
              key={area.id}
              title={area.name}
              count={areaTables.length}
              open={isOpen}
              onOpenChange={(next) =>
                setExpanded((prev) => {
                  const updated = new Set(prev);
                  if (next) updated.add(area.id);
                  else updated.delete(area.id);
                  return updated;
                })
              }
            >
              {renderTableGrid(areaTables, area.id)}
            </CollapsibleSection>
          );
        })}

        {grouped.uncategorized.length > 0 && (
          <CollapsibleSection
            title="Sem ambiente"
            count={grouped.uncategorized.length}
            open={!!normalizedSearch || expanded.has('__none__')}
            onOpenChange={(next) =>
              setExpanded((prev) => {
                const updated = new Set(prev);
                if (next) updated.add('__none__');
                else updated.delete('__none__');
                return updated;
              })
            }
          >
            {renderTableGrid(grouped.uncategorized, '__none__')}
          </CollapsibleSection>
        )}

        {tables.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm text-neutral-500">Nenhuma mesa cadastrada ainda.</p>
            <Button variant="primary" size="md" onClick={() => setManagerOpen(true)} className="mt-4 normal-case">
              <Plus size={16} />
              Cadastrar mesas
            </Button>
          </div>
        )}

        {normalizedSearch && visibleAreas.length === 0 && grouped.uncategorized.length === 0 && tables.length > 0 && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-neutral-500">
            Nenhuma mesa encontrada para &quot;{search}&quot;.
          </p>
        )}
      </div>

      <div className="mt-8">
        <RestaurantSalesHistory
          sales={recentSales}
          onRemoveSale={(saleId) => setPendingConfirm({ type: 'removeSale', saleId })}
          removingSaleId={removingSaleId}
        />
      </div>

      <TableManager
        storeId={storeId}
        areas={areas}
        tables={tables.map((t) => ({
          id: t.id,
          name: t.name,
          seats: t.seats,
          area_id: t.area_id,
          tabs: t.tabs.map((tab) => ({ id: tab.id, status: tab.status })),
        }))}
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        onUpdate={(nextAreas, nextTables) => {
          handleTablesUpdate(
            nextAreas,
            nextTables.map((t) => {
              const existing = tables.find((table) => table.id === t.id);
              return {
                ...t,
                dining_areas: t.area_id
                  ? [{ name: nextAreas.find((a) => a.id === t.area_id)?.name || 'Salão' }]
                  : [],
                tabs: existing?.tabs ?? [],
              };
            })
          );
        }}
      />

      {selected && tab && (
        <Modal
          onClose={() => setSelected(null)}
          title={selected.name}
          subtitle="Comanda aberta"
          description={
            tab.customer_name || tab.waiter_name
              ? [tab.customer_name, tab.waiter_name].filter(Boolean).join(' · ')
              : tab.identifier || undefined
          }
          hideHeader
          size="full"
          variant={isCompact ? 'sheet' : 'center'}
          motionPreset={isCompact ? 'default' : 'fade'}
          className={clsx(
            'w-full overflow-hidden touch-manipulation',
            'max-w-[min(96vw,1400px)] xl:max-w-[min(94vw,1600px)] 2xl:max-w-[min(92vw,1800px)] min-[2560px]:max-w-[min(90vw,2000px)]',
            isCompact
              ? 'h-[100dvh] min-h-[100dvh] max-h-[100dvh] rounded-none'
              : 'md:h-[95vh] md:min-h-[95vh] md:max-h-[95vh] 2xl:h-[96vh] 2xl:min-h-[96vh] 2xl:max-h-[96vh]'
          )}
          hero={
            isCompact ? (
              <div className="relative shrink-0 border-b border-border bg-surface-elevated px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-300">
                      Comanda · {selected.name}
                    </p>
                    <p className="font-serif text-xl font-bold text-ink">{formatCurrency(total)}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {isUnderpaid
                        ? `Falta ${formatCurrency(paymentDelta)}`
                        : isOverpaid
                          ? `Excedente ${formatCurrency(Math.abs(paymentDelta))}`
                          : 'Quitado'}{' '}
                      · {items.length} item{items.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMoreActionsOpen(true)}
                      aria-label="Mais ações"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-black/30 text-neutral-400"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      aria-label="Fechar"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-elevated text-neutral-500 shadow-sm"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ) : (
            <div className="shrink-0 border-b border-border bg-surface-elevated px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-300">
                      {tableDisplayLabel(selected.name)}
                      {tab.customer_name ? ` · ${tab.customer_name}` : ''}
                    </p>
                    <p className="font-serif text-2xl font-bold leading-none text-ink sm:text-3xl">
                      {formatCurrency(total)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-lg border border-border bg-black/30 px-2.5 py-1.5 text-neutral-400">
                      Itens <strong className="text-ink">{formatCurrency(subtotal)}</strong>
                    </span>
                    <span className="rounded-lg border border-border bg-black/30 px-2.5 py-1.5 text-neutral-400">
                      Pago <strong className="text-brand-300">{formatCurrency(paid)}</strong>
                    </span>
                    <span className="rounded-lg border border-border bg-black/30 px-2.5 py-1.5 text-neutral-400">
                      {isUnderpaid ? 'Falta' : isOverpaid ? 'Excedente' : 'Saldo'}{' '}
                      <strong
                        className={
                          isUnderpaid ? 'text-red-400' : isOverpaid ? 'text-amber-300' : 'text-brand-300'
                        }
                      >
                        {formatCurrency(isOverpaid ? Math.abs(paymentDelta) : Math.max(0, paymentDelta))}
                      </strong>
                    </span>
                    <span className="rounded-lg border border-brand-400/30 bg-brand-400/10 px-2.5 py-1.5 text-neutral-400">
                      Lucro{' '}
                      <strong className={financials.netProfit >= 0 ? 'text-brand-300' : 'text-red-400'}>
                        {formatCurrency(financials.netProfit)}
                      </strong>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Fechar comanda"
                  className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-elevated text-neutral-400 transition-colors hover:border-brand-400 hover:text-ink sm:flex"
                >
                  ×
                </button>
              </div>
            </div>
            )
          }
          footer={
            isCompact ? (
              <div className="flex flex-col gap-2.5">
                <div className="flex gap-1 rounded-xl border border-border bg-surface-elevated p-1">
                  {(
                    [
                      { id: 'add' as const, label: 'Cardápio', icon: UtensilsCrossed },
                      { id: 'items' as const, label: 'Itens', icon: ListOrdered, badge: items.length },
                      { id: 'pay' as const, label: 'Pagar', icon: WalletCards },
                    ] as const
                  ).map((tabItem) => {
                    const Icon = tabItem.icon;
                    const active = comandaTab === tabItem.id;
                    return (
                      <button
                        key={tabItem.id}
                        type="button"
                        onClick={() => setComandaTab(tabItem.id)}
                        className={clsx(
                          'flex flex-1 touch-manipulation flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors',
                          active ? 'bg-brand-600 text-white' : 'text-neutral-400'
                        )}
                      >
                        <span className="relative">
                          <Icon size={18} />
                          {'badge' in tabItem && tabItem.badge > 0 && (
                            <span
                              className={clsx(
                                'absolute -right-2.5 -top-1.5 min-w-[1.1rem] rounded-full px-1 text-[9px] leading-4',
                                active ? 'bg-white/25 text-white' : 'bg-brand-400/20 text-brand-300'
                              )}
                            >
                              {tabItem.badge}
                            </span>
                          )}
                        </span>
                        {tabItem.label}
                      </button>
                    );
                  })}
                </div>

                {comandaTab === 'add' && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => setComandaTab('items')}
                      className="normal-case"
                    >
                      <ListOrdered size={16} />
                      Comanda{items.length ? ` (${items.length})` : ''}
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => setComandaTab('pay')}
                      disabled={!items.length}
                      className="normal-case"
                    >
                      <WalletCards size={16} />
                      Pagamento
                    </Button>
                  </div>
                )}

                {comandaTab === 'items' && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" size="md" onClick={() => setComandaTab('add')} className="normal-case">
                      <Plus size={16} />
                      Cardápio
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => setComandaTab('pay')}
                      disabled={!items.length}
                      className="normal-case"
                    >
                      <WalletCards size={16} />
                      Ir pagar
                    </Button>
                  </div>
                )}

                {comandaTab === 'pay' && (
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="primary"
                      size="md"
                      onClick={requestClose}
                      disabled={!cashSession || !isBalanced || !items.length || closing}
                      className="w-full normal-case"
                    >
                      <ReceiptText size={16} />
                      {closing
                        ? 'Fechando...'
                        : isBalanced
                          ? `Fechar venda · ${formatCurrency(total)}`
                          : `Falta ${formatCurrency(Math.max(0, paymentDelta))}`}
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" size="md" onClick={() => setComandaTab('add')} className="normal-case">
                        <UtensilsCrossed size={16} />
                        Cardápio
                      </Button>
                      <Button
                        variant="outline"
                        size="md"
                        onClick={() => setMoreActionsOpen(true)}
                        className="normal-case"
                      >
                        <MoreHorizontal size={16} />
                        Mais
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
            <ModalFooter layout="toolbar" className="gap-2 sm:gap-3 xl:gap-4 2xl:px-2 [&_button]:w-full sm:[&_button]:w-auto">
              <div className="flex w-full flex-col gap-2 sm:mr-auto sm:w-auto sm:flex-row">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={sendKitchen}
                  disabled={!items.length}
                  className="normal-case"
                >
                  <Printer size={16} />
                  <span className="sm:hidden">Cozinha</span>
                  <span className="hidden sm:inline">Imprimir cozinha</span>
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={sendCustomerReceipt}
                  disabled={!items.length}
                  className="normal-case"
                >
                  <Receipt size={16} />
                  <span className="sm:hidden">Cliente</span>
                  <span className="hidden sm:inline">Imprimir conta</span>
                </Button>
              </div>
              <Button variant="secondary" size="md" onClick={() => setSelected(null)} className="normal-case">
                Fechar
              </Button>
              {(items.length > 0 || (tab.tab_payments?.length ?? 0) > 0) && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() =>
                    setPendingConfirm({
                      type: 'voidComanda',
                      hasContent: items.length > 0 || (tab.tab_payments?.length ?? 0) > 0,
                    })
                  }
                  disabled={voidingComanda}
                  className="normal-case border-red-500/30 text-red-400 hover:border-red-500/50 hover:bg-red-500/10"
                >
                  <Trash2 size={16} />
                  {voidingComanda ? 'Cancelando...' : 'Cancelar comanda'}
                </Button>
              )}
              <Button
                variant="primary"
                size="md"
                onClick={requestClose}
                disabled={!cashSession || !isBalanced || !items.length || closing}
                className="normal-case"
              >
                <ReceiptText size={16} />
                <span className="sm:hidden">{closing ? 'Fechando...' : 'Fechar venda'}</span>
                <span className="hidden sm:inline">{closing ? 'Fechando...' : 'Fechar e registrar venda'}</span>
              </Button>
            </ModalFooter>
            )
          }
          footerClassName={isCompact ? 'px-3 py-3' : undefined}
          bodyClassName={clsx(
            'flex min-h-0 flex-1 flex-col overflow-hidden',
            isCompact ? 'px-3 py-2' : 'px-3 py-3 sm:px-5 sm:py-4 xl:px-5 xl:py-4 2xl:px-6 2xl:py-4'
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              className={clsx(
                'min-h-0 flex-1 overflow-hidden',
                isCompact
                  ? 'flex h-full min-h-0 flex-col'
                  : 'grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(17rem,20rem)] grid-rows-[minmax(0,1fr)] gap-4 md:gap-5'
              )}
            >
              <div
                className={clsx(
                  'flex h-full min-h-0 flex-col overflow-hidden',
                  isCompact && comandaTab === 'add' && 'min-h-0 flex-1',
                  isCompact && comandaTab !== 'add' && 'hidden'
                )}
              >
                {!isCompact && (
                  <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                    <div>
                      <h3 className="font-serif text-lg font-bold text-ink">Cardápio</h3>
                      <p className="text-xs text-neutral-500">Clique no produto para lançar na mesa</p>
                    </div>
                    <span className="rounded-lg border border-border bg-black/30 px-2.5 py-1 text-xs font-bold text-neutral-400">
                      {items.length} na comanda
                    </span>
                  </div>
                )}
                <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-neutral-900/80 p-3 sm:p-4 md:border-brand-400/20 md:bg-neutral-900/60">
                  <PosProductPicker
                    products={products}
                    categories={categories}
                    onSelect={addProduct}
                    onUnavailable={(product) => showToast(`${product.name} está indisponível no cardápio.`, 'error')}
                    addingId={addingProductId}
                    notes={itemNotes}
                    onNotesChange={setItemNotes}
                    compact={isCompact}
                  />
                </div>
              </div>

              <aside
                className={clsx(
                  'flex h-full min-h-0 max-h-full flex-col',
                  isCompact
                    ? 'min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]'
                    : 'overflow-hidden',
                  isCompact && comandaTab === 'add' && 'hidden',
                  !isCompact && 'border-l border-border pl-4 md:pl-5'
                )}
              >
                <CollapsibleSection
                  title="Dados da mesa"
                  subtitle="Cliente, taxas e desconto"
                  open={tabDetailsOpen}
                  onOpenChange={setTabDetailsOpen}
                  className={clsx('mb-3 shrink-0', isCompact && comandaTab === 'pay' && 'hidden')}
                >
                  <div className="space-y-3 rounded-2xl border border-border bg-surface-elevated p-3 sm:p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FieldGroup label="Cliente">
                        <Input
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Nome opcional"
                        />
                      </FieldGroup>
                      <FieldGroup label="Garçom">
                        <Input
                          value={waiterName}
                          onChange={(e) => setWaiterName(e.target.value)}
                          placeholder="Nome opcional"
                        />
                      </FieldGroup>
                      <FieldGroup label="Pessoas">
                        <Input
                          value={guestCount}
                          onChange={(e) => setGuestCount(e.target.value.replace(/\D/g, '').slice(0, 2))}
                          inputMode="numeric"
                          placeholder="1"
                        />
                      </FieldGroup>
                      <FieldGroup label="Taxa de serviço (%)">
                        <Input
                          value={serviceRate}
                          onChange={(e) => setServiceRate(e.target.value)}
                          inputMode="decimal"
                          placeholder="10"
                        />
                      </FieldGroup>
                      <FieldGroup label="Couvert por pessoa (R$)">
                        <Input
                          value={coverCharge}
                          onChange={(e) => setCoverCharge(e.target.value)}
                          inputMode="decimal"
                          placeholder="0,00"
                        />
                      </FieldGroup>
                      <FieldGroup label="Desconto (R$)">
                        <Input
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(e.target.value)}
                          inputMode="decimal"
                          placeholder="0,00"
                        />
                      </FieldGroup>
                    </div>
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={saveTabDetails}
                      disabled={savingTabDetails}
                      className="w-full normal-case sm:w-auto"
                    >
                      {savingTabDetails ? 'Salvando...' : 'Salvar dados da mesa'}
                    </Button>
                  </div>
                </CollapsibleSection>

                {!isCompact && (
                  <div className="mb-3 flex shrink-0 gap-1 rounded-xl border border-border bg-surface-elevated p-1">
                    {(
                      [
                        { id: 'items' as const, label: 'Itens', badge: items.length },
                        { id: 'pay' as const, label: 'Pagamento' },
                      ] as const
                    ).map((tabItem) => (
                      <button
                        key={tabItem.id}
                        type="button"
                        onClick={() => setSidebarTab(tabItem.id)}
                        className={clsx(
                          'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition-colors',
                          sidebarTab === tabItem.id
                            ? 'bg-brand-600 text-white'
                            : 'text-neutral-400 hover:bg-white/5'
                        )}
                      >
                        {tabItem.label}
                        {'badge' in tabItem && tabItem.badge > 0 && (
                          <span
                            className={clsx(
                              'rounded-full px-1.5 py-0.5 text-[10px]',
                              sidebarTab === tabItem.id ? 'bg-white/20' : 'bg-brand-400/15 text-brand-300'
                            )}
                          >
                            {tabItem.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

              <ModalSection
                title={isCompact ? 'Itens na mesa' : undefined}
                className={clsx(
                  'flex h-full min-h-0 max-h-full flex-col overflow-hidden p-3 sm:p-4',
                  isCompact && comandaTab !== 'items' && 'hidden',
                  !isCompact && sidebarTab !== 'items' && 'hidden',
                  !isCompact && 'border-0 bg-transparent p-0 shadow-none'
                )}
              >
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
                  <div className="divide-y divide-border rounded-2xl border border-border bg-surface-elevated">
                    {visibleItems.map((item) => (
                      <div key={item.id} className="flex justify-between gap-4 px-4 py-3.5 sm:px-5 2xl:py-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-snug sm:text-base 2xl:text-[1.05rem]">
                            {item.quantity}x {item.product_name}
                          </p>
                          {item.notes && <p className="mt-1 text-xs text-neutral-500 2xl:text-sm">{item.notes}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold sm:text-base 2xl:text-[1.05rem]">
                            {formatCurrency(item.quantity * Number(item.unit_price))}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingConfirm({ type: 'cancelItem', itemId: item.id, itemName: item.product_name })
                            }
                            className="mt-1.5 text-xs font-bold text-red-400 hover:underline 2xl:text-sm"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ))}
                    {!items.length && (
                      <p className="p-8 text-center text-sm text-neutral-500 2xl:p-10 2xl:text-base">Nenhum item lançado ainda.</p>
                    )}
                  </div>
                  <ShowMoreToggle
                    hiddenCount={hiddenItemCount}
                    showingAll={showAllItems}
                    onToggle={() => setShowAllItems((v) => !v)}
                    className="mt-3"
                  />
                </div>
              </ModalSection>

              <ModalSection
                title={isCompact ? 'Pagamento e fechamento' : undefined}
                description={isCompact ? 'Registre os pagamentos. Custos e taxas são somados automaticamente.' : undefined}
                className={clsx(
                  'flex h-full min-h-0 max-h-full flex-col overflow-hidden p-3 sm:p-4',
                  isCompact && comandaTab !== 'pay' && 'hidden',
                  !isCompact && sidebarTab !== 'pay' && 'hidden',
                  !isCompact && 'border-0 bg-transparent p-0 shadow-none'
                )}
              >
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain 2xl:gap-5">
                  {!isCompact && (
                    <p className="shrink-0 text-xs text-neutral-500">
                      Registre pagamentos e confira o lucro antes de fechar. Use <strong className="text-ink">Remover</strong>{' '}
                      para corrigir um pagamento lançado errado.
                    </p>
                  )}
                  <div className="rounded-2xl border border-border bg-black/30 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Resumo financeiro automático</p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-neutral-400">Subtotal dos itens</span>
                        <strong className="text-ink">{formatCurrency(financials.subtotal)}</strong>
                      </div>
                      {financials.serviceAmount > 0 && (
                        <div className="flex justify-between gap-4">
                          <span className="text-neutral-400">Taxa de serviço</span>
                          <strong className="text-ink">{formatCurrency(financials.serviceAmount)}</strong>
                        </div>
                      )}
                      {financials.coverTotal > 0 && (
                        <div className="flex justify-between gap-4">
                          <span className="text-neutral-400">Couvert</span>
                          <strong className="text-ink">{formatCurrency(financials.coverTotal)}</strong>
                        </div>
                      )}
                      {financials.discount > 0 && (
                        <div className="flex justify-between gap-4 text-red-400">
                          <span>Desconto</span>
                          <strong>-{formatCurrency(financials.discount)}</strong>
                        </div>
                      )}
                      <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold">
                        <span className="text-ink">Total da comanda</span>
                        <strong className="text-brand-300">{formatCurrency(financials.total)}</strong>
                      </div>
                      <div className="flex justify-between gap-4 text-red-400">
                        <span>(-) Custos dos produtos</span>
                        <strong>{formatCurrency(financials.costTotal)}</strong>
                      </div>
                      <div className="flex justify-between gap-4 text-red-400">
                        <span>(-) Impostos</span>
                        <strong>{formatCurrency(financials.taxTotal)}</strong>
                      </div>
                      <div className="flex justify-between gap-4 text-red-400">
                        <span>(-) Taxas de pagamento</span>
                        <strong>{formatCurrency(financials.paymentFees)}</strong>
                      </div>
                      <div className="flex justify-between gap-4 border-t border-border pt-2 font-serif text-base font-bold">
                        <span className="text-ink">Lucro real</span>
                        <strong className={financials.netProfit >= 0 ? 'text-brand-300' : 'text-red-400'}>
                          {formatCurrency(financials.netProfit)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-1">
                    <FieldGroup label="Forma de pagamento">
                      <Select
                        value={paymentId}
                        onChange={(e) => setPaymentId(e.target.value)}
                      >
                        {payments.length ? (
                          payments.map((payment) => (
                            <option key={payment.id} value={payment.id}>
                              {payment.name}
                            </option>
                          ))
                        ) : (
                          <option value="">Cadastre em Taxas e ajustes</option>
                        )}
                      </Select>
                    </FieldGroup>
                    <FieldGroup label={isCashPayment ? 'Valor da conta (restante)' : 'Valor'}>
                      <Input
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="0,00"
                        inputMode="decimal"
                      />
                    </FieldGroup>
                  </div>

                  {isCashPayment && (
                    <div className="rounded-2xl border border-brand-400/30 bg-brand-400/5 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Banknote size={18} className="text-brand-300" />
                        <p className="text-sm font-semibold text-ink">Pagamento em dinheiro</p>
                      </div>
                      <FieldGroup label="Cliente pagou com (R$)">
                        <Input
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          placeholder={
                            Number.isFinite(paymentDueAmount) && paymentDueAmount > 0
                              ? `Mín. ${formatCurrency(paymentDueAmount)}`
                              : '0,00'
                          }
                          inputMode="decimal"
                          autoFocus
                        />
                      </FieldGroup>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {CASH_RECEIVE_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setCashReceived(String(preset));
                              if (maxPayment > 0) {
                                setPaymentAmount(maxPayment.toFixed(2));
                              }
                            }}
                            className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-xs font-bold text-neutral-300 transition-colors hover:border-brand-400 hover:text-brand-300"
                          >
                            {formatCashPresetLabel(preset)}
                          </button>
                        ))}
                        {maxPayment > 0.01 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentAmount(maxPayment.toFixed(2));
                              setCashReceived(maxPayment.toFixed(2));
                            }}
                            className="rounded-lg border border-brand-400/40 bg-brand-400/10 px-3 py-1.5 text-xs font-bold text-brand-300 transition-colors hover:border-brand-400"
                          >
                            Valor exato
                          </button>
                        )}
                      </div>
                      <div
                        className={clsx(
                          'mt-4 rounded-xl border px-4 py-3 text-center',
                          cashReceivedInsufficient
                            ? 'border-red-500/30 bg-red-500/10'
                            : cashChangePreview > 0
                              ? 'border-brand-400/30 bg-brand-400/10'
                              : 'border-border bg-black/30'
                        )}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Troco</p>
                        <p
                          className={clsx(
                            'mt-1 font-serif text-3xl font-bold',
                            cashReceivedInsufficient
                              ? 'text-red-400'
                              : cashChangePreview > 0
                                ? 'text-brand-300'
                                : 'text-neutral-400'
                          )}
                        >
                          {cashReceivedInsufficient
                            ? 'Valor insuficiente'
                            : formatCurrency(cashChangePreview)}
                        </p>
                        {Number.isFinite(cashReceivedAmount) && cashReceivedAmount > 0 && !cashReceivedInsufficient && (
                          <p className="mt-1 text-xs text-neutral-500">
                            Recebido {formatCurrency(cashReceivedAmount)}
                            {Number.isFinite(paymentDueAmount) && paymentDueAmount > 0
                              ? ` · Conta ${formatCurrency(paymentDueAmount)}`
                              : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      size="md"
                      onClick={addPayment}
                      disabled={!cashSession}
                      className="normal-case sm:w-fit 2xl:w-full"
                    >
                      <Plus size={16} />
                      {isCashPayment && cashPaymentReady && cashChangePreview > 0
                        ? `Adicionar · troco ${formatCurrency(cashChangePreview)}`
                        : 'Adicionar pagamento'}
                    </Button>
                    {isCashPayment && !cashPaymentReady && cashReceived.trim() === '' && maxPayment > 0.01 && (
                      <p className="w-full text-xs text-neutral-500">
                        Informe quanto o cliente pagou (ex.: clique em R$ 50 ou R$ 100).
                      </p>
                    )}
                    {cashReceivedInsufficient && (
                      <p className="w-full text-xs text-red-400">
                        Valor recebido menor que a conta ({formatCurrency(paymentDueAmount)}).
                      </p>
                    )}
                    {isUnderpaid && maxPayment > 0.01 && (
                      <Button
                        variant="outline"
                        size="md"
                        type="button"
                        onClick={() => setPaymentAmount(maxPayment.toFixed(2))}
                        className="normal-case"
                      >
                        Pagar restante ({formatCurrency(maxPayment)})
                      </Button>
                    )}
                  </div>

                  {isOverpaid && (
                    <Alert variant="warning">
                      Pagamento excede o total em {formatCurrency(Math.abs(paymentDelta))}. Remova ou ajuste um
                      pagamento para fechar a venda.
                    </Alert>
                  )}

                  {!cashSession && (
                    <Alert variant="warning" className="mt-1">
                      Abra o caixa em{' '}
                      <Link href="/admin/caixa" className="font-semibold underline hover:text-amber-200">
                        Caixa
                      </Link>{' '}
                      para registrar pagamentos nesta comanda.
                    </Alert>
                  )}

                  {(tab.tab_payments || []).length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-1">
                      {tab.tab_payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-elevated px-4 py-3 sm:px-5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-ink">
                              {relationOne(payment.payment_methods)?.name || 'Pagamento'}
                            </p>
                            <p className="mt-0.5 font-serif text-lg font-bold text-brand-300">
                              {formatCurrency(payment.amount)}
                            </p>
                            {Number(payment.change_amount) > 0 && (
                              <p className="mt-1 text-xs text-neutral-500">
                                Recebido {formatCurrency(Number(payment.amount_received || 0))} · Troco{' '}
                                <span className="font-bold text-brand-300">
                                  {formatCurrency(Number(payment.change_amount))}
                                </span>
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setPendingConfirm({ type: 'removeTabPayment', paymentId: payment.id })}
                            aria-label="Remover pagamento"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/30 text-red-400 transition-colors hover:bg-red-500/10"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-neutral-500 2xl:py-6">
                      Nenhum pagamento registrado ainda.
                    </p>
                  )}

                  <div className="mt-auto grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                    <div className="rounded-xl border border-border bg-surface-elevated px-5 py-4 2xl:px-6 2xl:py-5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Total pago</p>
                      <p className="mt-2 font-serif text-2xl font-bold text-brand-300 2xl:text-3xl">{formatCurrency(paid)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-surface-elevated px-5 py-4 2xl:px-6 2xl:py-5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                        {isUnderpaid ? 'A receber' : isOverpaid ? 'Excedente' : 'Saldo'}
                      </p>
                      <p
                        className={clsx(
                          'mt-2 font-serif text-2xl font-bold 2xl:text-3xl',
                          isUnderpaid ? 'text-red-400' : isOverpaid ? 'text-amber-300' : 'text-brand-300'
                        )}
                      >
                        {formatCurrency(isOverpaid ? Math.abs(paymentDelta) : Math.max(0, paymentDelta))}
                      </p>
                    </div>
                  </div>
                </div>
              </ModalSection>
              </aside>
            </div>
          </div>
        </Modal>
      )}

      {closeConfirmOpen && tab && (
        <Modal
          onClose={() => setCloseConfirmOpen(false)}
          title="Confirmar fechamento"
          subtitle={tableDisplayLabel(selected?.name ?? tab.identifier)}
          description="Confira o troco antes de liberar a mesa."
          size="md"
          variant="center"
          motionPreset="fade"
          footer={
            <ModalFooter>
              <Button variant="secondary" size="md" onClick={() => setCloseConfirmOpen(false)} className="normal-case">
                Voltar
              </Button>
              <Button variant="primary" size="md" onClick={close} disabled={closing} className="normal-case">
                {closing ? 'Fechando...' : 'Confirmar e fechar mesa'}
              </Button>
            </ModalFooter>
          }
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-brand-400/30 bg-brand-400/10 px-4 py-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wide text-brand-300">Troco total</p>
              <p className="mt-1 font-serif text-3xl font-bold text-brand-300">{formatCurrency(totalCashChange)}</p>
            </div>
            <div className="space-y-2">
              {(tab.tab_payments || [])
                .filter((payment) => Number(payment.change_amount) > 0)
                .map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm"
                  >
                    <span className="text-neutral-400">
                      {relationOne(payment.payment_methods)?.name || 'Dinheiro'}
                    </span>
                    <span className="font-semibold text-ink">
                      {formatCurrency(Number(payment.amount_received || 0))} → troco{' '}
                      <span className="text-brand-300">{formatCurrency(Number(payment.change_amount))}</span>
                    </span>
                  </div>
                ))}
            </div>
            <Alert variant="info">
              O valor da comanda ({formatCurrency(financials.total)}) já está quitado. Devolva o troco ao cliente antes de
              fechar.
            </Alert>
          </div>
        </Modal>
      )}

      {moreActionsOpen && selected && tab && (
        <Modal
          open
          onClose={() => setMoreActionsOpen(false)}
          title="Mais ações"
          size="sm"
          variant="center"
          motionPreset="fade"
        >
          <div className="grid gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setMoreActionsOpen(false);
                void sendKitchen();
              }}
              disabled={!items.length}
              className="w-full normal-case justify-start"
            >
              <Printer size={16} />
              Imprimir cozinha
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setMoreActionsOpen(false);
                void sendCustomerReceipt();
              }}
              disabled={!items.length}
              className="w-full normal-case justify-start"
            >
              <Receipt size={16} />
              Imprimir conta do cliente
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setMoreActionsOpen(false);
                setSelected(null);
              }}
              className="w-full normal-case justify-start"
            >
              Voltar às mesas
            </Button>
            {(items.length > 0 || (tab.tab_payments?.length ?? 0) > 0) && (
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setMoreActionsOpen(false);
                  setPendingConfirm({
                    type: 'voidComanda',
                    hasContent: items.length > 0 || (tab.tab_payments?.length ?? 0) > 0,
                  });
                }}
                disabled={voidingComanda}
                className="w-full normal-case justify-start border-red-500/30 text-red-400 hover:border-red-500/50 hover:bg-red-500/10"
              >
                <Trash2 size={16} />
                {voidingComanda ? 'Cancelando...' : 'Cancelar comanda'}
              </Button>
            )}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={pendingConfirm !== null}
        title={
          pendingConfirm?.type === 'cancelItem'
            ? 'Remover item'
            : pendingConfirm?.type === 'removeTabPayment'
              ? 'Remover pagamento'
              : pendingConfirm?.type === 'removeSale'
                ? 'Remover venda'
                : 'Cancelar comanda'
        }
        description={
          pendingConfirm?.type === 'cancelItem'
            ? `Remover "${pendingConfirm.itemName}" da comanda?`
            : pendingConfirm?.type === 'removeTabPayment'
              ? 'Remover este pagamento da comanda?'
              : pendingConfirm?.type === 'removeSale'
                ? 'Remover esta venda do histórico? Use apenas para corrigir testes ou lançamentos errados.'
                : pendingConfirm?.type === 'voidComanda'
                  ? pendingConfirm.hasContent
                    ? 'Todos os itens e pagamentos serão removidos e a mesa ficará livre.'
                    : 'Cancelar esta comanda vazia e liberar a mesa?'
                  : ''
        }
        confirmLabel="Confirmar"
        destructive
        confirming={
          pendingConfirm?.type === 'removeSale'
            ? removingSaleId === pendingConfirm.saleId
            : pendingConfirm?.type === 'voidComanda'
              ? voidingComanda
              : false
        }
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          if (!pendingConfirm) return;
          if (pendingConfirm.type === 'cancelItem') {
            void cancelItem(pendingConfirm.itemId);
          } else if (pendingConfirm.type === 'removeTabPayment') {
            void removeTabPayment(pendingConfirm.paymentId);
          } else if (pendingConfirm.type === 'removeSale') {
            void removeSale(pendingConfirm.saleId);
          } else if (pendingConfirm.type === 'voidComanda') {
            void voidOpenComanda();
          }
          setPendingConfirm(null);
        }}
      />

      <FloatingToast toast={toast} onClose={clearToast} />
    </PageContainer>
  );
}
