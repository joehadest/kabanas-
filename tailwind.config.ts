import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#f5f5f5',
        surface: {
          DEFAULT: '#0a0a0a',
          elevated: '#141414',
          dark: '#000000',
        },
        border: {
          DEFAULT: '#2a2a2a',
          strong: '#3a3a3a',
        },
        brand: {
          50: '#fbf8ef',
          100: '#f5ecd4',
          200: '#ebd9a8',
          300: '#dfc574',
          400: '#d4af37',
          500: '#c19b2e',
          600: '#a37f24',
          700: '#85661d',
          800: '#6b5218',
          900: '#564214',
        },
        kabanas: {
          charcoal: '#0a0a0a',
          dark: '#1a1a1a',
          gold: '#d4af37',
        },
        status: {
          received: '#3b82f6',
          preparing: '#f59e0b',
          out_for_delivery: '#8b5cf6',
          delivered: '#d4af37',
          cancelled: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-rye)', 'Georgia', 'serif'],
        serif: ['var(--font-rye)', 'Georgia', 'serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        floating: '0 8px 24px -4px rgba(0,0,0,0.25)',
        glow: '0 8px 28px -4px rgba(212,175,55,0.45)',
        'glow-lg': '0 16px 48px -8px rgba(212,175,55,0.35), 0 0 0 1px rgba(212,175,55,0.15)',
        panel: '0 1px 2px rgba(0,0,0,0.04), 0 12px 24px -8px rgba(0,0,0,0.12)',
        card: '0 1px 3px rgba(28,29,26,0.06), 0 4px 12px rgba(28,29,26,0.04)',
        modal: '0 24px 60px rgba(28,29,26,0.28), 0 8px 20px rgba(28,29,26,0.12)',
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
        'ken-slow': {
          '0%': { transform: 'scale(1) translate3d(0, 0, 0)' },
          '100%': { transform: 'scale(1.06) translate3d(0, -1.5%, 0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        'fade-in-up': 'fade-in-up 0.4s cubic-bezier(0.16,1,0.3,1) both',
        'slide-up': 'slide-up 0.32s cubic-bezier(0.32,0.72,0,1) both',
        'slide-down': 'slide-down 0.32s cubic-bezier(0.32,0.72,0,1) both',
        'scale-in': 'scale-in 0.22s cubic-bezier(0.16,1,0.3,1) both',
        'bounce-in': 'bounce-in 0.55s cubic-bezier(0.34,1.56,0.64,1) both',
        pop: 'pop 0.35s ease-in-out',
        shimmer: 'shimmer 2s linear infinite',
        'ken-slow': 'ken-slow 18s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};

export default config;
