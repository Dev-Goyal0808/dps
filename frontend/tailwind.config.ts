import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#10233f',
        navy: '#122d50',
        mist: '#eef4f8',
        aqua: '#22c7b8',
        coral: '#ff8b72',
        gold: '#ffc857',
      },
      fontFamily: {
        display: ['"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 18px 55px rgba(16, 35, 63, 0.09)',
        panel: '0 14px 36px rgba(16, 35, 63, 0.14)',
      },
      backgroundImage: {
        'hero-grid': 'linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)',
      },
      animation: {
        'fade-up': 'fade-up .55s ease-out both',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '.55' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
