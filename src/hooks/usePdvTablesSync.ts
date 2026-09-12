'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const OPEN_TAB_STATUSES = new Set(['open', 'payment', 'attention']);

const TABLES_SELECT =
  'id,name,seats,area_id,is_active,sort_order,dining_areas(name),tabs(id,status,identifier,customer_name,waiter_name,guest_count,service_rate,cover_charge,discount_amount,tab_items(id,product_name,quantity,unit_price,unit_cost,tax_rate,notes,status),tab_payments(id,amount,amount_received,change_amount,payment_method_id,payment_methods(name,fee_rate)))';

const TABLES_SELECT_BASE =
  'id,name,seats,area_id,is_active,sort_order,dining_areas(name),tabs(id,status,identifier,customer_name,waiter_name,guest_count,service_rate,cover_charge,discount_amount,tab_items(id,product_name,quantity,unit_price,unit_cost,tax_rate,notes,status),tab_payments(id,amount,payment_method_id,payment_methods(name,fee_rate)))';

export type PdvArea = { id: string; name: string };

export type PdvTable = {
  id: string;
  name: string;
  seats: number;
  area_id: string | null;
  is_active: boolean;
  sort_order: number;
  dining_areas: { name: string }[];
  tabs: PdvTab[];
};

export type PdvTab = {
  id: string;
  status: 'open' | 'payment' | 'attention' | 'closed' | 'cancelled';
  identifier: string | null;
  customer_name: string | null;
  waiter_name: string | null;
  guest_count: number;
  service_rate: number;
  cover_charge: number;
  discount_amount: number;
  tab_items: PdvTabItem[];
  tab_payments: PdvTabPayment[];
};

export type PdvTabItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  tax_rate: number;
  notes: string | null;
  status: string;
};

export type PdvTabPayment = {
  id: string;
  amount: number;
  amount_received?: number | null;
  change_amount?: number | null;
  payment_method_id: string | null;
  payment_methods: { name: string; fee_rate: number } | { name: string; fee_rate: number }[] | null;
};

function normalizeTables(rows: PdvTable[]): PdvTable[] {
  return rows.map((table) => ({
    ...table,
    tabs: (table.tabs ?? []).filter((tab) => OPEN_TAB_STATUSES.has(tab.status)),
  }));
}

async function queryStoreTables(storeId: string) {
  const supabase = createClient();
  const withChange = await supabase
    .from('dining_tables')
    .select(TABLES_SELECT)
    .eq('store_id', storeId)
    .order('sort_order')
    .order('name');

  if (!withChange.error) {
    return normalizeTables((withChange.data ?? []) as PdvTable[]);
  }

  const missingChange =
    withChange.error.message.includes('amount_received') || withChange.error.message.includes('change_amount');

  if (!missingChange) {
    throw new Error(withChange.error.message);
  }

  const fallback = await supabase
    .from('dining_tables')
    .select(TABLES_SELECT_BASE)
    .eq('store_id', storeId)
    .order('sort_order')
    .order('name');

  if (fallback.error) throw new Error(fallback.error.message);
  return normalizeTables((fallback.data ?? []) as PdvTable[]);
}

/**
 * Mantém o mapa de mesas do PDV sincronizado entre dispositivos via Realtime
 * (+ polling de segurança, como no KDS).
 */
export function usePdvTablesSync(storeId: string, initialTables: PdvTable[]) {
  const [tables, setTables] = useState(initialTables);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetching = useRef(false);

  const refreshTables = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const next = await queryStoreTables(storeId);
      setTables(next);
      return next;
    } catch (error) {
      console.error('[pdv] falha ao sincronizar mesas:', error);
      return null;
    } finally {
      fetching.current = false;
    }
  }, [storeId]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      void refreshTables();
    }, 250);
  }, [refreshTables]);

  useEffect(() => {
    setTables(initialTables);
  }, [initialTables]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`pdv-floor-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tabs', filter: `store_id=eq.${storeId}` },
        () => scheduleRefresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dining_tables', filter: `store_id=eq.${storeId}` },
        () => scheduleRefresh()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tab_items' }, () => scheduleRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tab_payments' }, () => scheduleRefresh())
      .subscribe();

    const poll = window.setInterval(() => {
      void refreshTables();
    }, 15_000);

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [storeId, refreshTables, scheduleRefresh]);

  return { tables, setTables, refreshTables };
}
