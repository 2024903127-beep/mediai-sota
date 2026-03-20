/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0',
          300: '#6ee7b7', 400: '#34d399', 500: '#10b981',
          600: '#16a37a', 700: '#0d7a5c', 800: '#065f46', 900: '#064e3b',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      borderRadius: { '3xl': '1.5rem', '4xl': '2rem' },
      boxShadow: {
        'card':     '0 1px 2px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.03)',
        'soft':     '0 2px 20px rgba(0,0,0,.06)',
        'lift':     '0 8px 24px rgba(0,0,0,.10)',
        'brand-sm': '0 2px 8px rgba(22,163,122,.20)',
        'brand-md': '0 4px 16px rgba(22,163,122,.25)',
        'inner-sm': 'inset 0 1px 2px rgba(0,0,0,.06)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #16a37a 0%, #0ea5e9 100%)',
        'hero-gradient':  'linear-gradient(160deg, #ecfdf5 0%, #f0f9ff 50%, #f8fafc 100%)',
        'card-gradient':  'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(236,253,245,.5) 100%)',
      },
      animation: {
        'fade-in':   'fadeIn .25s ease both',
        'slide-up':  'slideUp .3s cubic-bezier(.16,1,.3,1) both',
        'scale-in':  'scaleIn .2s ease both',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' },                              to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(.96)' },      to: { opacity: '1', transform: 'scale(1)' } },
      },
      spacing: { '18': '4.5rem', '88': '22rem', '112': '28rem' },
      screens: { 'xs': '475px' },
      zIndex:  { '60': '60', '70': '70' },
    },
  },
  plugins: [],
}

