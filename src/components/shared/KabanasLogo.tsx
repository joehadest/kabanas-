import Image from 'next/image';
import clsx from 'clsx';
import { BRAND } from '@/lib/brand';
import { KabanasLogoBadge } from '@/components/shared/KabanasLogoBadge';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
type Variant = 'badge' | 'mark' | 'lockup';

interface Props {
  variant?: Variant;
  size?: Size;
  className?: string;
  showTagline?: boolean;
  subtitle?: string;
}

const BADGE_SIZES: Record<Size, string> = {
  xs: 'h-8 w-8',
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-20 w-20',
  xl: 'h-28 w-28',
  hero: 'h-40 w-40 sm:h-48 sm:w-48',
};

const MARK_SIZES: Record<Size, string> = {
  xs: 'h-7 w-7',
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
  hero: 'h-28 w-28',
};

const IMAGE_SIZES: Record<Size, string> = {
  xs: '32px',
  sm: '40px',
  md: '56px',
  lg: '80px',
  xl: '112px',
  hero: '192px',
};

/** Logo oficial Boteco Kabanas Beer — selo do banner (badge) ou ícone (mark). */
export function KabanasLogo({
  variant = 'badge',
  size = 'md',
  className,
  showTagline = false,
  subtitle,
}: Props) {
  if (variant === 'lockup') {
    return (
      <div className={clsx('flex items-center gap-3', className)}>
        <KabanasLogo variant="badge" size={size === 'hero' ? 'lg' : size === 'xl' ? 'md' : 'sm'} />
        <span className="min-w-0">
          <span className="block font-display text-lg leading-tight text-white sm:text-xl">{BRAND.shortName}</span>
          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-300">
            {subtitle || BRAND.tagline}
          </span>
        </span>
      </div>
    );
  }

  if (variant === 'mark') {
    return (
      <div
        className={clsx('relative shrink-0', MARK_SIZES[size], className)}
        aria-label={BRAND.name}
        role="img"
      >
        <Image
          src={BRAND.logoMarkPath}
          alt=""
          fill
          sizes={IMAGE_SIZES[size]}
          className="object-contain drop-shadow-[0_2px_8px_rgba(212,175,55,0.35)]"
        />
      </div>
    );
  }

  return (
    <div className={clsx('group relative shrink-0', className)}>
      <div
        className={clsx(
          'relative overflow-hidden rounded-full shadow-glow ring-2 ring-brand-400/70',
          BADGE_SIZES[size]
        )}
        aria-label={BRAND.name}
        role="img"
      >
        <KabanasLogoBadge />
      </div>
      {showTagline && (
        <p className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-brand-300 sm:text-sm">
          {BRAND.tagline}
        </p>
      )}
    </div>
  );
}
