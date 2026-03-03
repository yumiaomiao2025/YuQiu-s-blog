import { defineConfig, presetUno } from 'unocss'

export default defineConfig({
  presets: [presetUno()],
  theme: {
    colors: {
      coral: '#C75B39',
      'coral-bg': '#FEF0E8',
      'green-accent': '#4CAF50',
      border: '#8b929e',
      'text-primary': '#1A1A1A',
      'text-secondary': '#7A7A72',
      'code-bg': '#F5F5F5',
    },
    fontFamily: {
      mono: 'JetBrains Mono, monospace',
      heading: 'Oswald, sans-serif',
    },
  },
  shortcuts: {},
})
