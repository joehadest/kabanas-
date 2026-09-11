import type { UserRole } from '@/lib/types/database';

export const WAITER_HOME = '/admin/pdv';

const WAITER_ALLOWED_PREFIXES = ['/admin/pdv'] as const;

export function isStaffRole(role: string | null | undefined): role is UserRole {
  return role === 'admin' || role === 'restaurant' || role === 'waiter';
}

export function isFullAdminRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'restaurant';
}

export function isWaiterRole(role: string | null | undefined): boolean {
  return role === 'waiter';
}

/** Rotas do /admin liberadas para cada papel. */
export function canAccessAdminPath(role: string | null | undefined, pathname: string): boolean {
  if (isFullAdminRole(role)) return true;
  if (!isWaiterRole(role)) return false;

  const path = pathname.split('?')[0] || pathname;
  return WAITER_ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Destino pós-login / home do shell. */
export function adminHomeForRole(role: string | null | undefined): string {
  return isWaiterRole(role) ? WAITER_HOME : '/admin';
}
