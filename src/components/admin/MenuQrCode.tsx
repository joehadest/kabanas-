'use client';

import { useEffect, useState } from 'react';
import { Download, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  url: string;
  storeSlug: string;
}

/** Gera e exibe o QR Code do cardápio (link geral, mesma URL para todas as mesas). */
export function MenuQrCode({ url, storeSlug }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(url, { width: 480, margin: 2, color: { dark: '#171612', light: '#ffffff' } }).then((generated) => {
        if (!cancelled) setDataUrl(generated);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white p-2">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt={`QR Code do cardápio ${storeSlug}`} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-neutral-400">Gerando...</span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-sm text-neutral-400">
          Imprima este QR Code e deixe disponível nas mesas. O cliente escaneia, abre o cardápio e escolhe a mesa antes de enviar o
          pedido.
        </p>
        <p className="truncate rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs text-neutral-300">{url}</p>
        <div className="flex flex-wrap gap-2">
          <a
            href={dataUrl ?? undefined}
            download={`cardapio-${storeSlug}-qrcode.png`}
            aria-disabled={!dataUrl}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-400 px-4 text-sm font-bold uppercase tracking-wide text-neutral-950 shadow-sm transition-all hover:bg-brand-300 hover:shadow-glow active:scale-[0.98] aria-disabled:pointer-events-none aria-disabled:opacity-50"
          >
            <Download size={15} />
            Baixar QR Code
          </a>
          <Button type="button" variant="secondary" size="md" onClick={handleCopy} className="normal-case">
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Link copiado' : 'Copiar link'}
          </Button>
        </div>
      </div>
    </div>
  );
}
