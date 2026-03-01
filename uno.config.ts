import { defineConfig, presetUno } from 'unocss'

export default defineConfig({
  presets: [presetUno()],
  theme: {
    colors: {
      coral: '#C75B39',
      'coral-light': '#D4764E',
      'coral-bg': '#FEF0E8',
      'green-accent': '#4CAF50',
      border: '#8b929e',
      'text-primary': '#1A1A1A',
      'text-secondary': '#7A7A72',
      'code-bg': '#F5F5F5',
      'card-bg': '#FFFFFF',
    },
    fontFamily: {
      mono: 'JetBrains Mono, monospace',
      heading: 'Oswald, sans-serif',
    },
  },
  shortcuts: {
    'border-default': 'border border-border',
    'nav-item': 'rounded-1 px-4 py-1.5 border-default font-mono text-13px cursor-pointer hover:bg-gray-50 transition-colors',
    'nav-item-active': 'nav-item text-text-primary font-normal',
    'nav-item-inactive': 'nav-item text-text-secondary font-normal',
    'tag-badge': 'rounded-1 px-2 py-0.5 border-default font-mono text-11px text-text-secondary',
    'section-title': 'font-mono text-sm font-600 text-text-primary',
    'terminal-dollar': 'font-mono font-700 text-green-accent',
    'terminal-comment': 'font-mono text-13px text-text-secondary',
    'page-container': 'min-h-screen flex flex-col bg-white',
  },
})
