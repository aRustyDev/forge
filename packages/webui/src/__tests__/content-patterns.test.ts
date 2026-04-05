import { describe, test, expect } from 'bun:test'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const COMPONENTS = join(import.meta.dir, '..', 'lib', 'components')
const STYLES = join(import.meta.dir, '..', 'lib', 'styles')
const ROUTES = join(import.meta.dir, '..', 'routes')

function read(path: string): string {
  return readFileSync(path, 'utf-8')
}

function readComponent(name: string): string {
  return read(join(COMPONENTS, name))
}

function readCSS(name: string): string {
  return read(join(STYLES, name))
}

/** Recursively find all .svelte files under a directory */
function findSvelteFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findSvelteFiles(fullPath))
    } else if (entry.name.endsWith('.svelte')) {
      results.push(fullPath)
    }
  }
  return results
}

describe('Content Patterns', () => {
  // AC #1: Entry selected state shows primary border
  describe('Entry.svelte', () => {
    const content = readComponent('Entry.svelte')

    test('selected state uses --color-primary for border', () => {
      expect(content).toContain('.entry.selected')
      expect(content).toContain('--color-primary')
    })

    test('has always-present transparent left border', () => {
      expect(content).toMatch(/border-left:\s*3px\s+solid\s+transparent/)
    })

    test('selected state has --color-primary-subtle background', () => {
      expect(content).toContain('--color-primary-subtle')
    })

    test('has role="button" for interactive entries', () => {
      expect(content).toContain('role=')
      expect(content).toContain('tabindex=')
    })

    test('handles keyboard activation (Enter and Space)', () => {
      expect(content).toContain("e.key === 'Enter'")
      expect(content).toContain("e.key === ' '")
    })
  })

  // AC #2: PaddedEntry no layout shift on selection
  describe('PaddedEntry.svelte', () => {
    const content = readComponent('PaddedEntry.svelte')

    test('base state has 1px border', () => {
      expect(content).toMatch(/\.padded-entry\s*\{[^}]*border:\s*1px\s+solid/)
    })

    test('selected state compensates border width with padding-left calc', () => {
      expect(content).toContain('.padded-entry.selected')
      expect(content).toMatch(/padding-left:\s*calc/)
    })

    test('selected state uses 3px primary border', () => {
      expect(content).toMatch(/border-left:\s*3px\s+solid\s+var\(--color-primary\)/)
    })

    // AC #3: PaddedEntry disabled state
    test('disabled state has opacity 0.5 and pointer-events none', () => {
      expect(content).toContain('.padded-entry.disabled')
      expect(content).toContain('opacity: 0.5')
      expect(content).toContain('pointer-events: none')
    })

    test('supports template variant', () => {
      expect(content).toContain('padded-entry--template')
      expect(content).toContain('--color-template-border')
      expect(content).toContain('--color-template-bg')
    })
  })

  // AC #4: Forms use TitledDataInput pattern
  describe('TitledDataInput (base.css)', () => {
    const content = readCSS('base.css')

    test('has .form-field with column layout', () => {
      expect(content).toContain('.form-field')
      expect(content).toMatch(/\.form-field\s*\{[^}]*flex-direction:\s*column/)
    })

    test('has .field-label with correct styling', () => {
      expect(content).toContain('.field-label')
      expect(content).toMatch(/\.field-label\s*\{[^}]*--font-medium/)
    })

    test('has .field-hint class', () => {
      expect(content).toContain('.field-hint')
      expect(content).toContain('--text-faint')
    })

    test('has .field-required class', () => {
      expect(content).toContain('.field-required')
      expect(content).toContain('--color-danger')
    })

    test('has .form-section-heading class', () => {
      expect(content).toContain('.form-section-heading')
    })

    test('has .form-grid class for two-column layouts', () => {
      expect(content).toContain('.form-grid')
      expect(content).toContain('grid-template-columns: 1fr 1fr')
    })

    test('.field-input has disabled state', () => {
      expect(content).toContain('.field-input:disabled')
      expect(content).toContain('--color-surface-sunken')
    })

    test('.field-input has placeholder styling', () => {
      expect(content).toContain('.field-input::placeholder')
    })

    test('.field-input uses var(--text-sm) not var(--text-base)', () => {
      // Match .field-input { ... font-size: var(--text-sm) ... }
      const fieldInputBlock = content.match(/\.field-input\s*\{[^}]*\}/)?.[0] ?? ''
      expect(fieldInputBlock).toContain('--text-sm')
      expect(fieldInputBlock).not.toContain('--text-base')
    })
  })

  // AC #5: SectionedList section headers with uppercase
  describe('SectionedList.svelte', () => {
    const content = readComponent('SectionedList.svelte')

    test('renders section header elements', () => {
      expect(content).toContain('sectioned-list__header')
    })

    test('section title has uppercase styling', () => {
      expect(content).toContain('text-transform: uppercase')
    })

    test('uses count-badge class for counts', () => {
      expect(content).toContain('count-badge')
    })

    test('has empty message with italic styling', () => {
      expect(content).toContain('sectioned-list__empty')
      expect(content).toContain('font-style: italic')
    })
  })

  // AC #6: TagsList remove aria-label
  describe('TagsList.svelte', () => {
    const content = readComponent('TagsList.svelte')

    test('remove button has aria-label with tag name interpolation', () => {
      expect(content).toMatch(/aria-label="Remove \{tag\}"/)
    })

    test('has role="list" on container', () => {
      expect(content).toContain('role="list"')
    })

    test('has role="listitem" on each tag', () => {
      expect(content).toContain('role="listitem"')
    })

    test('supports color variants', () => {
      expect(content).toContain('tags-list__pill--accent')
      expect(content).toContain('tags-list__pill--neutral')
      expect(content).toContain('tags-list__pill--info')
      expect(content).toContain('tags-list__pill--success')
      expect(content).toContain('tags-list__pill--warning')
    })

    test('supports size variants', () => {
      expect(content).toContain('tags-list__pill--sm')
      expect(content).toContain('tags-list__pill--md')
    })
  })

  // AC #7: Detail components accept onClose as optional
  describe('Detail component onClose', () => {
    test('ChainViewModal has optional onClose prop', () => {
      const content = readComponent('ChainViewModal.svelte')
      expect(content).toMatch(/onClose\??:\s*\(\)\s*=>\s*void/)
    })
  })

  // AC #8: EmptyPanel renders centered italic
  describe('EmptyPanel.svelte', () => {
    const content = readComponent('EmptyPanel.svelte')

    test('has centered flex layout', () => {
      expect(content).toContain('display: flex')
      expect(content).toContain('align-items: center')
      expect(content).toContain('justify-content: center')
    })

    test('uses italic font style', () => {
      expect(content).toContain('font-style: italic')
    })

    test('uses --text-faint color (not --text-muted)', () => {
      expect(content).toContain('--text-faint')
    })

    test('has no action button (lightweight placeholder only)', () => {
      expect(content).not.toContain('actionLabel')
      expect(content).not.toContain('onAction')
      expect(content).not.toContain('<button')
    })
  })

  // AC #9: EmptyState renders title + description + CTA
  describe('EmptyState.svelte', () => {
    const content = readComponent('EmptyState.svelte')

    test('has title element with BEM class', () => {
      expect(content).toContain('empty-state__title')
    })

    test('has description element with BEM class', () => {
      expect(content).toContain('empty-state__description')
    })

    test('has CTA wrapper with BEM class', () => {
      expect(content).toContain('empty-state__cta')
    })

    test('uses design tokens for padding (no hardcoded rem/px)', () => {
      const styleBlock = content.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? ''
      // Padding should be var(--space-12), not 3rem or 2rem
      expect(styleBlock).not.toMatch(/padding:\s*\d+(\.\d+)?rem/)
      expect(styleBlock).toContain('--space-12')
    })

    test('uses children snippet for CTA (not action/onaction props)', () => {
      expect(content).toContain('children')
      expect(content).toContain('@render children()')
      expect(content).not.toMatch(/\bonaction\b/)
    })
  })

  // AC #10: No Svelte 4 event modifier syntax
  describe('No Svelte 4 syntax', () => {
    const allSvelteFiles = [
      ...findSvelteFiles(join(import.meta.dir, '..', 'lib', 'components')),
      ...findSvelteFiles(ROUTES),
    ]

    test('no |preventDefault or |stopPropagation modifiers in any .svelte file', () => {
      const violations: string[] = []
      for (const file of allSvelteFiles) {
        const content = read(file)
        if (content.includes('|preventDefault') || content.includes('|stopPropagation')) {
          violations.push(file)
        }
      }
      expect(violations).toEqual([])
    })
  })
})
