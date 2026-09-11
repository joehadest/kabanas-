'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { WAITER_HOME, canAccessAdminPath } from '@/lib/auth/roles';
import type { UserRole } from '@/lib/types/database';

interface Props {
  role: UserRole;
  children: React.ReactNode;
}

/** Redireciona garçom para o PDV se tentar abrir outra rota do admin. */
export function AdminRouteGate({ role, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!canAccessAdminPath(role, pathname)) {
      router.replace(WAITER_HOME);
    }
  }, [role, pathname, router]);

  if (!canAccessAdminPath(role, pathname)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6 text-sm text-neutral-500">
        Redirecionando…
      </div>
    );
  }

  return <>{children}</>;
}
