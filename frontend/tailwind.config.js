/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B1D3E',
          light: '#152B5A',
          dark: '#060E1E',
          50: '#EBF0FA',
        },
        gold: {
          DEFAULT: '#C9971A',
          light: '#E8B830',
          pale: '#FBF0C8',
          dark: '#A07810',
        },
      },
      fontFamily: {
        display: ['"Frank Ruhl Libre"', 'serif'],
        body: ['"Noto Sans Hebrew"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 12px rgba(11,29,62,0.09)',
        hover: '0 6px 28px rgba(11,29,62,0.16)',
        glow: '0 0 0 4px rgba(201,151,26,0.18)',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease forwards',
        'count-up': 'countUp 1.5s ease forwards',
        'slide-in': 'slideIn 0.3s ease forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(16px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: 0, transform: 'translateX(-12px)' },
          '100%': { opacity: 1, transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
