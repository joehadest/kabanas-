import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn('mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8', className)}>
      {children}
    </main>
  );
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-300">{eyebrow}</p>
        )}
        <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const TONE_ICON: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'bg-white/5 text-neutral-300',
  success: 'bg-brand-400/10 text-brand-400',
  warning: 'bg-amber-500/10 text-amber-400',
  danger: 'bg-red-500/10 text-red-400',
  info: 'bg-sky-500/10 text-sky-400',
};

export function StatCard({ label, value, icon, tone = 'default', className }: StatCardProps) {
  return (
    <div
      className={cn(
        'group rounded-2xl border border-border bg-surface-elevated p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-400/30 hover:shadow-glow',
        className
      )}
    >
      {icon && (
        <div className={cn('inline-flex h-10 w-10 items-center justify-center rounded-xl', TONE_ICON[tone])}>
          {icon}
        </div>
      )}
      <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 font-serif text-2xl font-bold text-ink sm:text-3xl">{value}</p>
    </div>
  );
}

interface PanelProps {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}

export function Panel({ title, eyebrow, action, children, className, bodyClassName, noPadding }: PanelProps) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-card', className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-border bg-black/40 px-5 py-4">
          <div>
            {eyebrow && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-300">{eyebrow}</p>
            )}
            {title && <h2 className={cn('font-serif font-bold text-ink', eyebrow ? 'mt-1 text-lg' : 'text-lg')}>{title}</h2>}
          </div>
          {action}
        </div>
      )}
      <div className={cn(!noPadding && 'p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Alert({
  children,
  variant = 'info',
  className,
}: {
  children: ReactNode;
  variant?: 'info' | 'warning' | 'success' | 'error';
  className?: string;
}) {
  const styles = {
    info: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    success: 'border-brand-400/30 bg-brand-400/10 text-brand-300',
    error: 'border-red-500/30 bg-red-500/10 text-red-300',
  };
  return (
    <div className={cn('rounded-xl border px-4 py-3 text-sm leading-relaxed', styles[variant], className)}>
      {children}
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: { label: string; href: string } }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm text-neutral-500">{message}</p>
      {action && (
        <Link href={action.href} className="mt-3 text-xs font-bold uppercase tracking-wide text-brand-300 hover:underline">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function ProgressBar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'sky' | 'neutral' }) {
  const bar = { brand: 'bg-brand-400', sky: 'bg-sky-500', neutral: 'bg-neutral-500' };
  return (
    <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
      <div
        className={cn('h-full rounded-full transition-all duration-500', bar[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
