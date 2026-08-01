/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070a12',
          900: '#0c1220',
          850: '#111827',
          800: '#182136',
          700: '#243049',
          600: '#35425f',
          500: '#4a5a78',
        },
        brand: {
          300: '#99f6e4',
          400: '#5eead4',
          500: '#2dd4bf',
          600: '#14b8a6',
          700: '#0f766e',
        },
        accent: {
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        content: '72rem',
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-500px 0' },
          '100%': { backgroundPosition: '500px 0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.8s linear infinite',
        'fade-up': 'fade-up .3s ease-out both',
        'fade-in': 'fade-in .25s ease-out both',
        'pulse-soft': 'pulseSoft 1.6s ease-in-out infinite',
      },
      boxShadow: {
        panel: '0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 40px -16px rgba(0,0,0,0.55)',
        lift: '0 8px 24px -12px rgba(0,0,0,0.55)',
      },
    },
  },
  plugins: [],
}
