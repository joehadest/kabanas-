'use client';

import { useEffect, useState } from 'react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
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

  useEffect(() => {
    if (isInstalled) return;
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    const dismissedRecently = dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DAYS * 86_400_000;
    if (dismissedRecently) return;
    if (canInstall || isIos) setVisible(true);
  }, [canInstall, isIos, isInstalled]);

  if (!visible) return null;

  const name = storeName || 'Kabanas';

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
    <div className="fixed inset-x-3 bottom-3 z-50 rounded-2xl bg-neutral-900 text-white p-4 shadow-floating safe-bottom animate-slide-up">
      <div className="flex items-start gap-3">
        <StoreLogo logoUrl={logoUrl} name={name} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Instale o app {name}</p>
          {isIos ? (
            <p className="text-xs text-neutral-300 mt-0.5">
              Toque em <span className="font-medium text-brand-400">Compartilhar</span> e depois em{' '}
              <span className="font-medium text-brand-400">"Adicionar à Tela de Início"</span>.
            </p>
          ) : (
            <p className="text-xs text-neutral-300 mt-0.5">Peça mais rápido, direto da tela inicial do seu celular.</p>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Fechar"
          className="text-neutral-400 text-sm px-1 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>
      {!isIos && (
        <button
          onClick={handleInstall}
          className="mt-3 w-full rounded-xl bg-brand-500 text-neutral-900 py-2.5 text-sm font-bold active:scale-[0.98] hover:bg-brand-400 transition-all"
        >
          Instalar aplicativo
        </button>
      )}
    </div>
  );
}
