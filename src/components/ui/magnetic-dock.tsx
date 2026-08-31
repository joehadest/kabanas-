'use client';

import * as React from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence, type MotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MagneticDockProps {
  /** Array of dock items */
  items: DockItemData[];
  /** Size of icons in pixels */
  iconSize?: number;
  /** Maximum scale on hover */
  maxScale?: number;
  /** Distance of magnetic effect in pixels */
  magneticDistance?: number;
  /** Show labels on hover */
  showLabels?: boolean;
  /** Dock position */
  position?: 'bottom' | 'top' | 'left' | 'right';
  /** Background style */
  variant?: 'glass' | 'solid' | 'transparent';
  /** Custom class name */
  className?: string;
}

interface DockItemData {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Icon component or image URL */
  icon: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Whether item is active */
  isActive?: boolean;
  /** Badge count */
  badge?: number;
}

interface DockItemProps {
  item: DockItemData;
  mouseX: MotionValue<number>;
  iconSize: number;
  maxScale: number;
  magneticDistance: number;
  showLabels: boolean;
  isVertical: boolean;
}

function DockItem({ item, mouseX, iconSize, maxScale, magneticDistance, showLabels, isVertical }: DockItemProps) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = React.useState(false);

  // Calculate distance from mouse to center of item
  const distance = useTransform(mouseX, (val: number) => {
    if (!ref.current) return magneticDistance + 1;
    const rect = ref.current.getBoundingClientRect();
    const center = isVertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
    return val - center;
  });

  // Scale based on distance - closer = larger
  const scale = useTransform(distance, [-magneticDistance, 0, magneticDistance], [1, maxScale, 1]);

  // Apply spring physics for smooth animation
  const springConfig = { damping: 20, stiffness: 300, mass: 0.5 };
  const smoothScale = useSpring(scale, springConfig);

  // Calculate the size based on scale
  const size = useTransform(smoothScale, (s) => s * iconSize);

  // Floating effect
  const y = useTransform(smoothScale, (s) => (s - 1) * -10);
  const smoothY = useSpring(y, springConfig);

  return (
    <motion.button
      ref={ref}
      onClick={item.onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'relative flex items-center justify-center rounded-2xl transition-colors duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60',
        item.isActive && 'bg-white/10'
      )}
      style={{
        width: size,
        height: size,
        y: isVertical ? 0 : smoothY,
        x: isVertical ? smoothY : 0,
      }}
      whileTap={{ scale: 0.9 }}
    >
      {/* Icon Container */}
      <motion.div
        className={cn(
          'relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl',
          'border transition-all duration-200',
          item.isActive ? 'border-brand-400/70 bg-brand-400 text-neutral-950' : 'border-white/10 bg-white/[0.06] text-neutral-300'
        )}
        style={{
          boxShadow: isHovered
            ? '0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)'
            : '0 3px 10px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Icon */}
        <div className="flex h-[55%] w-[55%] items-center justify-center">{item.icon}</div>

        {/* Shine effect */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 50%, transparent 100%)',
            opacity: isHovered ? 0.9 : 0.4,
          }}
        />
      </motion.div>

      {/* Badge */}
      <AnimatePresence>
        {item.badge !== undefined && item.badge > 0 && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={cn(
              'absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5',
              'border-2 border-[#1c1d1a] bg-red-500 text-xs font-semibold text-white shadow-lg'
            )}
          >
            {item.badge > 99 ? '99+' : item.badge}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Indicator */}
      <AnimatePresence>
        {item.isActive && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute -bottom-1.5 h-1.5 w-1.5 rounded-full bg-brand-400"
          />
        )}
      </AnimatePresence>

      {/* Tooltip */}
      <AnimatePresence>
        {showLabels && isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'pointer-events-none absolute -top-10 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg px-3 py-1.5',
              'border border-white/10 bg-[#1c1d1a] text-sm font-medium text-white shadow-xl'
            )}
          >
            {item.label}
            <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-white/10 bg-[#1c1d1a]" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function MagneticDock({
  items,
  iconSize = 48,
  maxScale = 1.4,
  magneticDistance = 120,
  showLabels = false,
  position = 'bottom',
  variant = 'glass',
  className,
}: MagneticDockProps) {
  const mousePosition = useMotionValue(Infinity);
  const isVertical = position === 'left' || position === 'right';

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent) => {
      mousePosition.set(isVertical ? e.clientY : e.clientX);
    },
    [mousePosition, isVertical]
  );

  const handleMouseLeave = () => mousePosition.set(Infinity);

  const variantStyles = {
    glass: 'bg-[#1c1d1a]/90 backdrop-blur-xl backdrop-saturate-150 border border-white/10',
    solid: 'bg-[#1c1d1a] border border-white/10',
    transparent: 'bg-transparent border-0',
  };

  const positionStyles = {
    bottom: 'flex-row',
    top: 'flex-row',
    left: 'flex-col',
    right: 'flex-col',
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'inline-flex items-end gap-1.5 rounded-3xl p-2.5 shadow-xl shadow-black/30',
        variantStyles[variant],
        positionStyles[position],
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {items.map((item) => (
        <DockItem
          key={item.id}
          item={item}
          mouseX={mousePosition}
          iconSize={iconSize}
          maxScale={maxScale}
          magneticDistance={magneticDistance}
          showLabels={showLabels}
          isVertical={isVertical}
        />
      ))}
    </motion.div>
  );
}

export { MagneticDock, type MagneticDockProps, type DockItemData };
export default MagneticDock;
