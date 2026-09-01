'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { LogOut, Store } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { MagneticDock, type DockItemData } from '@/components/ui/magnetic-dock';
import { KabanasLogo } from '@/components/shared/KabanasLogo';
import { BRAND } from '@/lib/brand';
import { IconOverview, IconOrders, IconMenuBook, IconStock, IconClock, IconSettings } from './AdminDockIcons';

const NAV_LINKS = [
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
];

interface Props {
  userEmail: string;
  children: React.ReactNode;
}

export function AdminShell({ userEmail, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const dockItems: DockItemData[] = NAV_LINKS.map((link) => {
    const Icon = link.icon;
    return {
      id: link.href,
      label: link.shortLabel,
      icon: <Icon />,
      isActive: isActive(link.href),
      onClick: () => router.push(link.href),
    };
  });

  return (
    <div className="min-h-screen bg-black text-ink md:flex">
      {/* Sidebar desktop */}
      <aside className="hidden w-[17rem] shrink-0 flex-col border-r border-white/5 bg-black md:flex">
        <div className="flex flex-1 flex-col p-5">
          <Link href="/admin" className="mb-10 rounded-2xl p-2 transition-colors hover:bg-white/5">
            <KabanasLogo variant="lockup" size="md" subtitle="Gestão do negócio" />
          </Link>

          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">Menu</p>
          <nav className="space-y-0.5 overflow-y-auto scrollbar-none">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    'flex items-center gap-3 rounded-xl border-l-[3px] px-3 py-2.5 text-sm transition-all duration-150',
                    active
                      ? 'nav-item-active'
                      : 'border-transparent font-medium text-neutral-400 hover:border-white/20 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', active ? 'bg-brand-400/20 text-brand-300' : 'text-neutral-500')}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3 border-t border-white/10 pt-5">
            <div className="rounded-xl bg-white/5 px-3 py-3">
              <p className="truncate text-xs font-medium text-neutral-300" title={userEmail}>
                {userEmail}
              </p>
              <span className="mt-2 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-brand-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-400" />
                </span>
                Loja online
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-bold text-neutral-400 transition-all hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut size={14} />
              Sair da conta
            </button>
          </div>
        </div>
      </aside>

      {/* Header mobile */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-black/95 px-4 py-3.5 text-white backdrop-blur-xl safe-top md:hidden">
        <Link href="/admin" className="flex items-center gap-2.5">
          <KabanasLogo variant="mark" size="sm" />
          <span className="font-serif text-lg font-bold">{BRAND.shortName}</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-300">
            <Store size={12} />
            Gestão
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-neutral-400 transition-colors hover:border-red-400/40 hover:text-red-300"
          >
            <LogOut size={13} />
            Sair
          </button>
        </div>
      </header>

      {/* Conteúdo principal */}
      <div className="min-w-0 flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>

      {/* Dock mobile */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden">
        <MagneticDock items={dockItems} iconSize={40} maxScale={1.25} magneticDistance={80} variant="glass" />
      </div>
    </div>
  );
}
