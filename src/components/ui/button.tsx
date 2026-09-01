'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'brand' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-neutral-950 shadow-sm hover:bg-brand-400 hover:shadow-glow active:scale-[0.98] disabled:hover:bg-brand-500',
  secondary:
    'border border-border bg-surface-elevated text-neutral-300 hover:border-neutral-500 hover:bg-neutral-800 active:scale-[0.98]',
  ghost: 'text-neutral-400 hover:bg-white/5 hover:text-ink active:scale-[0.98]',
  danger:
    'border border-red-500/30 bg-red-500/10 text-red-400 hover:border-red-500/50 hover:bg-red-500/15 active:scale-[0.98]',
  brand:
    'bg-brand-400 text-neutral-950 font-bold shadow-sm hover:bg-brand-300 hover:shadow-glow active:scale-[0.98]',
  outline:
    'border border-brand-400/60 text-brand-300 hover:bg-brand-400/10 active:scale-[0.98]',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-sm gap-2',
  icon: 'h-9 w-9',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-bold uppercase tracking-wide transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
Button.displayName = 'Button';
