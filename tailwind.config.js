/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#9f0f0f',
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#dc2626',
          600: '#c41818',
          700: '#9f0f0f',
          800: '#7f0c0c',
          900: '#660a0a',
          950: '#400505',
        },
      },
      fontFamily: {
        sans: ['"Noto Serif"', 'serif'],
        display: ['"Noto Serif"', 'serif'],
      },
      boxShadow: {
        brand: '0 10px 30px -10px rgba(159, 15, 15, 0.45)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'scale-in': 'scale-in 0.3s ease-out both',
        'shake': 'shake 0.4s ease-in-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out both',
        'slide-up': 'slide-up 0.3s ease-out both',
      },
    },
  },
  plugins: [],
}
