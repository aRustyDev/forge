// packages/extension/tests/build/output.test.ts

import { describe, test, expect } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const extRoot = join(import.meta.dir, '..', '..')

function describeBrowser(browser: 'chrome' | 'firefox') {
  const distDir = join(extRoot, 'dist', browser)
  const distExists = existsSync(distDir)

  describe(`${browser} build output`, () => {
    test.skipIf(!distExists)('dist directory exists', () => {
      expect(existsSync(distDir)).toBe(true)
    })

    test.skipIf(!distExists)('manifest.json exists with correct browser-specific content', () => {
      const manifestPath = join(distDir, 'manifest.json')
      expect(existsSync(manifestPath)).toBe(true)
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

      expect(manifest.manifest_version).toBe(3)

      if (browser === 'chrome') {
        expect(manifest.background.service_worker).toBe('background.js')
        expect(manifest.background.scripts).toBeUndefined()
        expect(manifest.browser_specific_settings).toBeUndefined()
      } else {
        expect(manifest.background.scripts).toEqual(['background.js'])
        expect(manifest.background.service_worker).toBeUndefined()
        expect(manifest.browser_specific_settings.gecko.id).toBe('forge-extension@forge.local')
      }
    })

    test.skipIf(!distExists)('background.js exists', () => {
      expect(existsSync(join(distDir, 'background.js'))).toBe(true)
    })

    test.skipIf(!distExists)('popup/index.html exists with <div id="app">', () => {
      const popupPath = join(distDir, 'popup', 'index.html')
      expect(existsSync(popupPath)).toBe(true)
      const html = readFileSync(popupPath, 'utf-8')
      expect(html).toContain('<div id="app">')
    })

    test.skipIf(!distExists)('content/linkedin.js exists', () => {
      expect(existsSync(join(distDir, 'content', 'linkedin.js'))).toBe(true)
    })

    test.skipIf(!distExists)('content/workday.js exists', () => {
      expect(existsSync(join(distDir, 'content', 'workday.js'))).toBe(true)
    })

    test.skipIf(!distExists)('content scripts have no ES module import statements', () => {
      for (const script of ['content/linkedin.js', 'content/workday.js']) {
        const scriptPath = join(distDir, script)
        expect(existsSync(scriptPath)).toBe(true)
        const code = readFileSync(scriptPath, 'utf-8')
        // Check for static ES module imports — these break executeScript injection.
        // Allow dynamic import() calls and string occurrences inside quotes.
        const lines = code.split('\n')
        for (const line of lines) {
          // Skip lines that are clearly string literals containing "import"
          const trimmed = line.trim()
          // Match: import ... from "..." or import "..."
          // But not: variable names containing "import" or comments
          if (/^\s*import\s+/.test(trimmed) || /^\s*import\s*\(/.test(trimmed)) {
            // dynamic import() is OK — only static import X from Y is a problem
            if (!/^\s*import\s*\(/.test(trimmed)) {
              throw new Error(`${script} contains ES module import: ${trimmed}`)
            }
          }
        }
      }
    })
  })
}

describeBrowser('chrome')
describeBrowser('firefox')
