'use client';

import * as React from 'react';
import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

type IconComponent = React.ComponentType<{ className?: string }>;

export interface DockItem {
  icon: IconComponent;
  label: string;
  onClick?: () => void;
  isActive?: boolean;
}

interface DockProps {
  className?: string;
  items: DockItem[];
}

interface DockIconButtonProps {
  icon: IconComponent;
  label: string;
  onClick?: () => void;
  isActive?: boolean;
  className?: string;
}

const floatingAnimation: Variants = {
  initial: { y: 0 },
  animate: {
    y: [-1.5, 1.5, -1.5],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

const DockIconButton = React.forwardRef<HTMLButtonElement, DockIconButtonProps>(
  ({ icon: Icon, label, onClick, isActive, className }, ref) => {
    return (
      <motion.button
        ref={ref}
        type="button"
        whileHover={{ scale: 1.08, y: -2 }}
        whileTap={{ scale: 0.94 }}
        onClick={onClick}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'relative flex min-w-[3.25rem] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5',
          'transition-colors touch-manipulation',
          isActive ? 'bg-brand-400/15 text-brand-300' : 'text-neutral-400 hover:bg-white/5 hover:text-white',
          className
        )}
      >
        <Icon className={cn('h-5 w-5', isActive ? 'text-brand-300' : 'text-current')} />
        <span
          className={cn(
            'max-w-[3.5rem] truncate text-[9px] font-bold uppercase tracking-wide',
            isActive ? 'text-brand-300' : 'text-neutral-500'
          )}
        >
          {label}
        </span>
        {isActive && (
          <span className="absolute bottom-0.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-brand-400" />
        )}
      </motion.button>
    );
  }
);
DockIconButton.displayName = 'DockIconButton';

const Dock = React.forwardRef<HTMLDivElement, DockProps>(({ items, className }, ref) => {
  return (
    <div ref={ref} className={cn('flex w-full justify-center', className)}>
      <motion.div
        initial="initial"
        animate="animate"
        variants={floatingAnimation}
        className={cn(
          'flex w-full max-w-lg items-stretch justify-between gap-0.5 rounded-2xl p-1.5 sm:gap-1 sm:p-2',
          'border border-white/10 bg-black/90 shadow-xl shadow-black/40 backdrop-blur-xl',
          'overflow-x-auto overscroll-x-contain scrollbar-none'
        )}
      >
        {items.map((item) => (
          <DockIconButton key={item.label} {...item} />
        ))}
      </motion.div>
    </div>
  );
});
Dock.displayName = 'Dock';

export { Dock, DockIconButton };
