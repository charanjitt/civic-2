/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        civic: {
          bg: '#070b14',
          surface: '#0f172a',
          card: '#131d33',
          border: '#1e293b',
          primary: '#0ea5e9',
          accent: '#10b981',
          amber: '#f59e0b',
          danger: '#ef4444',
        },
      },
    },
  },
  plugins: [],
};
