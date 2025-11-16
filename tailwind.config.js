/****/ // Tailwind config
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0b1020',
        foreground: '#e6e9f2',
        primary: {
          DEFAULT: '#4f46e5',
          foreground: '#ffffff',
        },
        muted: '#121933',
        accent: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      boxShadow: {
        card: '0 6px 30px rgba(0,0,0,0.25)'
      }
    },
  },
  plugins: [],
}
