/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Claude-inspired terracotta brand palette. Existing rose/pink utilities
        // intentionally resolve to this warm orange spectrum across the app.
        rose: {
          50: '#fff7f2',
          100: '#ffeadf',
          200: '#f6cbb5',
          300: '#edab89',
          400: '#e58d68',
          500: '#d97757',
          600: '#c15f3f',
          700: '#a9472e',
          800: '#863f2c',
          900: '#6b3327',
          950: '#3d1b15',
        },
        pink: {
          50: '#fff9f5',
          100: '#fff0e7',
          200: '#f5cfbd',
          300: '#edb18e',
          400: '#e49a72',
          500: '#dc7c52',
          600: '#c9653f',
          700: '#a94d2f',
          800: '#883e28',
          900: '#6e3224',
          950: '#401b13',
        },
      },
      fontFamily: {
        sans: ['var(--app-font-family)'],
        serif: ['var(--app-font-family)'],
        mono: ['var(--app-font-family)'],
      },
    },
  },
  plugins: [],
}
