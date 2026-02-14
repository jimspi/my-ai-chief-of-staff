import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          bg: '#F7F5F0',
          card: '#FFFFFF',
          border: '#E8E4DE',
        },
        text: {
          primary: '#1A1A1A',
          secondary: '#6B6560',
        },
        accent: {
          teal: '#1A6B5C',
          'teal-hover': '#15574B',
          'teal-light': '#E8F5F0',
        },
        status: {
          danger: '#C4483E',
          'danger-light': '#FDF2F1',
          warning: '#D4942A',
          'warning-light': '#FEF7EC',
          success: '#4A8B6E',
          'success-light': '#EFF8F4',
        },
      },
      fontFamily: {
        heading: ['var(--font-dm-serif)', 'serif'],
        sans: ['var(--font-dm-sans)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        button: '8px',
        input: '6px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(26,26,26,0.06)',
        'card-hover': '0 4px 12px rgba(26,26,26,0.1)',
        modal: '0 8px 30px rgba(26,26,26,0.12)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-out-right': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
        'fade-out': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out forwards',
        'slide-out-right': 'slide-out-right 0.3s ease-out forwards',
        'fade-out': 'fade-out 0.2s ease-in forwards',
        shimmer: 'shimmer 2s infinite linear',
        'scale-in': 'scale-in 0.2s ease-out forwards',
      },
    },
  },
  plugins: [],
};
export default config;
