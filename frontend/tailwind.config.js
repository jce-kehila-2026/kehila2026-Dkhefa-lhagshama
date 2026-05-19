/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        sky:   { DEFAULT: '#BFD3E6', 2: '#DCE7F0' },
        ink:   { DEFAULT: '#0F1E2D', 2: '#2C3D52' },
        cream: '#F4EEE0',
        paper: '#FAFAF7',
        ember: '#B9694E',
        hair:  'rgba(15,30,45,0.10)',
      },
      fontFamily: {
        display: ['"Frank Ruhl Libre"', 'Georgia', 'serif'],
        body:    ['"Noto Sans Hebrew"', 'system-ui', 'sans-serif'],
        mono:    ['ui-monospace', '"SF Mono"', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card:  '0 1px 0 rgba(15,30,45,0.04), 0 8px 24px rgba(15,30,45,0.06)',
        hover: '0 1px 0 rgba(15,30,45,0.04), 0 14px 40px rgba(15,30,45,0.10)',
        focus: '0 0 0 3px rgba(185,105,78,0.35)',
      },
      animation: {
        'fade-up':  'fadeUp 0.4s ease forwards',
        'slide-in': 'slideIn 0.3s ease forwards',
      },
      keyframes: {
        fadeUp:  { '0%': { opacity: 0, transform: 'translateY(16px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        slideIn: { '0%': { opacity: 0, transform: 'translateX(-12px)' }, '100%': { opacity: 1, transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
};
