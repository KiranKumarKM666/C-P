/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#2d6a4f',
          2: '#40916c',
          light: '#d8f3dc',
        },
        surface: {
          DEFAULT: '#ffffff',
          2: '#f9f8f6',
        },
        border: {
          DEFAULT: '#e2ddd8',
          2: '#ccc8c2',
        },
        text: {
          DEFAULT: '#1c1917',
          2: '#57534e',
          3: '#a8a29e',
        },
        bg: '#f5f4f0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '10px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-md': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'card-lg': '0 10px 30px rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.06)',
      }
    },
  },
  plugins: [],
}
