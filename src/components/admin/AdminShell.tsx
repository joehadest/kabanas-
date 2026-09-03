'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { LogOut } from 'lucide-react';
import { LayoutGrid } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { KabanasLogo } from '@/components/shared/KabanasLogo';
import { IconOverview, IconOrders, IconMenuBook, IconStock, IconClock, IconSettings } from './AdminDockIcons';
import { MobileAdminDock } from './MobileAdminDock';
import { MobileAdminHeader } from './MobileAdminHeader';

const NAV_LINKS = [
  { href: '/admin', label: 'Visão geral', shortLabel: 'Início', icon: IconOverview },
  { href: '/admin/pdv', label: 'Vendas e mesas', shortLabel: 'Vendas', icon: IconOrders },
  { href: '/admin/caixa', label: 'Caixa', shortLabel: 'Caixa', icon: IconOverview },
  { href: '/admin/cardapio', label: 'Cardápio', shortLabel: 'Menu', icon: IconMenuBook },
  { href: '/admin/mesas', label: 'Mesas', shortLabel: 'Mesas', icon: LayoutGrid },
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
  const mainRef = useRef<HTMLElement>(null);
  const isActive = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-black text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] flex-col border-r border-white/5 bg-black md:flex">
        <div className="flex h-full flex-col overflow-hidden p-5">
          <Link href="/admin" className="mb-8 shrink-0 rounded-2xl p-2 transition-colors hover:bg-white/5">
            <KabanasLogo variant="lockup" size="md" subtitle="Gestão do negócio" />
          </Link>

          <p className="mb-3 shrink-0 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">Menu</p>
          <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-y-contain scrollbar-none">
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
                  <span
                    className={clsx(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      active ? 'bg-brand-400/20 text-brand-300' : 'text-neutral-500'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 shrink-0 space-y-3 border-t border-white/10 pt-5">
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

      <MobileAdminHeader onLogout={handleLogout} scrollRootRef={mainRef} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden md:pl-[17rem]">
        <main
          ref={mainRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pt-[calc(3rem+env(safe-area-inset-top,0px))] pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] sm:pt-[calc(3.5rem+env(safe-area-inset-top,0px))] md:pt-0 md:pb-0"
        >
          {children}
        </main>
      </div>

      <MobileAdminDock />
    </div>
  );
}
