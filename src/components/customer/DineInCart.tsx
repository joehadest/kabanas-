'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/format';
import { useCartStore } from '@/lib/store/cart-store';
import { useDineInStore } from '@/lib/store/dine-in-store';
import { Button } from '@/components/ui/button';
import { FieldGroup, Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

export interface DineInTable {
  id: string;
  name: string;
  seats: number;
  areaName: string | null;
}

interface Props {
  tables: DineInTable[];
  isStoreOpen: boolean;
}

/** Carrinho do cardápio presencial: sem entrega/pagamento, só mesa + nome + observações. */
export function DineInCart({ tables, isStoreOpen }: Props) {
  const itemCount = useCartStore((s) => s.itemCount());
  const subtotal = useCartStore((s) => s.subtotal());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    useCartStore.persist.rehydrate();
    useDineInStore.persist.rehydrate();
  }, []);

  if (itemCount === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-4 right-4 z-40 mx-auto flex h-14 max-w-md items-center justify-between rounded-2xl border border-brand-300/60 bg-brand-400 px-5 text-neutral-950 shadow-floating transition-all animate-bounce-in hover:bg-brand-300 hover:shadow-glow active:scale-[0.98] sm:bottom-6"
      >
        <span className="flex items-center gap-3 font-bold text-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 text-xs text-brand-300 animate-pop">
            {itemCount}
          </span>
          <ShoppingBag size={18} />
          Ver pedido
        </span>
        <span className="font-black text-sm">{formatCurrency(subtotal)}</span>
      </button>

      {open && <DineInDrawer tables={tables} isStoreOpen={isStoreOpen} onClose={() => setOpen(false)} />}
    </>
  );
}

function DineInDrawer({ tables, isStoreOpen, onClose }: Props & { onClose: () => void }) {
  const router = useRouter();
  const { items, updateQuantity, subtotal, clear } = useCartStore();
  const { tableId: savedTableId, customerName: savedName, setTableId, setCustomerName } = useDineInStore();

  const [step, setStep] = useState<'cart' | 'details'>('cart');
  const [tableId, setLocalTableId] = useState(savedTableId ?? '');
  const [customerName, setLocalName] = useState(savedName ?? '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cartTotal = subtotal();

  const groupedTables = useMemo(() => {
    const groups = new Map<string, DineInTable[]>();
    for (const table of tables) {
      const key = table.areaName ?? 'Salão';
      groups.set(key, [...(groups.get(key) ?? []), table]);
    }
    return Array.from(groups.entries());
  }, [tables]);

  const handleSubmit = async () => {
    if (!tableId) {
      setError('Selecione a mesa antes de enviar.');
      return;
    }
    if (items.length === 0) {
      setError('Seu pedido está vazio.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      p_table_id: tableId,
      p_customer_name: customerName.trim() || null,
      p_notes: notes.trim() || null,
      p_items: items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        notes: item.notes ?? null,
        option_ids: item.options.map((o) => o.optionId),
      })),
    };

    const { data, error: rpcError } = await createClient().rpc('submit_table_order', payload);

    if (rpcError || !data) {
      setError(rpcError?.message ?? 'Não foi possível enviar o pedido. Tente novamente.');
      setSubmitting(false);
      return;
    }

    setTableId(tableId);
    setCustomerName(customerName.trim());
    clear();
    onClose();
    router.push(`/cardapio/pedido/${data}`);
  };

  return (
    <Modal
      onClose={onClose}
      title={step === 'cart' ? 'Seu pedido' : 'Enviar para a mesa'}
      subtitle={step === 'cart' ? `${items.length} ${items.length === 1 ? 'item' : 'itens'}` : 'Confirme antes de enviar'}
      size="md"
      bodyClassName="space-y-3 pb-1"
      footer={
        step === 'cart' ? (
          <div className="space-y-3">
            <div className="flex justify-between border-t border-border pt-3 font-serif text-lg font-bold text-ink">
              <span>Total</span>
              <span>{formatCurrency(cartTotal)}</span>
            </div>
            {!isStoreOpen && (
              <p className="text-xs text-amber-500">A loja está fechada no momento — o pedido pode demorar para ser aceito.</p>
            )}
            <Button variant="brand" size="lg" fullWidth onClick={() => setStep('details')} className="normal-case">
              Escolher mesa e enviar
            </Button>
          </div>
        ) : (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="secondary" size="md" onClick={() => setStep('cart')} className="normal-case sm:w-auto">
              Voltar
            </Button>
            <Button
              variant="brand"
              size="md"
              onClick={handleSubmit}
              disabled={submitting || !tableId}
              className="normal-case sm:min-w-[12rem]"
              fullWidth
            >
              {submitting ? 'Enviando...' : `Enviar pedido · ${formatCurrency(cartTotal)}`}
            </Button>
          </div>
        )
      }
    >
      {step === 'cart' ? (
        items.map((item) => (
          <div key={item.cartItemId} className="card-muted flex gap-3 p-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-800">
              {item.imageUrl && <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-base font-bold text-ink">{item.name}</p>
              {item.options.length > 0 && (
                <p className="truncate text-xs text-neutral-500">{item.options.map((o) => o.name).join(', ')}</p>
              )}
              <p className="mt-1 text-sm font-bold text-ink">{formatCurrency(item.unitPrice * item.quantity)}</p>
            </div>
            <div className="flex h-fit items-center gap-1 overflow-hidden rounded-lg border border-border">
              <button
                onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                className="flex h-8 w-8 items-center justify-center text-sm transition-colors hover:bg-brand-400/15"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                className="flex h-8 w-8 items-center justify-center text-sm transition-colors hover:bg-brand-400/15"
              >
                +
              </button>
            </div>
          </div>
        ))
      ) : (
        <>
          <FieldGroup label="Mesa">
            <Select value={tableId} onChange={(e) => setLocalTableId(e.target.value)} disabled={tables.length === 0}>
              <option value="">Selecione a mesa...</option>
              {groupedTables.map(([areaName, areaTables]) => (
                <optgroup key={areaName} label={areaName}>
                  {areaTables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            {tables.length === 0 && (
              <p className="mt-1.5 text-xs text-amber-500">Nenhuma mesa disponível no momento. Chame a equipe.</p>
            )}
          </FieldGroup>
          <FieldGroup label="Seu nome (opcional)">
            <Input
              value={customerName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder="Como podemos te chamar?"
              autoComplete="name"
            />
          </FieldGroup>
          <FieldGroup label="Observações (opcional)">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex: sem cebola, alergia a amendoim..."
            />
          </FieldGroup>
          {error && <p className="text-sm text-red-500 animate-fade-in">{error}</p>}
        </>
      )}
    </Modal>
  );
}
