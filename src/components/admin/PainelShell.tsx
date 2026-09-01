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
    <div className="flex h-screen flex-col bg-black text-ink">
      <nav className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-black px-4 text-white sm:px-6">
        <Link href="/painel/pedidos">
          <KabanasLogo variant="lockup" size="sm" subtitle="Operação" />
        </Link>
        <div className="flex h-full items-stretch gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                'flex items-center border-b-2 px-3 text-sm sm:px-5',
                pathname.startsWith(link.href)
                  ? 'border-brand-400 font-bold text-white'
                  : 'border-transparent font-medium text-neutral-400 transition-colors hover:border-white/30 hover:text-white'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <span className="truncate text-xs text-neutral-400" title={userEmail}>
            {userEmail}
          </span>
          <button
            onClick={handleLogout}
            className="border border-white/15 px-3 py-1.5 text-xs font-bold text-neutral-300 transition-colors hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-300"
          >
            Sair
          </button>
        </div>
        <button
          onClick={handleLogout}
          className="border border-white/15 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-300 transition-colors hover:border-red-400/50 hover:text-red-300 sm:hidden"
        >
          Sair
        </button>
      </nav>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
