'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Ellipsis, X } from 'lucide-react';
import { Dock } from '@/components/ui/dock-two';
import { cn } from '@/lib/utils';
import { subscribeOverlayLock } from '@/lib/ui/overlay-lock';
import { useOverlayLock } from '@/lib/ui/use-overlay-lock';
import { IconOverview, IconOrders, IconMenuBook, IconStock, IconClock, IconSettings } from './AdminDockIcons';

const ALL_LINKS = [
  { href: '/admin', label: 'Visão geral', shortLabel: 'Início', icon: IconOverview },
  { href: '/admin/pdv', label: 'Vendas e mesas', shortLabel: 'Vendas', icon: IconOrders },
  { href: '/admin/caixa', label: 'Caixa', shortLabel: 'Caixa', icon: IconOverview },
  { href: '/admin/cardapio', label: 'Cardápio', shortLabel: 'Menu', icon: IconMenuBook },
  { href: '/admin/precificacao', label: 'Precificação', shortLabel: 'Lucro', icon: IconClock },
  { href: '/admin/inventario', label: 'Inventário', shortLabel: 'Estoque', icon: IconStock },
  { href: '/admin/despesas', label: 'Despesas', shortLabel: 'Despesas', icon: IconStock },
  { href: '/admin/relatorios', label: 'Relatórios', shortLabel: 'Relatórios', icon: IconClock },
  { href: '/admin/impressao', label: 'Impressão', shortLabel: 'Imprimir', icon: IconSettings },
  { href: '/admin/configuracoes', label: 'Taxas e ajustes', shortLabel: 'Ajustes', icon: IconSettings },
] as const;

const PRIMARY_HREFS = new Set(['/admin', '/admin/pdv', '/admin/caixa', '/admin/cardapio']);

export function MobileAdminDock() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  useOverlayLock(moreOpen);
  useEffect(() => subscribeOverlayLock((count) => setOverlayOpen(count > 0)), []);

  const isActive = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));

  const primaryLinks = useMemo(() => ALL_LINKS.filter((link) => PRIMARY_HREFS.has(link.href)), []);
  const moreLinks = useMemo(() => ALL_LINKS.filter((link) => !PRIMARY_HREFS.has(link.href)), []);
  const moreActive = moreLinks.some((link) => isActive(link.href));
  const hideForModal = overlayOpen && !moreOpen;

  const dockItems = [
    ...primaryLinks.map((link) => ({
      icon: link.icon,
      label: link.shortLabel,
      isActive: isActive(link.href),
      onClick: () => {
        setMoreOpen(false);
        router.push(link.href);
      },
    })),
    {
      icon: Ellipsis,
      label: 'Mais',
      isActive: moreActive || moreOpen,
      onClick: () => setMoreOpen((open) => !open),
    },
  ];

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Mais opções">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Fechar menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] mx-3 rounded-2xl border border-white/10 bg-neutral-950 p-3 shadow-modal">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-300">Mais opções</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/5 hover:text-white"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {moreLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return (
                  <button
                    key={link.href}
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      router.push(link.href);
                    }}
                    className={
                      active
                        ? 'flex flex-col items-center gap-1.5 rounded-xl border border-brand-400/40 bg-brand-400/10 px-2 py-3 text-brand-300'
                        : 'flex flex-col items-center gap-1.5 rounded-xl border border-white/5 bg-white/[0.03] px-2 py-3 text-neutral-300 hover:border-white/15 hover:bg-white/5'
                    }
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-center text-[10px] font-bold leading-tight">{link.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div
        className={cn(
          'pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] transition-transform duration-300 ease-out md:hidden',
          hideForModal && 'translate-y-[140%]'
        )}
      >
        <div className={cn('pointer-events-auto mx-auto w-full max-w-md', hideForModal && 'pointer-events-none')}>
          <Dock items={dockItems} />
        </div>
      </div>
    </>
  );
}
