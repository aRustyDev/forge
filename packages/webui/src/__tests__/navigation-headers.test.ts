import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

const COMPONENTS = join(import.meta.dir, '..', 'lib', 'components')

function read(path: string): string {
  return readFileSync(join(COMPONENTS, path), 'utf-8')
}

describe('Navigation & Header Components', () => {
  describe('ViewToggle', () => {
    const content = read('ViewToggle.svelte')

    test('has role="radiogroup" on container', () => {
      expect(content).toContain('role="radiogroup"')
    })

    test('has aria-label on container', () => {
      expect(content).toMatch(/aria-label=/)
    })

    test('buttons have type="button"', () => {
      expect(content).toContain('type="button"')
    })

    test('buttons have role="radio"', () => {
      expect(content).toContain('role="radio"')
    })

    test('buttons have aria-checked', () => {
      expect(content).toContain('aria-checked')
    })
  })

  describe('TabBar', () => {
    const content = read('TabBar.svelte')

    test('uses div with role="tablist" (not nav)', () => {
      expect(content).toContain('role="tablist"')
      expect(content).not.toMatch(/<nav[^>]*role="tablist"/)
    })

    test('tab buttons have role="tab"', () => {
      expect(content).toContain('role="tab"')
    })

    test('tab buttons have aria-selected', () => {
      expect(content).toContain('aria-selected')
    })
  })

  describe('PageHeader', () => {
    const content = read('PageHeader.svelte')

    test('uses design tokens for typography', () => {
      expect(content).toContain('--text-2xl')
      expect(content).toContain('--font-bold')
    })

    test('renders h1 element', () => {
      expect(content).toContain('<h1')
    })

    test('no hardcoded font sizes', () => {
      expect(content).not.toMatch(/font-size:\s*\d+px/)
      expect(content).not.toMatch(/font-size:\s*\d+\.\d+rem/)
    })
  })

  describe('ListPanelHeader', () => {
    const content = read('ListPanelHeader.svelte')

    test('uses --color-primary for button (not --color-info)', () => {
      expect(content).toContain('--color-primary')
      expect(content).not.toContain('--color-info')
    })

    test('renders h2 element', () => {
      expect(content).toContain('<h2')
    })

    test('uses design tokens for typography', () => {
      expect(content).toContain('--text-xl')
      expect(content).toContain('--font-semibold')
    })
  })

  describe('ListSearchInput', () => {
    const content = read('ListSearchInput.svelte')

    test('uses --color-primary for focus ring', () => {
      expect(content).toContain('--color-primary')
    })

    test('uses --radius-md for border-radius', () => {
      expect(content).toContain('--radius-md')
    })

    test('no hardcoded focus ring colors', () => {
      expect(content).not.toContain('--color-info')
    })
  })

  describe('JDFilterBar', () => {
    const content = read('filters/JDFilterBar.svelte')

    test('uses standard .filter-bar class', () => {
      expect(content).toContain('class="filter-bar"')
    })

    test('uses standard .field-select class (not .filter-select)', () => {
      expect(content).toContain('class="field-select"')
      expect(content).not.toContain('class="filter-select"')
    })

    test('uses standard .field-input class (not .filter-input)', () => {
      expect(content).toContain('class="field-input"')
      expect(content).not.toContain('class="filter-input"')
    })

    test('uses design tokens for spacing (no hardcoded px)', () => {
      expect(content).not.toMatch(/gap:\s*\d+px/)
      expect(content).not.toMatch(/padding:\s*\d+px/)
    })

    test('derives org options from jds prop', () => {
      expect(content).toContain('jds')
      expect(content).toMatch(/jds.*Array|Array.*jds/)
    })
  })
})
