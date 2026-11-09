/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // Primario: Teal profundo, relajante y terapéutico para personas con TEA
        brand: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488', // Primario principal (#0D9488 - Teal 600, contraste 4.6+:1 en blanco)
          700: '#0F766E', // Hover / Enfasis primario
          800: '#115E59',
          900: '#134E4A',
        },
        // Acento: Ámbar suave / tierra cálida para destacar y estados activos
        accent: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706', // Ámbar accesible
          700: '#B45309',
        },
        // Neutros cálidos para eliminar la frialdad y el deslumbramiento sensorial
        tea: {
          calm: '#F8F9FA',      // Fondo base cálido, reduce fatiga visual
          card: '#FFFFFF',      // Superficie limpia
          cardSubtle: '#F1F3F5',// Superficie secundaria tenue
          border: '#E9ECEF',    // Borde muy sutil
          borderHover: '#DEE2E6',
          text: '#212529',      // Texto principal de alto contraste (ratio > 11:1)
          muted: '#495057',     // Texto secundario legible (ratio > 4.8:1 con fondo calm)
          subtle: '#6C757D',    // Metadatos accesibles (> 4.5:1)
        }
      },
      boxShadow: {
        'soft-xs': '0 1px 2px 0 rgba(33, 37, 41, 0.03)',
        'soft': '0 2px 8px -2px rgba(33, 37, 41, 0.05), 0 1px 3px -1px rgba(33, 37, 41, 0.03)',
        'soft-md': '0 6px 16px -4px rgba(33, 37, 41, 0.07), 0 2px 6px -2px rgba(33, 37, 41, 0.04)',
        'soft-lg': '0 12px 28px -6px rgba(33, 37, 41, 0.09), 0 4px 12px -3px rgba(33, 37, 41, 0.05)',
      },
      transitionDuration: {
        '180': '180ms',
      }
    },
  },
  plugins: [],
}
