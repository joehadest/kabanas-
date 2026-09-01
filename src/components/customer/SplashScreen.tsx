'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { KabanasLogo } from '@/components/shared/KabanasLogo';
import { BRAND } from '@/lib/brand';

interface Props {
  storeName?: string | null;
  tagline?: string | null;
  logoUrl?: string | null;
}

export function SplashScreen({ storeName, tagline }: Props) {
  const [mounted, setMounted] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (!isStandalone) {
      setMounted(false);
      return;
    }
    const leaveTimer = setTimeout(() => setLeaving(true), 900);
    const unmountTimer = setTimeout(() => setMounted(false), 1250);
    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!mounted) return null;

  const name = storeName || BRAND.name;

  return (
    <div
      className={clsx(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-kabanas-charcoal text-white transition-opacity duration-300',
        leaving ? 'opacity-0' : 'opacity-100'
      )}
    >
      <div className="animate-bounce-in">
        <KabanasLogo variant="badge" size="xl" className="shadow-glow-lg" />
      </div>
      <p className="mt-5 animate-fade-in-up font-display text-lg tracking-wide [animation-delay:150ms]">
        {name}
      </p>
      <p className="mt-1 animate-fade-in-up text-xs font-semibold uppercase tracking-[0.14em] text-brand-300 [animation-delay:200ms]">
        {tagline || BRAND.tagline}
      </p>
    </div>
  );
}
