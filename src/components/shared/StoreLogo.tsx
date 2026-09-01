import Image from 'next/image';
import clsx from 'clsx';
import { KabanasLogo } from '@/components/shared/KabanasLogo';

interface Props {
  logoUrl?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Usa a logo circular oficial quando não há logo cadastrada. */
  useBrandFallback?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-9 w-9',
  md: 'h-14 w-14',
  lg: 'h-20 w-20',
};

const BRAND_SIZE: Record<NonNullable<Props['size']>, 'sm' | 'md' | 'lg'> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
};

/**
 * Logo da loja. Sem `logo_url`, exibe a marca Boteco Kabanas Beer por padrão.
 */
export function StoreLogo({ logoUrl, name, size = 'md', className, useBrandFallback = true }: Props) {
  if (!logoUrl && useBrandFallback) {
    return <KabanasLogo variant="badge" size={BRAND_SIZE[size]} className={className} />;
  }

  if (logoUrl) {
    return (
      <div
        className={clsx(
          'relative shrink-0 overflow-hidden rounded-full bg-[#2c2c2c] ring-1 ring-brand-400/40',
          SIZE_CLASSES[size],
          className
        )}
      >
        <Image src={logoUrl} alt={name} fill sizes="80px" className="object-cover" />
      </div>
    );
  }

  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || 'K';

  return (
    <div
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full bg-brand-400 font-serif text-xl font-bold text-neutral-950',
        SIZE_CLASSES[size],
        className
      )}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
