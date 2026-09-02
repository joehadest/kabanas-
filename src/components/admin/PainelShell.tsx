'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { KabanasLogo } from '@/components/shared/KabanasLogo';
import { createClient } from '@/lib/supabase/client';

const NAV_LINKS = [
  { href: '/painel/pedidos', label: 'Pedidos' },
  { href: '/painel/cardapio', label: 'Cardápio' },
];

interface Props {
  userEmail: string;
  children: React.ReactNode;
}

export function PainelShell({ userEmail, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-black text-ink">
      <nav className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-black text-white">
        <div className="bg-black" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex h-12 w-full max-w-[100vw] items-center justify-between gap-2 px-3 sm:h-14 sm:px-6">
            <Link href="/painel/pedidos" className="min-w-0 shrink">
              <KabanasLogo variant="lockup" size="sm" subtitle="Operação" />
            </Link>
            <div className="flex h-full min-w-0 flex-1 items-stretch justify-center gap-0.5 overflow-x-auto scrollbar-none">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    'flex shrink-0 items-center border-b-2 px-3 text-sm sm:px-5',
                    pathname.startsWith(link.href)
                      ? 'border-brand-400 font-bold text-white'
                      : 'border-transparent font-medium text-neutral-400 transition-colors hover:border-white/30 hover:text-white'
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="hidden shrink-0 items-center gap-3 sm:flex">
              <span className="max-w-[10rem] truncate text-xs text-neutral-400" title={userEmail}>
                {userEmail}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="border border-white/15 px-3 py-1.5 text-xs font-bold text-neutral-300 transition-colors hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-300"
              >
                Sair
              </button>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 border border-white/15 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-300 transition-colors hover:border-red-400/50 hover:text-red-300 sm:hidden"
            >
              Sair
            </button>
          </div>
        </div>
      </nav>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pt-[calc(3rem+env(safe-area-inset-top,0px))] sm:pt-[calc(3.5rem+env(safe-area-inset-top,0px))]">
        {children}
      </main>
    </div>
  );
}
