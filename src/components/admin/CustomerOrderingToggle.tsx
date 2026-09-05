'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Switch } from '@/components/ui/switch';
import { FloatingToast, useFloatingToast } from '@/components/ui/floating-toast';

interface Props {
  storeId: string;
  initialEnabled: boolean;
}

/**
 * Liga/desliga o pedido pelo cardápio público do cliente. Desativado, o
 * cardápio (/cardapio) fica só para consulta — o cliente vê os produtos e
 * preços, mas não monta nem envia pedido; os garçons continuam lançando
 * tudo normalmente pelo PDV.
 */
export function CustomerOrderingToggle({ storeId, initialEnabled }: Props) {
  const { toast, showToast, clearToast } = useFloatingToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  const handleChange = async (next: boolean) => {
    setEnabled(next);
    setSaving(true);
    const { data, error } = await createClient()
      .from('store_settings')
      .update({ customer_ordering_enabled: next })
      .eq('id', storeId)
      .select('id');
    setSaving(false);

    if (error || !data || data.length === 0) {
      setEnabled(!next);
      showToast('Não foi possível salvar. Verifique se sua conta tem permissão de administrador.', 'error');
      return;
    }

    showToast(
      next
        ? 'Clientes já podem montar e enviar pedidos pelo cardápio novamente.'
        : 'Cardápio do cliente agora é só para visualização — os pedidos ficam por conta dos garçons.',
      'success'
    );
  };

  return (
    <>
      <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border bg-surface-elevated px-4 py-3.5">
        <span className="min-w-0">
          <span className="block text-sm font-bold leading-tight text-ink">Clientes podem pedir pelo cardápio</span>
          <span className="mt-1 block text-xs leading-relaxed text-neutral-500">
            Desative para deixar o cardápio só para consulta: o cliente vê os produtos e preços, mas não escolhe
            quantidade, opções nem envia pedido. Os garçons continuam lançando tudo normalmente pelo PDV.
          </span>
        </span>
        <Switch
          checked={enabled}
          onCheckedChange={handleChange}
          disabled={saving}
          aria-label="Clientes podem pedir pelo cardápio"
        />
      </label>
      <FloatingToast toast={toast} onClose={clearToast} />
    </>
  );
}
