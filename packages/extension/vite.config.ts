// packages/extension/vite.config.ts

import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const browser = (process.env.BROWSER ?? 'chrome') as 'chrome' | 'firefox'
const outDir = `dist/${browser}`

/**
 * Custom plugin that copies the correct manifest into the build output
 * and relocates popup HTML to match the manifest's default_popup path.
 */
function forgeExtensionBuild(): Plugin {
  return {
    name: 'forge-extension-build',
    writeBundle() {
      const root = resolve(__dirname)
      const dist = resolve(root, outDir)

      // Copy the correct manifest
      const manifestSrc = browser === 'firefox'
        ? join(root, 'manifest.firefox.json')
        : join(root, 'manifest.json')
      cpSync(manifestSrc, join(dist, 'manifest.json'))

      // Copy icons directory
      const iconsSrc = join(root, 'icons')
      if (existsSync(iconsSrc)) {
        cpSync(iconsSrc, join(dist, 'icons'), { recursive: true })
      }

      // Vite preserves input path structure for HTML entries, so popup ends up at
      // dist/<browser>/src/popup/index.html — move it to dist/<browser>/popup/index.html
      const nestedPopup = join(dist, 'src', 'popup', 'index.html')
      const targetPopup = join(dist, 'popup', 'index.html')
      if (existsSync(nestedPopup) && !existsSync(targetPopup)) {
        mkdirSync(join(dist, 'popup'), { recursive: true })
        // Fix asset paths: Vite generates paths relative to src/popup/ (../../assets/)
        // but popup/index.html is one level shallower, so paths should be ../assets/
        let html = readFileSync(nestedPopup, 'utf-8')
        html = html.replace(/(?:\.\.\/)+assets\//g, '../assets/')
        writeFileSync(targetPopup, html)
        // Clean up nested src directory tree
        try { rmSync(join(dist, 'src'), { recursive: true }) } catch { /* ignore */ }
      }
    },
  }
}

export default defineConfig({
  plugins: [
    svelte(),
    forgeExtensionBuild(),
  ],
  // Relative base path so HTML asset references work inside the extension
  base: './',
  build: {
    outDir,
    emptyOutDir: true,
    // Prevent Vite from using ES module format for content scripts.
    // Content scripts are injected via executeScript and cannot use imports.
    rollupOptions: {
      input: {
        background: 'src/background/index.ts',
        'content-linkedin': 'src/content/linkedin.ts',
        'content-workday': 'src/content/workday.ts',
        popup: 'src/popup/index.html',
      },
      output: {
        entryFileNames(chunkInfo) {
          if (chunkInfo.name === 'background') return 'background.js'
          if (chunkInfo.name === 'content-linkedin') return 'content/linkedin.js'
          if (chunkInfo.name === 'content-workday') return 'content/workday.js'
          return 'assets/[name]-[hash].js'
        },
      },
    },
  },
})
