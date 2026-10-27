/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#F0F9FF',
          100: '#E0F2FE', // Primario suave (sky-100)
          200: '#BAE6FD',
          500: '#0284C7',
          600: '#2563EB', // Primario principal (blue-600)
          700: '#1D4ED8',
        },
        tea: {
          calm: '#F8FAFC',  // Fondo relajante (slate-50)
          card: '#FFFFFF',
          text: '#1E293B',  // Slate-800
          muted: '#64748B', // Slate-500
          border: '#E2E8F0', // Slate-200
          success: '#059669', // Emerald-600
          warm: '#B45309',    // Amber-700
          warmBg: '#FEF3C7',  // Amber-100
        }
      }
    },
  },
  plugins: [],
}
