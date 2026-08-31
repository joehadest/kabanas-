import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Junta classes condicionalmente e resolve conflitos do Tailwind (padrão shadcn). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
