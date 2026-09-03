'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TableOrderItem } from '@/lib/types/database';

/** Acompanha em tempo real o status dos itens de um pedido de mesa (tab_items). */
export function useRealtimeTableOrder(tableOrderId: string, initialItems: TableOrderItem[]) {
  const [items, setItems] = useState<TableOrderItem[]>(initialItems);
  const supabase = useRef(createClient()).current;

  useEffect(() => {
    const channel = supabase
      .channel(`table-order-${tableOrderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tab_items', filter: `table_order_id=eq.${tableOrderId}` },
        (payload) => {
          const updated = payload.new as TableOrderItem;
          setItems((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableOrderId, supabase]);

  return items;
}
