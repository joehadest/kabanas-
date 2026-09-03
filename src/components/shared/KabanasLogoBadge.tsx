import clsx from 'clsx';
import { BRAND } from '@/lib/brand';

interface Props {
  className?: string;
}

/** Selo circular oficial — mesmo arquivo usado no favicon e PWA (`/brand/logo-badge.svg`). */
export function KabanasLogoBadge({ className }: Props) {
  return (
    <img
      src={BRAND.logoBadgePath}
      alt="Boteco Kabanas Beer"
      className={clsx('h-full w-full object-contain', className)}
      draggable={false}
    />
  );
}
