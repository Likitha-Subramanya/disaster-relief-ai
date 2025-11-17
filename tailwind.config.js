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
        background: '#fef8ff', // baby pink tint
        foreground: '#0f172a',
        primary: {
          DEFAULT: '#7dd3fc', // sky blue
          foreground: '#0f172a',
        },
        secondary: '#fbcfe8',
        muted: '#ffffff',
        accent: '#f472b6',
        warning: '#fbbf24',
        danger: '#f87171',
      },
      boxShadow: {
        card: '0 12px 30px rgba(15, 23, 42, 0.08)'
      }
    },
  },
  plugins: [],
}
