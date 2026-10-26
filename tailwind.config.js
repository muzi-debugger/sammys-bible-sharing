/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#FAF7F0',
        cream: '#F1E8D9',
        forest: {
          DEFAULT: '#34483A',
          soft: '#4A6152',
        },
        sage: '#A6B39B',
        terracotta: '#B87960',
        gold: '#C5A46D',
        charcoal: '#302F2A',
        'soft-white': '#FFFEFA',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'scripture': ['1.375rem', { lineHeight: '2.05', letterSpacing: '0.002em' }],
        'scripture-lg': ['1.6rem', { lineHeight: '2.1', letterSpacing: '0.002em' }],
      },
      borderRadius: {
        journal: '14px',
        'journal-lg': '18px',
      },
      boxShadow: {
        paper: '0 1px 2px rgba(48, 47, 42, 0.04), 0 12px 32px -24px rgba(48, 47, 42, 0.35)',
        'paper-lift': '0 2px 4px rgba(48, 47, 42, 0.05), 0 18px 44px -28px rgba(48, 47, 42, 0.45)',
      },
      transitionTimingFunction: {
        gentle: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'soft-pulse': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.55s cubic-bezier(0.22, 0.61, 0.36, 1) both',
        'fade-in': 'fade-in 0.4s ease both',
        'soft-pulse': 'soft-pulse 2.4s ease-in-out infinite',
      },
      maxWidth: {
        reading: '62ch',
      },
    },
  },
  plugins: [],
};
