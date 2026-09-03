'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useOverlayLock } from '@/lib/ui/use-overlay-lock';
import { useIsMobile } from '@/lib/ui/use-is-mobile';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirming?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmação leve — sheet no mobile, card central no desktop. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirming = false,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isMobile = useIsMobile();
  useOverlayLock(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirming) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, confirming, onCancel]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[100] flex p-4',
        isMobile ? 'items-end justify-center px-0 pb-0' : 'items-center justify-center'
      )}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75"
        aria-label="Fechar"
        onClick={confirming ? undefined : onCancel}
      />
      <div
        className={cn(
          'relative z-10 w-full border border-border bg-neutral-950 p-5 shadow-panel animate-fade-in',
          isMobile
            ? 'max-w-none rounded-t-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]'
            : 'max-w-sm rounded-2xl'
        )}
      >
        {isMobile && (
          <div className="mb-3 flex justify-center">
            <div className="h-1 w-11 rounded-full bg-neutral-600" />
          </div>
        )}
        <h2 className="font-serif text-lg font-bold text-ink">{title}</h2>
        <div className="mt-2 text-sm leading-relaxed text-neutral-400">{description}</div>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:flex sm:justify-end">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={confirming}
            className="min-h-11 w-full normal-case sm:min-h-0 sm:w-auto"
          >
            {cancelLabel}
          </Button>
          <Button
            variant="brand"
            onClick={onConfirm}
            disabled={confirming}
            className={cn(
              'min-h-11 w-full normal-case sm:min-h-0 sm:w-auto',
              destructive && 'bg-red-600 hover:bg-red-500'
            )}
          >
            {confirming ? 'Aguarde...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
