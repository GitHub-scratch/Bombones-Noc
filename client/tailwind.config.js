/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chocolate: {
          light: '#5D3A2E',
          DEFAULT: '#3D1F16',
          dark: '#2A150F',
        },
        raspberry: {
          light: '#E54B5F',
          DEFAULT: '#C72C41',
          dark: '#A52436',
        },
        cream: '#FDFCFB'
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      keyframes: {
        wave: {
          '0%, 100%': { transform: 'translateX(-5%) rotate(-1deg)' },
          '50%': { transform: 'translateX(5%) rotate(1deg)' },
        }
      },
      animation: {
        wave: 'wave 4s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}
