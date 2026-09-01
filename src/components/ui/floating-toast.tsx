'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastState {
  id: number;
  text: string;
  variant: ToastVariant;
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'border-brand-400/40 bg-neutral-950/95 text-brand-300 shadow-glow',
  error: 'border-red-500/40 bg-neutral-950/95 text-red-300',
  info: 'border-sky-500/40 bg-neutral-950/95 text-sky-300',
};

const VARIANT_ICON: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

interface FloatingToastProps {
  toast: ToastState | null;
  onClose: () => void;
  durationMs?: number;
}

export function FloatingToast({ toast, onClose, durationMs }: FloatingToastProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!toast) return;
    const duration = durationMs ?? (toast.variant === 'error' ? 4200 : 2400);
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [toast, onClose, durationMs]);

  if (!mounted) return null;

  const Icon = toast ? VARIANT_ICON[toast.variant] : CheckCircle2;

  return createPortal(
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ type: 'spring', damping: 26, stiffness: 420 }}
          className={cn(
            'pointer-events-none fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[130] mx-auto flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3.5 backdrop-blur-md sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-6 sm:mx-0 md:bottom-6 md:left-auto md:right-8 md:top-auto',
            VARIANT_STYLES[toast.variant]
          )}
          role="status"
          aria-live="polite"
        >
          <Icon size={18} className="shrink-0" />
          <p className="text-sm font-semibold leading-snug">{toast.text}</p>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function useFloatingToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (text: string, variant: ToastVariant = 'success') => {
    setToast({ id: Date.now(), text, variant });
  };

  const clearToast = () => setToast(null);

  return { toast, showToast, clearToast };
}
