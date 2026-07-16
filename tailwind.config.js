/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // Cores dos níveis (src/lib/niveis.ts) referenciadas dinamicamente — safelist garante
  // que não sejam removidas na build.
  safelist: [
    'from-red-400', 'to-red-600',
    'from-orange-500', 'to-orange-700',
    'from-yellow-300', 'to-yellow-500',
    'from-green-400', 'to-green-600',
    'from-gray-300', 'to-gray-400',
    'bg-red-500', 'bg-orange-600', 'bg-yellow-400', 'bg-green-500', 'bg-gray-400',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
