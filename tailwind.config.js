/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Plus Jakarta Sans','system-ui','sans-serif'] },
      colors: {
        sidebar: '#111827',
      },
    },
  },
  plugins: [],
};
