'use client';

import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const inputClass =
  'w-full rounded-xl border border-border bg-surface-elevated px-3.5 py-2.5 text-sm text-ink outline-none transition-all placeholder:text-neutral-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-400/20 disabled:opacity-50';

export const labelClass = 'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(inputClass, className)} {...props} />
);
Input.displayName = 'Input';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => <select ref={ref} className={cn(inputClass, className)} {...props} />
);
Select.displayName = 'Select';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(inputClass, 'resize-none', className)} {...props} />
  )
);
Textarea.displayName = 'Textarea';

export function Label({ children, className, htmlFor }: { children: React.ReactNode; className?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn(labelClass, className)}>
      {children}
    </label>
  );
}

export function FieldGroup({ label, children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      {label && <Label>{label}</Label>}
      {children}
    </div>
  );
}
