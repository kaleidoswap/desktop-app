/** @type {import('tailwindcss').Config} */
// eslint-disable-next-line import/no-anonymous-default-export, import/no-default-export
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  plugins: [],
  theme: {
    extend: {
      colors: {
        background: '#202027',
        'blue-dark': '#2E303C',
        'blue-darker': '#252632',
        'blue-darkest': '#1E1F28',
        cyan: {
          DEFAULT: '#8FD5EA',
          50: '#F0F9FC',
          100: '#E1F3F8',
          200: '#C3E7F1',
          300: '#A6DBE9',
          400: '#8FD5EA',
          500: '#5FC1E0',
          600: '#2FACD6',
          700: '#2589AB',
          800: '#1B677F',
          900: '#124454',
        },
        divider: '#56596C',
        green: {
          DEFAULT: '#97FB9B',
          50: '#ECFDED',
          100: '#D9FBDB',
          200: '#B4F9B7',
          300: '#97FB9B', // Original green color as 300
          400: '#6DF973',
          500: '#43F74A',
          600: '#19F522',
          700: '#12C81A',
          800: '#0E9614',
          900: '#064e3b', // Original dark green as 900
        },
        blue: {
          DEFAULT: '#3B82F6', // Standard blue
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        purple: {
          DEFAULT: '#6F68EB', // Original purple as DEFAULT
          50: '#F3F2FD',
          100: '#E7E6FB',
          200: '#CFCDF8',
          300: '#B7B3F4',
          400: '#9390EF',
          500: '#6F68EB', // Original purple as 500
          600: '#4A40E5',
          700: '#2A1FD7',
          800: '#2119AB',
          900: '#18137F',
        },
        red: {
          DEFAULT: '#F58D8A', // Original red as DEFAULT
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#F58D8A', // Original red as 500
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
        },
        rose: {
          DEFAULT: '#F43F5E',
          50: '#FFF1F2',
          100: '#FFE4E6',
          200: '#FECDD3',
          300: '#FDA4AF',
          400: '#FB7185',
          500: '#F43F5E',
          600: '#E11D48',
          700: '#BE123C',
          800: '#9F1239',
          900: '#881337',
        },
        slate: {
          DEFAULT: '#64748B',
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        grey: {
          light: '#A6A6A6',
          lighter: '#D9D9D9',
        },
        'section-lighter': '#3A3C4A',
      },
      fontFamily: {
        sans: ['Mulish', 'sans-serif'],
      },
      spacing: {
        'screen-90': '90vh',
        'screen-80': '80vh',
        'screen-70': '70vh',
      },
      maxHeight: {
        'screen-90': '90vh',
        'screen-80': '80vh',
        'screen-70': '70vh',
      },
      minHeight: {
        'screen-90': '90vh',
        'screen-80': '80vh',
        'screen-70': '70vh',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'fadeIn': 'fadeIn 0.5s ease-in forwards',
        'fadeInUp': 'fadeInUp 0.5s ease-out forwards',
        'slideInRight': 'slideInRight 0.5s ease-out forwards',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scaleIn': 'scaleIn 0.3s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { 
            opacity: '0', 
            transform: 'translateY(20px)' 
          },
          '100%': { 
            opacity: '1', 
            transform: 'translateY(0)' 
          },
        },
        slideInRight: {
          '0%': { 
            opacity: '0', 
            transform: 'translateX(-20px)' 
          },
          '100%': { 
            opacity: '1', 
            transform: 'translateX(0)' 
          },
        },
        scaleIn: {
          '0%': { 
            opacity: '0', 
            transform: 'scale(0.95)' 
          },
          '100%': { 
            opacity: '1', 
            transform: 'scale(1)' 
          },
        },
        spin: {
          '0%': { 
            transform: 'rotate(0deg)' 
          },
          '100%': { 
            transform: 'rotate(360deg)' 
          },
        },
        pulse: {
          '0%, 100%': { 
            opacity: '1',
            transform: 'scale(1)',
          },
          '50%': { 
            opacity: '.9',
            transform: 'scale(1.05)',
          },
        },
        shutdown: {
          '0%': { width: '0%' },
          '100%': { width: '100%' }
        }
      },
    },
  },
}
