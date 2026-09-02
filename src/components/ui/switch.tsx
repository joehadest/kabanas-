'use client';

import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/** Toggle estilo iOS — alvo de toque generoso, pensado para uso rápido no dia a dia. */
export function Switch({ checked, onCheckedChange, disabled, id, className, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-[3.25rem] shrink-0 items-center rounded-full border transition-colors duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        'disabled:pointer-events-none disabled:opacity-50',
        checked ? 'border-brand-400 bg-brand-400' : 'border-border bg-neutral-800',
        className
      )}
      {...rest}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-out',
          checked ? 'translate-x-[26px]' : 'translate-x-1'
        )}
      />
    </button>
  );
}
