'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { KabanasLogo } from '@/components/shared/KabanasLogo';
import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/utils';
import { isOverlayLocked, subscribeOverlayLock } from '@/lib/ui/overlay-lock';

interface Props {
  onLogout: () => void;
  scrollRootRef: React.RefObject<HTMLElement | null>;
}

/** Header mobile que some ao rolar para baixo ou com qualquer modal/overlay aberto. */
export function MobileAdminHeader({ onLogout, scrollRootRef }: Props) {
  const [hidden, setHidden] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const lastScrollTop = useRef(0);

  useEffect(() => subscribeOverlayLock((count) => setOverlayOpen(count > 0)), []);

  useEffect(() => {
    if (overlayOpen) setHidden(true);
    else if ((scrollRootRef.current?.scrollTop ?? 0) <= 8) setHidden(false);
  }, [overlayOpen, scrollRootRef]);

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;

    const onScroll = () => {
      if (isOverlayLocked() || overlayOpen) {
        setHidden(true);
        return;
      }

      const top = root.scrollTop;
      const delta = top - lastScrollTop.current;

      if (top <= 8) {
        setHidden(false);
      } else if (delta > 6) {
        setHidden(true);
      } else if (delta < -6) {
        setHidden(false);
      }

      lastScrollTop.current = top;
    };

    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [scrollRootRef, overlayOpen]);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 border-b border-white/5 bg-black text-white transition-transform duration-300 ease-out md:hidden',
        hidden ? '-translate-y-full pointer-events-none' : 'translate-y-0'
      )}
      aria-hidden={hidden}
    >
      <div className="bg-black" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex h-12 w-full max-w-[100vw] items-center justify-between gap-2 px-3 sm:h-14 sm:px-5">
          <Link href="/admin" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
            <span className="shrink-0">
              <KabanasLogo variant="badge" size="sm" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-base leading-tight text-white sm:text-lg">
                {BRAND.shortName}
              </span>
              <span className="mt-0.5 hidden text-[9px] font-semibold uppercase tracking-[0.16em] text-brand-300 min-[380px]:block">
                Gestão
              </span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-400 transition-colors hover:border-red-400/40 hover:text-red-300 sm:px-3 sm:py-2"
            >
              <LogOut size={13} />
              <span className="hidden min-[360px]:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
