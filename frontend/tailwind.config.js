import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: { ink: '#26352f', moss: '#55705b', clay: '#bd6846', paper: '#f5f3ec', line: '#e5e2d9', citron: '#e5c76a' },
      fontFamily: { sans: ['DM Sans', 'Noto Sans Khmer', 'sans-serif'] },
      boxShadow: { soft: '0 14px 36px rgba(38, 53, 47, .08)' }
    }
  },
  plugins: [forms, typography]
};