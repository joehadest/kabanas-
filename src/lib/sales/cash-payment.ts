import { parseDecimal } from '@/lib/utils/format';

/** Cédulas/moedas comuns para atalho de "cliente pagou com". */
export const CASH_RECEIVE_PRESETS = [200, 100, 50, 20, 10, 5, 2] as const;

export function isCashPaymentName(name: string | null | undefined): boolean {
  const normalized = (name ?? '').toLowerCase();
  return (
    normalized.includes('dinheiro') ||
    normalized.includes('espécie') ||
    normalized.includes('especie') ||
    normalized.includes('cash')
  );
}

export function calculateCashChange(received: number, due: number): number {
  if (!Number.isFinite(received) || !Number.isFinite(due)) return 0;
  return Math.max(0, Math.round((received - due) * 100) / 100);
}

export function parseCashReceived(value: string): number {
  return parseDecimal(value);
}

export function formatCashPresetLabel(value: number): string {
  return value >= 1 ? `R$ ${value}` : `R$ ${value.toFixed(2).replace('.', ',')}`;
}
