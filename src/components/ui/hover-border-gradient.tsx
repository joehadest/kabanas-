'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type Direction = 'TOP' | 'LEFT' | 'BOTTOM' | 'RIGHT';

const movingMap: Record<Direction, string> = {
  TOP: 'radial-gradient(20.7% 50% at 50% 0%, hsl(0, 0%, 100%) 0%, rgba(255, 255, 255, 0) 100%)',
  LEFT: 'radial-gradient(16.6% 43.1% at 0% 50%, hsl(0, 0%, 100%) 0%, rgba(255, 255, 255, 0) 100%)',
  BOTTOM: 'radial-gradient(20.7% 50% at 50% 100%, hsl(0, 0%, 100%) 0%, rgba(255, 255, 255, 0) 100%)',
  RIGHT: 'radial-gradient(16.2% 41.2% at 100% 50%, hsl(0, 0%, 100%) 0%, rgba(255, 255, 255, 0) 100%)',
};

// Amarelo da marca no lugar do azul original (#3275F8) — combina com o resto do admin.
const highlight = 'radial-gradient(75% 181.16% at 50% 50%, #facc15 0%, rgba(255, 255, 255, 0) 100%)';

interface HoverBorderGradientProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  as?: React.ElementType;
  containerClassName?: string;
  className?: string;
  duration?: number;
  clockwise?: boolean;
}

function HoverBorderGradient({
  children,
  containerClassName,
  className,
  as: Element = 'button',
  duration = 1,
  clockwise = true,
  disabled,
  ...props
}: HoverBorderGradientProps) {
  const [hovered, setHovered] = React.useState(false);
  const [direction, setDirection] = React.useState<Direction>('BOTTOM');

  const rotateDirection = (currentDirection: Direction): Direction => {
    const directions: Direction[] = ['TOP', 'LEFT', 'BOTTOM', 'RIGHT'];
    const currentIndex = directions.indexOf(currentDirection);
    const nextIndex = clockwise
      ? (currentIndex - 1 + directions.length) % directions.length
      : (currentIndex + 1) % directions.length;
    return directions[nextIndex];
  };

  React.useEffect(() => {
    if (hovered) return;
    const interval = setInterval(() => {
      setDirection((prev) => rotateDirection(prev));
    }, duration * 1000);
    return () => clearInterval(interval);
  }, [hovered]);

  return (
    <Element
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'relative flex h-min w-fit flex-nowrap items-center justify-center gap-2 overflow-visible rounded-full',
        'border border-white/10 bg-black/60 box-decoration-clone p-px transition duration-500 hover:bg-black/80',
        'disabled:pointer-events-none disabled:opacity-50',
        containerClassName
      )}
      {...props}
    >
      <div
        className={cn(
          'z-10 w-auto rounded-[inherit] bg-[#1c1d1a] px-5 py-3 text-sm font-black tracking-wide text-white',
          className
        )}
      >
        {children}
      </div>
      <motion.div
        className="absolute inset-0 z-0 flex-none overflow-hidden rounded-[inherit]"
        style={{ filter: 'blur(2px)', position: 'absolute', width: '100%', height: '100%' }}
        initial={{ background: movingMap[direction] }}
        animate={{ background: hovered ? [movingMap[direction], highlight] : movingMap[direction] }}
        transition={{ ease: 'linear', duration }}
      />
      <div className="absolute inset-0.5 z-[1] flex-none rounded-[100px] bg-[#1c1d1a]" />
    </Element>
  );
}

export { HoverBorderGradient, type HoverBorderGradientProps };
export default HoverBorderGradient;
