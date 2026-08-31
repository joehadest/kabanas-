import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Amarelo vibrante — cor de destaque (CTAs, preços, badges, estados ativos).
        // Sempre combinar com texto escuro (neutral-900) em cima, nunca branco.
        brand: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
        status: {
          received: '#3b82f6',
          preparing: '#f59e0b',
          out_for_delivery: '#8b5cf6',
          delivered: '#22c55e',
          cancelled: '#ef4444',
        },
      },
      boxShadow: {
        floating: '0 8px 24px -4px rgba(0,0,0,0.25)',
        glow: '0 8px 28px -4px rgba(234,179,8,0.5)',
        panel: '0 1px 2px rgba(0,0,0,0.04), 0 12px 24px -8px rgba(0,0,0,0.12)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'bounce-in': {
          '0%': { opacity: '0', transform: 'translateY(20px) scale(0.92)' },
          '60%': { opacity: '1', transform: 'translateY(-3px) scale(1.02)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        pop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.18)' },
          '100%': { transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        'fade-in-up': 'fade-in-up 0.4s cubic-bezier(0.16,1,0.3,1) both',
        'slide-up': 'slide-up 0.32s cubic-bezier(0.32,0.72,0,1) both',
        'slide-down': 'slide-down 0.32s cubic-bezier(0.32,0.72,0,1) both',
        'scale-in': 'scale-in 0.2s ease-out both',
        'bounce-in': 'bounce-in 0.55s cubic-bezier(0.34,1.56,0.64,1) both',
        pop: 'pop 0.35s ease-in-out',
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
