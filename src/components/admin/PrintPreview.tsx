'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils/format';
import type { CustomerReceiptPayload, KitchenTicketPayload, PrintJobType } from '@/lib/printing/types';
import { cn } from '@/lib/utils';

interface Props {
  jobType: PrintJobType;
  payload: KitchenTicketPayload | CustomerReceiptPayload;
  paperWidth?: 58 | 80;
  className?: string;
}

function isKitchen(payload: KitchenTicketPayload | CustomerReceiptPayload): payload is KitchenTicketPayload {
  return 'items' in payload && !('subtotal' in payload);
}

export function PrintPreview({ jobType, payload, paperWidth = 80, className }: Props) {
  const widthClass = paperWidth === 58 ? 'max-w-[220px]' : 'max-w-[302px]';
  // Evita mismatch de hidratação: o horário atual difere entre o render no
  // servidor e o momento da hidratação no cliente. Começa vazio (igual nos
  // dois lados) e só preenche depois de montar, só no cliente.
  const [now, setNow] = useState('');
  useEffect(() => {
    setNow(new Date().toLocaleString('pt-BR'));
  }, []);

  if (jobType === 'kitchen_ticket' || isKitchen(payload)) {
    return (
      <div
        className={cn(
          'mx-auto rounded-lg border-2 border-dashed border-neutral-600 bg-white font-mono text-[11px] leading-snug text-black shadow-inner',
          widthClass,
          className
        )}
      >
        <div className="border-b border-black border-dashed px-3 py-2 text-center">
          <p className="text-xs font-black uppercase tracking-widest">Cozinha / Bar</p>
          <p className="mt-1 text-lg font-black">{payload.tab}</p>
        </div>
        <div className="space-y-3 px-3 py-3">
          {payload.items.map((item, index) => (
            <div key={`${item.name}-${index}`} className="border-b border-neutral-300 pb-2 last:border-0">
              <p className="text-sm font-black">
                {item.quantity}x {item.name}
              </p>
              {item.notes && <p className="mt-0.5 text-[10px] font-bold uppercase text-neutral-700">» {item.notes}</p>}
            </div>
          ))}
        </div>
        <p className="border-t border-dashed border-black px-3 py-2 text-center text-[9px] text-neutral-600">
          {now}
        </p>
      </div>
    );
  }

  const receipt = payload as CustomerReceiptPayload;

  return (
    <div
      className={cn(
        'mx-auto rounded-lg border-2 border-dashed border-neutral-600 bg-white font-mono text-[11px] leading-snug text-black shadow-inner',
        widthClass,
        className
      )}
    >
      <div className="border-b border-black border-dashed px-3 py-2 text-center">
        <p className="text-xs font-black uppercase">{receipt.store_name || 'Kabanas'}</p>
        <p className="mt-1 text-sm font-bold">Conta do cliente</p>
        <p className="text-lg font-black">{receipt.tab}</p>
        {(receipt.customer || receipt.waiter) && (
          <p className="mt-1 text-[10px] text-neutral-700">
            {receipt.customer && `Cliente: ${receipt.customer}`}
            {receipt.customer && receipt.waiter && ' · '}
            {receipt.waiter && `Garçom: ${receipt.waiter}`}
          </p>
        )}
      </div>

      <div className="divide-y divide-neutral-300 px-3">
        {receipt.items.map((item, index) => (
          <div key={`${item.name}-${index}`} className="flex justify-between gap-2 py-1.5">
            <span className="min-w-0 flex-1">
              {item.quantity}x {item.name}
              {item.notes && <span className="block text-[9px] text-neutral-600">{item.notes}</span>}
            </span>
            <span className="shrink-0 font-bold">{formatCurrency(item.total)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-0.5 border-t border-dashed border-black px-3 py-2 text-[10px]">
        <Row label="Subtotal" value={formatCurrency(receipt.subtotal)} />
        {(receipt.service_amount ?? 0) > 0 && (
          <Row label={`Serviço (${receipt.service_rate ?? 0}%)`} value={formatCurrency(receipt.service_amount!)} />
        )}
        {(receipt.cover_charge ?? 0) > 0 && <Row label="Couvert" value={formatCurrency(receipt.cover_charge!)} />}
        {(receipt.discount ?? 0) > 0 && <Row label="Desconto" value={`-${formatCurrency(receipt.discount!)}`} />}
        <div className="flex justify-between border-t border-black pt-1 text-sm font-black">
          <span>TOTAL</span>
          <span>{formatCurrency(receipt.total)}</span>
        </div>
        {receipt.payments?.map((payment, index) => (
          <div key={index} className="pt-1">
            <Row label={payment.method} value={formatCurrency(payment.amount)} />
            {payment.change != null && payment.change > 0 && (
              <Row label="Troco" value={formatCurrency(payment.change)} bold />
            )}
          </div>
        ))}
        {(receipt.remaining ?? 0) > 0.01 && (
          <Row label="A pagar" value={formatCurrency(receipt.remaining!)} bold />
        )}
      </div>

      <p className="border-t border-dashed border-black px-3 py-2 text-center text-[9px] text-neutral-600">
        Obrigado pela preferência!
      </p>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-2', bold && 'font-bold')}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
