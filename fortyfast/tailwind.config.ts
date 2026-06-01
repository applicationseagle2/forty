import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: '#FBF8F3',
          100: '#F5F0E6',
          200: '#EDE4D0',
          300: '#E0D3B5',
        },
        ink: {
          900: '#1A1612',
          700: '#3D362E',
          500: '#6B5F52',
          300: '#A89A8A',
        },
        sage: {
          50: '#EDF0EA',
          200: '#C5D0B8',
          500: '#6B7F4F',
          700: '#4A5B36',
          900: '#2D3A20',
        },
        ember: {
          500: '#B8693D',
          700: '#8B4A28',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Geist', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
    },
  },
  plugins: [],
};

export default config;
