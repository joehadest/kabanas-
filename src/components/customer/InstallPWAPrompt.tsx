'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useCartStore } from '@/lib/store/cart-store';
import { StoreLogo } from '@/components/shared/StoreLogo';

const DISMISS_KEY = 'kabanas-install-dismissed-at';
const DISMISS_DAYS = 7;

interface Props {
  storeName?: string | null;
  logoUrl?: string | null;
}

export function InstallPWAPrompt({ storeName, logoUrl }: Props) {
  const { canInstall, isInstalled, isIos, promptInstall } = useInstallPrompt();
  const [visible, setVisible] = useState(false);
  const cartCount = useCartStore((s) => s.itemCount());

  useEffect(() => {
    if (isInstalled) return;
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    const dismissedRecently = dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DAYS * 86_400_000;
    if (dismissedRecently) return;
    if (canInstall || isIos) setVisible(true);
  }, [canInstall, isIos, isInstalled]);

  if (!visible) return null;

  const name = storeName || 'Kabanas';
  const raisedForCart = cartCount > 0;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const handleInstall = async () => {
    if (isIos) return; // instrução manual abaixo
    const outcome = await promptInstall();
    if (outcome !== 'unavailable') setVisible(false);
  };

  return (
    <div
      className={clsx(
        'fixed inset-x-3 z-50 rounded-2xl border border-white/10 bg-kabanas-charcoal p-4 text-white shadow-floating animate-slide-up',
        raisedForCart
          ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-[5.75rem]'
          : 'bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))]'
      )}
    >      <div className="flex items-start gap-3">
        <StoreLogo logoUrl={logoUrl} name={name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Instale o app {name}</p>
          {isIos ? (
            <p className="mt-0.5 text-xs text-neutral-300">
              Toque em <span className="font-medium text-brand-400">Compartilhar</span> e depois em{' '}
              <span className="font-medium text-brand-400">&quot;Adicionar à Tela de Início&quot;</span>.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-neutral-300">Peça mais rápido, direto da tela inicial do seu celular.</p>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Fechar"
          className="px-1 text-sm text-neutral-400 transition-colors hover:text-white"
        >
          ✕
        </button>
      </div>
      {!isIos && (
        <button
          onClick={handleInstall}
          className="mt-3 w-full rounded-xl bg-brand-400 py-2.5 text-sm font-bold text-neutral-950 transition-all hover:bg-brand-300 active:scale-[0.98]"
        >
          Instalar aplicativo
        </button>
      )}
    </div>
  );
}
