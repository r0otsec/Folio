/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        fo: {
          bg:           '#141414',
          sidebar:      '#1c1c1c',
          surface:      '#222222',
          'surface-2':  '#2a2a2a',
          border:       '#333333',
          'border-light': '#3d3d3d',
          text1:        '#e2e2e2',
          text2:        '#999999',
          text3:        '#555555',
          purple:       '#7B6FCD',
          'purple-dim': 'rgba(123,111,205,0.12)',
          'purple-text': '#9B8FE0',
          green:        '#4CAF82',
          'green-dim':  'rgba(76,175,130,0.12)',
          'green-text': '#6ECBA0',
          red:          '#E05252',
          'red-dim':    'rgba(224,82,82,0.1)',
          amber:        '#D98B3A',
          'amber-dim':  'rgba(217,139,58,0.12)',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.4)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.5)',
      },
      borderRadius: {
        DEFAULT: '4px',
        none: '0',
        sm: '4px',
        md: '4px',
        lg: '4px',
        xl: '4px',
        '2xl': '4px',
        full: '9999px',
      },
    },
  },
  plugins: [],
}
