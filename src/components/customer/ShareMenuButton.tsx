'use client';

import { useState } from 'react';
import { Copy, MessageCircle, Share2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

interface Props {
  storeName: string;
  storeSlug: string;
}

export function ShareMenuButton({ storeName, storeSlug }: Props) {
  const [sharing, setSharing] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const text = `Confira o cardápio do ${storeName}!`;

  const handleShare = async () => {
    // Share the public menu, without table, order or tracking parameters.
    const url = new URL(`/cardapio/${encodeURIComponent(storeSlug)}`, window.location.origin).href;
    setCopyMessage('');
    if (typeof navigator.share !== 'function') {
      setFallbackUrl(url);
      return;
    }
    setSharing(true);
    try {
      await navigator.share({ title: `Cardápio — ${storeName}`, text, url });
    } catch (error) {
      // Closing the system share sheet is a normal cancellation.
      if (!(error instanceof Error && error.name === 'AbortError')) setFallbackUrl(url);
    } finally {
      setSharing(false);
    }
  };

  const copyLink = async () => {
    if (!fallbackUrl) return;
    try {
      await navigator.clipboard.writeText(fallbackUrl);
      setCopyMessage('Link copiado! Cole na conversa que preferir.');
    } catch {
      setCopyMessage('Não foi possível copiar. Use o botão do WhatsApp para enviar.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        disabled={sharing}
        aria-label="Compartilhar cardápio"
        title="Compartilhar cardápio"
        className="flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-brand-400/30 bg-brand-400/10 px-3 text-sm font-semibold text-brand-300 transition-colors hover:bg-brand-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60"
      >
        <Share2 size={18} aria-hidden="true" />
        <span className="hidden sm:inline">Compartilhar</span>
      </button>
      {fallbackUrl && (
        <Modal
          title="Compartilhar cardápio"
          description={`Envie o cardápio do ${storeName} para um amigo.`}
          onClose={() => setFallbackUrl(null)}
          size="sm"
          variant="center"
          trapFocus
        >
          <div className="space-y-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${fallbackUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-400 px-4 text-sm font-semibold text-neutral-950 hover:bg-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <MessageCircle size={18} aria-hidden="true" />
              Enviar pelo WhatsApp
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold text-neutral-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <Copy size={18} aria-hidden="true" />
              Copiar link
            </button>
            <p role="status" className="text-sm text-neutral-400">{copyMessage}</p>
          </div>
        </Modal>
      )}
    </>
  );
}
