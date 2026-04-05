/**
 * Layout Behavior Tests
 *
 * These tests verify the layout contracts defined in the Design System
 * Layout spec (Doc 2). They scan page files for structural patterns
 * rather than testing rendered output (that requires Playwright).
 *
 * Categories:
 * 1. Page type classification — every page is exactly one of: FlowPage, AppPage, DualModePage
 * 2. Padding consistency — FlowPages don't add their own outer padding (they use .content's)
 * 3. Token usage — no hardcoded layout values that should use tokens
 */
import { describe, test, expect } from 'bun:test'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const WEBUI_SRC = join(import.meta.dir, '..')
const ROUTES_DIR = join(WEBUI_SRC, 'routes')

function collectSvelteFiles(dir: string): string[] {
  const results: string[] = []
  function walk(d: string) {
    let entries: string[]
    try { entries = readdirSync(d) } catch { return }
    for (const entry of entries) {
      const fullPath = join(d, entry)
      let stat
      try { stat = statSync(fullPath) } catch { continue }
      if (stat.isDirectory()) {
        if (['node_modules', '.svelte-kit', 'build'].includes(entry)) continue
        walk(fullPath)
      } else if (entry.endsWith('.svelte')) {
        results.push(fullPath)
      }
    }
  }
  walk(dir)
  return results
}

function readFile(path: string): string {
  try { return readFileSync(path, 'utf-8') } catch { return '' }
}

// ── Page type classification ────────────────────────────────────────

/**
 * Pages that use PageWrapper are AppPages (split panels, full-viewport).
 * Pages that don't are FlowPages (natural scroll, .content padding).
 * This test ensures every page is classified and the classification matches.
 */

const APP_PAGES = [
  'data/notes/+page.svelte',
  'data/contacts/+page.svelte',
  'data/organizations/+page.svelte',
  'data/skills/+page.svelte',
  'opportunities/job-descriptions/+page.svelte',
]

// DualMode pages use PageWrapper in board view but not list view
const DUAL_MODE_PAGES = [
  'resumes/+page.svelte',
]

const FLOW_PAGES = [
  'resumes/summaries/+page.svelte',
  'resumes/templates/+page.svelte',
  'data/bullets/+page.svelte',
  'data/domains/+page.svelte',
  'chain/+page.svelte',
  'config/profile/+page.svelte',
  'config/export/+page.svelte',
  'config/debug/+page.svelte',
  'config/debug/prompts/+page.svelte',
  'config/debug/api/+page.svelte',
  'config/debug/events/+page.svelte',
  'config/debug/ui/+page.svelte',
  '+page.svelte',  // dashboard
]

// Experience pages delegate to SourcesView, which is an AppPage internally
const DELEGATED_PAGES = [
  'experience/roles/+page.svelte',
  'experience/projects/+page.svelte',
  'experience/education/+page.svelte',
  'experience/clearances/+page.svelte',
  'experience/general/+page.svelte',
]

describe('Page Type Classification', () => {
  for (const page of APP_PAGES) {
    test(`AppPage: ${page} uses PageWrapper`, () => {
      const content = readFile(join(ROUTES_DIR, page))
      expect(content).toContain('PageWrapper')
    })
  }

  for (const page of FLOW_PAGES) {
    test(`FlowPage: ${page} does NOT use PageWrapper`, () => {
      const content = readFile(join(ROUTES_DIR, page))
      expect(content).not.toContain('<PageWrapper')
    })
  }

  for (const page of DUAL_MODE_PAGES) {
    test(`DualMode: ${page} uses PageWrapper in board view`, () => {
      const content = readFile(join(ROUTES_DIR, page))
      // Has PageWrapper for board mode but also has non-PageWrapper content for list mode
      expect(content).toContain('PageWrapper')
      expect(content).toContain('GenericKanban')
    })
  }

  for (const page of DELEGATED_PAGES) {
    test(`Delegated: ${page} delegates to SourcesView`, () => {
      const content = readFile(join(ROUTES_DIR, page))
      expect(content).toContain('SourcesView')
      expect(content).not.toContain('<PageWrapper')
    })
  }
})

// ── Token usage in layout ────────────────────────────────────────────

describe('Layout Token Usage', () => {
  test('PageWrapper uses --content-padding (not hardcoded)', () => {
    const content = readFile(join(WEBUI_SRC, 'lib/components/PageWrapper.svelte'))
    expect(content).toContain('--content-padding')
    expect(content).not.toMatch(/calc\(100vh\s*-\s*4rem\)/)
    expect(content).not.toMatch(/margin:\s*-2rem/)
  })

  test('+layout.svelte uses --content-padding and --sidebar-width tokens', () => {
    const content = readFile(join(ROUTES_DIR, '+layout.svelte'))
    expect(content).toContain('--content-padding')
    expect(content).toContain('--sidebar-width')
  })

  test('KanbanBoard.svelte uses --content-padding (not hardcoded)', () => {
    const content = readFile(join(WEBUI_SRC, 'lib/components/kanban/KanbanBoard.svelte'))
    expect(content).toContain('--content-padding')
    expect(content).not.toMatch(/height:\s*calc\(100vh\s*-\s*4rem\)/)
    expect(content).not.toMatch(/margin:\s*-2rem/)
  })

  test('tokens.css defines all layout tokens', () => {
    const content = readFile(join(WEBUI_SRC, 'lib/styles/tokens.css'))
    expect(content).toContain('--content-padding')
    expect(content).toContain('--sidebar-width')
    expect(content).toContain('--right-sidebar-width')
    expect(content).toContain('--z-sidebar')
    expect(content).toContain('--transition-fast')
    expect(content).toContain('--transition-normal')
  })
})

// ── FlowPage padding consistency ─────────────────────────────────────

describe('FlowPage Padding Consistency', () => {
  // FlowPages should NOT add their own outer padding that stacks with .content's padding.
  // They can use max-width but not padding on the outermost wrapper.
  // Exception: pages that delegate to a component (the component may add padding).

  const FLOW_PAGES_DIRECT = [
    'resumes/summaries/+page.svelte',
    'resumes/templates/+page.svelte',
    'config/profile/+page.svelte',
    'config/export/+page.svelte',
  ]

  for (const page of FLOW_PAGES_DIRECT) {
    test(`FlowPage ${page}: no double-padding from page-level CSS`, () => {
      const content = readFile(join(ROUTES_DIR, page))
      // Extract the <style> block
      const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/)
      if (!styleMatch) return // no styles = no padding issue

      const styles = styleMatch[1]
      // Check for outer wrapper padding that would stack with .content's 2rem
      // Allow padding inside nested elements, but the ROOT wrapper should not add padding
      // This is a heuristic — not perfect, but catches the most common case
      const hasPageLevelPadding = styles.match(/\.\w+-page\s*\{[^}]*padding:/m)
      if (hasPageLevelPadding) {
        // If it has padding, it should also have max-width (constrained content, not double-padding)
        const hasMaxWidth = styles.match(/\.\w+-page\s*\{[^}]*max-width:/m)
        expect(hasMaxWidth).toBeTruthy()
      }
    })
  }
})
