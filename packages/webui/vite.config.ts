import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

// API proxy target. Defaults to host-local dev server; override with
// FORGE_API_URL when running in Docker (where core is at http://core:3000).
const apiTarget = process.env.FORGE_API_URL ?? 'http://localhost:3000'

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        timeout: 120000,  // 2 minutes — PDF generation can take 60s+ on first run (tectonic downloads packages)
      },
    },
  },
})
