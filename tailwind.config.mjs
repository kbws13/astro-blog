import typography from '@tailwindcss/typography'
import { fontFamily } from 'tailwindcss/defaultTheme'

const fg = 'hsl(var(--foreground) / var(--tw-text-opacity, 1))'
const fgMuted = 'hsl(var(--muted-foreground) / var(--tw-text-opacity, 1))'
const bgMuted = 'hsl(var(--muted) / var(--tw-bg-opacity, 1))'

const typographyConfig = ({ theme }) => ({
  axi: {
    css: {
      '--tw-prose-headings': fg,
      '--tw-prose-body': fgMuted,
      '--tw-prose-links': fg,
      '--tw-prose-quotes': fgMuted,
      '--tw-prose-code:': fg,
      '--tw-prose-pre-code': fgMuted,
      '--tw-prose-pre-bg': bgMuted,

      'p a, li a, blockquote a, td a': {
        color: fg,
        textDecoration: 'underline',
        textDecorationColor: 'hsl(var(--muted-foreground) / 0.5)',
        textUnderlineOffset: '0.125rem',
        transition: 'all 0.2s ease',
        borderRadius: '0.25rem',
        padding: '0.125rem 0.25rem',
        margin: '-0.125rem -0.25rem',
        '&:hover': {
          textDecoration: 'none',
          backgroundColor: fg,
          color: 'hsl(var(--background))',
        }
      },

      'h2, h3, h4, h5, h6': {
        scrollMarginTop: '3rem',
        '& > a': {
          marginInlineStart: '0.75rem',
          color: fgMuted,
          transition: 'opacity 0.2s ease',
          opacity: '0',
          '&:focus': {
            opacity: 1
          }
        },
        '&:hover > a, &:target > a': {
          opacity: '1'
        }
      },
      img: {
        borderRadius: theme('borderRadius.lg'),
        margin: '0 auto'
      },
      table: {
        width: '100%',
        borderCollapse: 'collapse',
        margin: '1.75rem 0',
        fontSize: '0.9em',
        lineHeight: '1.65',
        overflowX: 'scroll'
      },
      thead: {
        backgroundColor: 'hsl(var(--muted) / 0.5)'
      },
      'thead th': {
        padding: '0.6rem 0.9rem',
        fontWeight: '600',
        color: fg,
        whiteSpace: 'nowrap',
        borderBottom: '2px solid hsl(var(--border))'
      },
      'tbody td': {
        padding: '0.6rem 0.9rem',
        verticalAlign: 'top',
        borderBottom: '1px solid hsl(var(--border) / 0.7)'
      },
      // The typography plugin's default `tbody tr:last-child` rule removes the
      // row border; borders live on td so the final row stays separated from
      // the content below.
      'tbody tr:last-child td': {
        borderBottom: '1px solid hsl(var(--border) / 0.7)'
      },
      'tbody tr:hover': {
        backgroundColor: 'hsl(var(--muted) / 0.35)'
      },
      blockquote: {
        position: 'relative',
        overflow: 'hidden',
        borderWidth: '0.1rem',
        borderRadius: theme('borderRadius.lg'),
        paddingInlineStart: '1.6rem !important',
        paddingInlineEnd: '1.6rem !important',
        '&::after': {
          position: 'absolute',
          content: '"”"',
          top: '-5.4rem',
          right: '-1.4rem',
          fontSize: '10rem',
          fontFamily:
            '"Trebuchet MS", "Lucida Sans Unicode", "Lucida Grande", "Lucida Sans", Arial, sans-serif',
          transform: 'rotate(-15deg)',
          opacity: '5%'
        },
        p: {
          '&:first-of-type:before, &:first-of-type:after': {
            display: 'none'
          }
        }
      }
    }
  }
})

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'
  ],
  darkMode: ['class'],
  safelist: ['dark'],
  plugins: [typography()],

  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)'
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      fontFamily: {
        sans: ['Century Gothic', 'ComicShannsMono', 'Satoshi', ...fontFamily.sans]
      },
      typography: typographyConfig
    }
  }
}

export default config
