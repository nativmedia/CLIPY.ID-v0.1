/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: { transparent: 'transparent', current: 'currentColor', black: '#000', white: '#fff', slate: {50:'#fafafa',100:'#f5f5f5',200:'#e5e5e5',300:'#d4d4d4',400:'#aaa',500:'#959595',600:'#8a8a8a',700:'#444',800:'#262626',900:'#171717',950:'#080808'} },
    extend: {
      colors: {
        ink: {
          950: '#080808',
          900: '#111111',
          850: '#191919',
          800: '#222222',
          700: '#333333',
          600: '#444444',
        },
        brand: {
          400: '#ffffff',
          500: '#eeeeee',
          600: '#cccccc',
        },
        accent: {
          400: '#eeeeee',
          500: '#bbbbbb',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-500px 0' }, '100%': { backgroundPosition: '500px 0' } },
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: {
        shimmer: 'shimmer 1.8s linear infinite',
        'fade-up': 'fade-up .35s ease-out both',
      },
    },
  },
  plugins: [],
}
