/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'fade-in-up': 'fade-in-up 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fade-in 150ms ease-out forwards',
        'zoom-in': 'zoom-in 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'spin-hover': 'spin-hover 0.5s ease-in-out',
      },
      keyframes: {
        'fade-in-up': {
          from: { transform: 'translateY(0)', opacity: '1' }
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'zoom-in': {
          from: { transform: 'scale(0.96)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' }
        },
        'spin-hover': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(180deg)' }
        }
      }
    },
  },
  plugins: [],
}
