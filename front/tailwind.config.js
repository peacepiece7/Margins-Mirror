/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'rgb(var(--border) / <alpha-value>)',
        input: 'rgb(var(--input) / <alpha-value>)',
        ring: 'rgb(var(--ring) / <alpha-value>)',
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
          foreground: 'rgb(var(--secondary-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'rgb(var(--destructive) / <alpha-value>)',
          foreground: 'rgb(var(--destructive-foreground) / <alpha-value>)',
          ink: 'rgb(var(--destructive-ink) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'rgb(var(--popover) / <alpha-value>)',
          foreground: 'rgb(var(--popover-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'rgb(var(--card) / <alpha-value>)',
          foreground: 'rgb(var(--card-foreground) / <alpha-value>)',
        },
        ...Object.fromEntries(
          ['success', 'warning', 'info'].map((tone) => [
            tone,
            {
              DEFAULT: `rgb(var(--${tone}) / <alpha-value>)`,
              surface: `rgb(var(--${tone}-surface) / <alpha-value>)`,
              border: `rgb(var(--${tone}-border) / <alpha-value>)`,
              ink: `rgb(var(--${tone}-ink) / <alpha-value>)`,
            },
          ]),
        ),
        rating: 'rgb(var(--rating) / <alpha-value>)',
        link: 'rgb(var(--link) / <alpha-value>)',
        margins: {
          bg: 'rgb(var(--background) / <alpha-value>)',
          paper: 'rgb(var(--card) / <alpha-value>)',
          ink: 'rgb(var(--foreground) / <alpha-value>)',
          muted: 'rgb(var(--muted-foreground) / <alpha-value>)',
          line: 'rgb(var(--border) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 1px)',
        sm: 'calc(var(--radius) - 2px)',
      },
      fontFamily: {
        heading: ['var(--font-heading)'],
        mono: ['var(--font-mono)'],
        display: ['var(--font-display)'],
        sans: ['var(--font-sans)'],
      },
      boxShadow: {
        editorial: 'var(--shadow-editorial)',
        'editorial-sm': 'var(--shadow-editorial-sm)',
      },
    },
  },
  plugins: [],
};
