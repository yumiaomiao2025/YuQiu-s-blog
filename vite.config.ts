import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import UnoCSS from 'unocss/vite'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [UnoCSS(), react(), cloudflare()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})