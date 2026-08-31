import Image from 'next/image';
import clsx from 'clsx';

interface Props {
  logoUrl?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-9 w-9 text-sm rounded-lg',
  md: 'h-14 w-14 text-xl rounded-xl',
  lg: 'h-20 w-20 text-3xl rounded-2xl',
};

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() ?? '').join('') || 'K';
}

/**
 * Logo da loja com fallback automático em iniciais quando `store_settings.logo_url`
 * ainda não está preenchido. Assim que uma logo real for cadastrada, ela aparece
 * em todos os lugares que usam este componente sem nenhuma mudança de código.
 */
export function StoreLogo({ logoUrl, name, size = 'md', className }: Props) {
  if (logoUrl) {
    return (
      <div className={clsx('relative overflow-hidden shrink-0 bg-neutral-100', SIZE_CLASSES[size], className)}>
        <Image src={logoUrl} alt={name} fill sizes="80px" className="object-cover" />
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'flex items-center justify-center shrink-0 bg-brand-400 text-neutral-950 font-serif font-bold',
        SIZE_CLASSES[size],
        className
      )}
      aria-label={name}
    >
      {getInitials(name)}
    </div>
  );
}
