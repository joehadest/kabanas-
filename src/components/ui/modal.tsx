'use client';

import { useEffect, useCallback, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOverlayLock } from '@/lib/ui/use-overlay-lock';
import { useIsMobile } from '@/lib/ui/use-is-mobile';

interface ModalProps {
  open?: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  hero?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
  variant?: 'sheet' | 'center';
  /** Em mobile, força sheet mesmo se variant for center (padrão: true). */
  autoSheetOnMobile?: boolean;
  hideCloseButton?: boolean;
  hideHeader?: boolean;
  /** Ações no header (ex.: ícone excluir), à esquerda do fechar — padrão do modal de mesas. */
  headerActions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  footerClassName?: string;
  motionPreset?: 'default' | 'fade';
}

const SIZE_MAP: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-[min(96vw,100rem)]',
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants = {
  sheet: {
    hidden: { opacity: 0, y: '100%' },
    visible: { opacity: 1, y: 0 },
  },
  center: {
    hidden: { opacity: 0, scale: 0.96, y: 8 },
    visible: { opacity: 1, scale: 1, y: 0 },
  },
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
};

export function Modal({
  open = true,
  onClose,
  title,
  subtitle,
  description,
  children,
  footer,
  hero,
  size = 'md',
  variant = 'sheet',
  autoSheetOnMobile = true,
  hideCloseButton = false,
  hideHeader = false,
  headerActions,
  className,
  bodyClassName,
  footerClassName,
  motionPreset = 'default',
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();
  const effectiveVariant = autoSheetOnMobile && isMobile && variant === 'center' ? 'sheet' : variant;
  const isSheet = effectiveVariant === 'sheet';
  const motionVariant = motionPreset === 'fade' && !isMobile ? 'fade' : isSheet ? 'sheet' : 'center';

  useOverlayLock(Boolean(open));

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, handleKeyDown]);

  if (!mounted) return null;

  const showHeader = !hideHeader && (title || subtitle || description || !hideCloseButton);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            'fixed inset-0 z-[100] flex',
            isSheet
              ? 'items-end justify-center p-0 sm:items-center sm:p-4'
              : 'items-center justify-center p-3 sm:p-4'
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
        >
          <motion.div
            className="absolute inset-0 z-0 bg-black/80 backdrop-blur-[6px]"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            className={cn(
              'relative z-10 flex w-full min-h-0 touch-manipulation flex-col overflow-hidden',
              'border border-border bg-neutral-950',
              'shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.06)_inset]',
              isSheet
                ? 'max-h-[min(94dvh,94vh)] rounded-t-[1.25rem] sm:max-h-[90vh] sm:rounded-[1.25rem]'
                : 'max-h-[min(92dvh,90vh)] rounded-[1.25rem]',
              SIZE_MAP[size],
              className
            )}
            variants={panelVariants[motionVariant as keyof typeof panelVariants]}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={
              motionPreset === 'fade' && !isMobile
                ? { duration: 0.2 }
                : { type: 'spring', damping: 28, stiffness: 320 }
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 shrink-0 bg-gradient-to-r from-brand-500 via-brand-400 to-brand-300" />

            {isSheet && (
              <div className="flex shrink-0 justify-center pt-2.5 sm:hidden">
                <div className="h-1 w-11 rounded-full bg-neutral-600" />
              </div>
            )}

            {hero}

            {showHeader && (
              <div className="relative shrink-0 border-b border-border bg-neutral-950 px-4 py-3.5 sm:px-6 sm:py-4">
                <div
                  className={cn(
                    'flex items-start justify-between gap-4',
                    (headerActions || !hideCloseButton) && 'pr-[4.5rem] sm:pr-14'
                  )}
                >
                  <div className="min-w-0">
                    {subtitle && (
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-300">{subtitle}</p>
                    )}
                    {title && (
                      <h2
                        id="modal-title"
                        className={cn(
                          'font-serif font-bold leading-tight text-ink',
                          subtitle ? 'mt-1 text-xl sm:text-2xl' : 'text-xl sm:text-2xl'
                        )}
                      >
                        {title}
                      </h2>
                    )}
                    {description && (
                      <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{description}</p>
                    )}
                  </div>
                </div>
                <div className="absolute right-3 top-3 flex items-center gap-1 sm:right-5 sm:top-4">
                  {headerActions}
                  {!hideCloseButton && (
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Fechar"
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-elevated text-neutral-400 shadow-sm transition-all hover:border-brand-400 hover:bg-brand-400/10 hover:text-ink active:scale-95 sm:h-9 sm:w-9"
                    >
                      <X size={17} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div
              className={cn(
                'min-h-0 flex-1 overscroll-contain text-ink [-webkit-overflow-scrolling:touch]',
                !hero && 'px-4 py-4 sm:px-6 sm:py-5',
                bodyClassName?.includes('overflow-hidden') ? 'overflow-hidden' : 'overflow-y-auto',
                bodyClassName
              )}
            >
              {children}
            </div>

            {footer && (
              <div
                className={cn(
                  'shrink-0 border-t border-border bg-neutral-950 px-4 py-3 backdrop-blur-md sm:px-5 sm:py-4',
                  'shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.4)]',
                  'pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-4',
                  footerClassName
                )}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/**
 * Rodapé de modal responsivo.
 * - `default`: ações principais em 2 colunas no mobile (Cancelar | Salvar); `leading` para Excluir compacto
 * - `toolbar`: layout livre (ex.: comanda desktop com várias ações)
 */
export function ModalFooter({
  children,
  className,
  leading,
  layout = 'default',
}: {
  children: ReactNode;
  className?: string;
  /** Excluir / ação destrutiva — compacta no mobile, à esquerda no desktop */
  leading?: ReactNode;
  layout?: 'default' | 'toolbar';
}) {
  if (layout === 'toolbar') {
    return (
      <div
        className={cn(
          'flex flex-col gap-2.5 [&_button]:min-h-11 [&_button]:w-full',
          'sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:[&_button]:min-h-0 sm:[&_button]:w-auto',
          className
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end', className)}>
      {leading ? (
        <div className="flex justify-start sm:mr-auto sm:[&_button]:w-auto [&_button]:min-h-9 [&_button]:w-auto [&_button]:px-3 [&_button]:text-sm">
          {leading}
        </div>
      ) : null}
      <div
        className={cn(
          'grid w-full grid-cols-2 gap-2.5 has-[>:only-child]:grid-cols-1',
          'sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end',
          '[&_button]:min-h-11 [&_button]:w-full sm:[&_button]:min-h-0 sm:[&_button]:w-auto'
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex min-h-0 flex-col rounded-2xl border border-border bg-neutral-900 p-4 sm:p-5', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="font-serif text-base font-bold text-ink sm:text-lg">{title}</h3>}
            {description && <p className="mt-1 text-xs text-neutral-400">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function ModalAlert({
  children,
  variant = 'error',
  className,
}: {
  children: ReactNode;
  variant?: 'error' | 'warning' | 'info' | 'success';
  className?: string;
}) {
  const styles = {
    error: 'border-red-500/30 bg-red-500/10 text-red-300',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    info: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    success: 'border-brand-400/30 bg-brand-400/10 text-brand-300',
  };
  return (
    <div className={cn('rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed animate-fade-in', styles[variant], className)}>
      {children}
    </div>
  );
}
