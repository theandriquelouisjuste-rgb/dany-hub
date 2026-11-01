const c = (v) => `rgb(var(--${v}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'),
        card: c('card'),
        card2: c('card2'),
        line: c('line'),
        field: c('field'),
        ink: c('ink'),
        muted: c('muted'),
        accent: c('accent'),
      },
      fontFamily: { sans: ['Poppins', 'Inter', 'system-ui', 'sans-serif'] },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'none' } },
        'pop': { '0%': { opacity: 0, transform: 'scale(.96)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: { 'fade-up': 'fade-up .4s ease both', pop: 'pop .2s ease both' },
    },
  },
  plugins: [],
}
