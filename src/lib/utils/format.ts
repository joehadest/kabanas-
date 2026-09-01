export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Converte "10,50" ou "10.50" em número. */
export function parseDecimal(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return NaN;
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/** Supabase pode retornar relação N:1 como objeto ou array de um item. */
export function relationOne<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

/** Nome da mesa/comanda sem prefixo duplicado (ex.: "Comanda Mesa 01" → "Mesa 01"). */
export function tableDisplayLabel(value: string | null | undefined, fallback = 'Comanda'): string {
  if (!value?.trim()) return fallback;
  let label = value.trim();
  if (/^comanda\s+/i.test(label)) {
    label = label.replace(/^comanda\s+/i, '').trim();
  }
  return label || fallback;
}

export function formatOrderTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Distância aproximada (Haversine) em km entre a loja e o endereço de entrega. */
export function haversineDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

interface FeeParams {
  feeType: 'fixed' | 'per_km';
  fixedFee: number;
  perKmFee: number;
  distanceKm?: number;
}

export function calculateDeliveryFee({ feeType, fixedFee, perKmFee, distanceKm = 0 }: FeeParams): number {
  if (feeType === 'fixed') return fixedFee;
  return Math.round(perKmFee * distanceKm * 100) / 100;
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

interface OpeningHoursDay {
  open: string;
  close: string;
  closed: boolean;
}

/** Calcula se a loja está aberta agora, considerando is_open_override e horários que passam da meia-noite. */
export function isStoreOpenNow(store: {
  opening_hours: Record<string, OpeningHoursDay>;
  is_open_override: boolean | null;
}): boolean {
  if (store.is_open_override !== null && store.is_open_override !== undefined) {
    return store.is_open_override;
  }

  const now = new Date();
  const today = store.opening_hours[DAY_KEYS[now.getDay()]];
  if (!today || today.closed) return false;

  const [openH, openM] = today.open.split(':').map(Number);
  const [closeH, closeM] = today.close.split(':').map(Number);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (closeMinutes <= openMinutes) {
    // horário atravessa a meia-noite (ex: 18:00–02:00)
    return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
  }
  return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
}

interface CouponParams {
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  subtotal: number;
}

export function calculateDiscount({ discountType, discountValue, subtotal }: CouponParams): number {
  if (discountType === 'fixed') return Math.min(discountValue, subtotal);
  return Math.round(subtotal * (discountValue / 100) * 100) / 100;
}
