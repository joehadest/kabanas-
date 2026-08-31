import { GUEST_ID_COOKIE } from './constants';

/** Lê o cookie kabanas_guest_id no navegador. O middleware garante que ele já existe. */
export function getGuestId(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${GUEST_ID_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
