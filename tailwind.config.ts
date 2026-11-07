import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

const color = (v: string) => `hsl(var(--${v}))`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: color('border'),
        input: color('input'),
        ring: color('ring'),
        background: color('background'),
        foreground: color('foreground'),
        primary: { DEFAULT: color('primary'), foreground: color('primary-foreground') },
        secondary: { DEFAULT: color('secondary'), foreground: color('secondary-foreground') },
        destructive: { DEFAULT: color('destructive'), foreground: color('destructive-foreground') },
        muted: { DEFAULT: color('muted'), foreground: color('muted-foreground') },
        accent: { DEFAULT: color('accent'), foreground: color('accent-foreground') },
        popover: { DEFAULT: color('popover'), foreground: color('popover-foreground') },
        card: { DEFAULT: color('card'), foreground: color('card-foreground') },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      spacing: {
        'density-xs': 'max(0px, calc(var(--spacing) - 0.375rem))',
        'density-sm': 'max(0px, calc(var(--spacing) - 0.25rem))',
        'density-md': 'var(--spacing)',
        'density-lg': 'calc(var(--spacing) + 0.25rem)',
        'density-xl': 'calc(var(--spacing) + 0.75rem)',
      },
      boxShadow: {
        'retool-sm': 'var(--shadow-retool-sm)',
        'retool-md': 'var(--shadow-retool-md)',
        'retool-lg': 'var(--shadow-retool-lg)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config
