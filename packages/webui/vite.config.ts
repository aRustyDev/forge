import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        timeout: 120000,  // 2 minutes — PDF generation can take 60s+ on first run (tectonic downloads packages)
      },
    },
  },
})
