'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { createClient } from '@/lib/supabase/client';
import { MagneticDock, type DockItemData } from '@/components/ui/magnetic-dock';
import { IconOverview, IconOrders, IconMenuBook, IconStock, IconClock, IconSettings } from './AdminDockIcons';

const NAV_LINKS = [
  { href: '/admin', label: 'Visao geral', shortLabel: 'Inicio', icon: IconOverview },
  { href: '/admin/pedidos', label: 'Pedidos', shortLabel: 'Pedidos', icon: IconOrders },
  { href: '/admin/cardapio', label: 'Cardápio', shortLabel: 'Cardápio', icon: IconMenuBook },
  { href: '/admin/estoque', label: 'Estoque', shortLabel: 'Estoque', icon: IconStock },
  { href: '/admin/horarios', label: 'Horários', shortLabel: 'Horários', icon: IconClock },
  { href: '/admin/configuracoes', label: 'Configurações', shortLabel: 'Ajustes', icon: IconSettings },
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
    <div className="min-h-screen bg-[#eeece5] text-[#1c1d1a] md:flex">
      <aside className="hidden w-64 shrink-0 bg-[#1c1d1a] p-5 md:flex md:flex-col">
        <Link href="/admin" className="mb-12 flex items-center gap-3 text-white">
          <span className="flex h-10 w-10 items-center justify-center bg-brand-400 font-serif text-xl font-black text-neutral-950">K</span>
          <span>
            <span className="block font-serif text-xl font-bold leading-none">Kabanas</span>
            <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-brand-300">Administraçao</span>
          </span>
        </Link>
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">Gestao</p>
        <nav className="space-y-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                'block border-l-2 px-3 py-3 text-sm transition-colors',
                isActive(link.href)
                  ? 'border-brand-400 bg-white/10 font-bold text-white'
                  : 'border-transparent font-medium text-neutral-400 hover:border-white/30 hover:bg-white/5 hover:text-white'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 pt-4">
          <p className="truncate text-xs font-medium text-neutral-400" title={userEmail}>
            {userEmail}
          </p>
          <span className="mt-2 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> Loja online
          </span>
          <button
            onClick={handleLogout}
            className="mt-4 w-full border border-white/15 px-3 py-2.5 text-xs font-bold text-neutral-300 transition-colors hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-300"
          >
            Sair da conta
          </button>
        </div>
      </aside>
      <header className="flex items-center justify-between bg-[#1c1d1a] px-4 py-4 text-white md:hidden">
        <Link href="/admin" className="font-serif text-xl font-bold">Kabanas</Link>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-300">Administraçao</span>
          <button
            onClick={handleLogout}
            className="border border-white/15 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-300 transition-colors hover:border-red-400/50 hover:text-red-300"
          >
            Sair
          </button>
        </div>
      </header>
      <div className="min-w-0 flex-1 pb-24 md:pb-0">{children}</div>
      <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden">
        <MagneticDock items={dockItems} iconSize={42} maxScale={1.3} magneticDistance={90} variant="glass" />
      </div>
    </div>
  );
}
