/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: [
          'JetBrains Mono',
          'SF Mono',
          'Menlo',
          'Consolas',
          'monospace'
        ]
      },
      colors: {
        bg: {
          DEFAULT: '#faf8f5',
          panel: '#ffffff',
          subtle: '#f3efea',
          hover: '#ece6dc'
        },
        border: {
          DEFAULT: '#e3dcd0',
          strong: '#cfc6b6'
        },
        accent: {
          DEFAULT: '#c4592b',
          hover: '#a94717'
        },
        muted: '#8a8276',
        ink: {
          DEFAULT: '#2b2a26',
          soft: '#56544e'
        }
      }
    }
  },
  plugins: []
}
