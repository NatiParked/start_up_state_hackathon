/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        ink: '#1a1a1a',
        bone: '#f8f8f6',
        cedar: '#6b7d6a',
        storm: '#4a5f7f',
        rust: '#c85a54',
        harvest: '#d4a574',
        offwhite: '#f5f5f3',
        hair: '#ececec',
      },
      fontFamily: {
        serif: ['"IM Fell English"', 'Georgia', 'serif'],
        body: ['"Libre Baskerville"', 'Georgia', 'serif'],
        label: ['"Special Elite"', 'monospace'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
