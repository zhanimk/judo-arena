/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0a1628',
          800: '#0f2241',
          700: '#152d52',
          600: '#1a3a68',
          500: '#1e4a85'
        },
        gold: '#ffd700',
        judo: {
          white: '#ffffff',
          blue: '#1e40af'
        }
      },
      fontFamily: {
        'exo': '["Exo 2", "sans-serif"]'
      }
    },
  },
  plugins: [],
};
