'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Order, OrderStatus } from '@/lib/types/database';

/** Toca um beep curto via Web Audio API — evita depender de um arquivo .mp3 no bundle. */
function playAlertBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.55);
    // segundo "bip" para reforçar o alerta
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 1046;
      gain2.gain.setValueAtTime(0.001, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc2.connect(gain2).connect(ctx.destination);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.45);
    }, 220);
  } catch {
    // Autoplay pode ser bloqueado até o primeiro clique do usuário na página — sem problema, é best-effort.
  }
}

interface UseRealtimeOrdersOptions {
  storeId: string;
  initialOrders: Order[];
  soundEnabled?: boolean;
}

export function useRealtimeOrders({ storeId, initialOrders, soundEnabled = true }: UseRealtimeOrdersOptions) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const supabase = useRef(createClient()).current;

  useEffect(() => {
    const channel = supabase
      .channel(`orders-store-${storeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        (payload) => {
          const newOrder = payload.new as Order;
          setOrders((prev) => [newOrder, ...prev]);
          if (soundEnabled) playAlertBeep();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        (payload) => {
          const updated = payload.new as Order;
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, soundEnabled, supabase]);

  const updateStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      const previous = orders.find((o) => o.id === orderId)?.status;
      // Atualização otimista — a confirmação chega pelo evento UPDATE do realtime
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
      const { data, error } = await supabase.from('orders').update({ status }).eq('id', orderId).select('id');

      // RLS bloqueia silenciosamente (sem erro, 0 linhas) se a conta não for
      // admin/restaurant — sem checar `data`, o card pareceria ter avançado.
      if (error || !data || data.length === 0) {
        console.error('[orders] falha ao atualizar status:', error?.message ?? 'RLS bloqueou a atualização (0 linhas)');
        if (previous) setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: previous } : o)));
        alert('Não foi possível atualizar o pedido. Verifique se sua conta tem permissão de administrador.');
      }
    },
    [supabase, orders]
  );

  return { orders, updateStatus };
}
