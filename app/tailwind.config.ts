import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Palette fixe 12 couleurs — projets (Règle #34)
        project: {
          violet:  '#6366F1',
          blue:    '#3B82F6',
          cyan:    '#06B6D4',
          teal:    '#14B8A6',
          green:   '#22C55E',
          lime:    '#84CC16',
          yellow:  '#EAB308',
          orange:  '#F97316',
          red:     '#EF4444',
          pink:    '#EC4899',
          purple:  '#A855F7',
          slate:   '#64748B',
        },
      },
    },
  },
  plugins: [],
}

export default config
