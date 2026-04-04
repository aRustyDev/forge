/**
 * Component Adoption Enforcement Tests
 *
 * These tests scan the codebase for anti-patterns that should be replaced
 * by shared components. The expectedViolations count starts at the current
 * baseline and must decrease as pages are migrated.
 *
 * If you migrate a page, update the expectedViolations count downward.
 * If you add a new violation, the test will fail -- use the shared component instead.
 */
import { describe, test, expect } from 'bun:test'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const WEBUI_SRC = join(import.meta.dir, '..')
const ROUTES_DIR = join(WEBUI_SRC, 'routes')
const LIB_DIR = join(WEBUI_SRC, 'lib')

interface AntiPattern {
  name: string
  pattern: RegExp
  allowedIn: string[]  // filenames where the pattern is allowed (e.g. the component itself)
  message: string
  expectedViolations: number  // current count -- must decrease over time
}

const ANTI_PATTERNS: AntiPattern[] = [
  {
    name: 'PageWrapper',
    pattern: /height:\s*calc\(100vh\s*-\s*4rem\)/,
    allowedIn: ['PageWrapper.svelte'],
    message: 'Use <PageWrapper> instead of inline viewport-escape CSS (height: calc(100vh - 4rem))',
    expectedViolations: 7,
  },
  {
    name: 'SplitPanel',
    pattern: /\.list-panel\s*\{/,
    allowedIn: ['SplitPanel.svelte', 'base.css'],
    message: 'Use <SplitPanel> instead of inline .list-panel CSS',
    expectedViolations: 7,
  },
  {
    name: 'ListPanelHeader',
    pattern: /\.btn-new\s*\{/,
    allowedIn: ['ListPanelHeader.svelte'],
    message: 'Use <ListPanelHeader> instead of inline .btn-new CSS',
    expectedViolations: 7,
  },
  {
    name: 'GlobalButtonCSS',
    pattern: /\.btn-primary\s*\{/,
    allowedIn: ['base.css'],
    message: 'Use global .btn-primary class from base.css instead of page-scoped button CSS',
    expectedViolations: 18,
  },
  {
    name: 'PageHeader',
    pattern: /\.page-title\s*\{/,
    allowedIn: ['PageHeader.svelte', 'base.css'],
    message: 'Use <PageHeader> instead of page-scoped .page-title styles',
    expectedViolations: 13,
  },
  {
    name: 'TabBar',
    pattern: /\.tab-btn\s*\{/,
    allowedIn: ['TabBar.svelte'],
    message: 'Use <TabBar> instead of page-scoped .tab-btn styles',
    expectedViolations: 1,
  },
  {
    name: 'EmptyPanel',
    pattern: /\.editor-empty\s*\{|\.empty-editor\s*\{/,
    allowedIn: ['EmptyPanel.svelte'],
    message: 'Use <EmptyPanel> instead of page-scoped .editor-empty / .empty-editor styles',
    expectedViolations: 7,
  },
  {
    name: 'ListSearchInput',
    pattern: /\.search-input\s*\{/,
    allowedIn: ['ListSearchInput.svelte'],
    message: 'Use <ListSearchInput> instead of page-scoped .search-input styles',
    expectedViolations: 11,
  },
]

function collectFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = []

  function walk(d: string) {
    let entries: string[]
    try {
      entries = readdirSync(d)
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(d, entry)
      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        // Skip node_modules, .svelte-kit, build directories
        if (entry === 'node_modules' || entry === '.svelte-kit' || entry === 'build') continue
        walk(fullPath)
      } else if (extensions.some(ext => entry.endsWith(ext))) {
        results.push(fullPath)
      }
    }
  }

  walk(dir)
  return results
}

function isAllowed(filePath: string, allowedIn: string[]): boolean {
  const fileName = filePath.split('/').pop() ?? ''
  return allowedIn.some(allowed => fileName === allowed)
}

describe('Component Adoption Enforcement', () => {
  const files = collectFiles(WEBUI_SRC, ['.svelte', '.css'])

  for (const ap of ANTI_PATTERNS) {
    test(`${ap.name}: no new violations (expected ${ap.expectedViolations})`, () => {
      const violations: string[] = []

      for (const filePath of files) {
        if (isAllowed(filePath, ap.allowedIn)) continue

        let content: string
        try {
          content = readFileSync(filePath, 'utf-8')
        } catch {
          continue
        }

        if (ap.pattern.test(content)) {
          violations.push(relative(WEBUI_SRC, filePath))
        }
      }

      if (violations.length > ap.expectedViolations) {
        throw new Error(
          `${ap.name}: Found ${violations.length} violations (expected at most ${ap.expectedViolations}). ` +
          `New violation(s):\n  ${violations.join('\n  ')}\n\n` +
          `${ap.message}`
        )
      }

      if (violations.length < ap.expectedViolations) {
        throw new Error(
          `${ap.name}: Found ${violations.length} violations but expected ${ap.expectedViolations}. ` +
          `Great -- you migrated pages! Update expectedViolations to ${violations.length} in component-adoption.test.ts.\n` +
          `Remaining violations:\n  ${violations.join('\n  ')}`
        )
      }

      // Exact match -- passes
      expect(violations.length).toBe(ap.expectedViolations)
    })
  }
})
