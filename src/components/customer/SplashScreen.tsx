'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { StoreLogo } from '@/components/shared/StoreLogo';

interface Props {
  storeName?: string | null;
  tagline?: string | null;
  logoUrl?: string | null;
}

export function SplashScreen({ storeName, tagline, logoUrl }: Props) {
  const [mounted, setMounted] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Só mostra no primeiro carregamento do PWA instalado (evita "piscar" a cada navegação em SPA)
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

  const name = storeName || 'Kabanas Delivery';

  return (
    <div
      className={clsx(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-neutral-900 text-white transition-opacity duration-300',
        leaving ? 'opacity-0' : 'opacity-100'
      )}
    >
      <div className="animate-bounce-in shadow-glow rounded-3xl">
        <StoreLogo logoUrl={logoUrl} name={name} size="lg" className="text-4xl" />
      </div>
      <p className="text-lg font-semibold tracking-tight mt-4 animate-fade-in-up [animation-delay:150ms]">{name}</p>
      <p className="text-sm text-neutral-400 mt-1 animate-fade-in-up [animation-delay:250ms]">
        {tagline || 'Sua fome, no caminho certo.'}
      </p>
    </div>
  );
}
