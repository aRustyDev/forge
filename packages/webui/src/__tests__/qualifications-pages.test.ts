/**
 * Structural acceptance tests for Qualifications WebUI (Phase 87).
 *
 * These tests read source files and assert on expected patterns rather than
 * rendering components at runtime — matching the project's existing test
 * convention (see jd-overlay.test.ts, component-adoption.test.ts).
 *
 * Acceptance criteria mapped per task:
 *
 * T87.1 — Navigation:
 *   [x] Qualifications group exists with prefix /qualifications
 *   [x] Qualifications has children Credentials and Certifications
 *   [x] Experience group no longer has a Clearances child
 *   [x] Qualifications is positioned after Experience, before Data
 *
 * T87.2 — Credentials page:
 *   [x] Page file exists at the correct route
 *   [x] Imports SplitPanel, ListPanelHeader, EmptyPanel, ListSearchInput
 *   [x] References forge.credentials for API calls
 *   [x] Contains type-specific form sections for all 4 credential types
 *   [x] No forbidden inline CSS patterns per ui-shared-components.md
 *
 * T87.3 — Certifications page:
 *   [x] Page file exists at the correct route
 *   [x] Imports shared components
 *   [x] References forge.certifications + skill junction methods
 *   [x] Contains skill picker section
 *   [x] Contains education source dropdown
 *   [x] No forbidden inline CSS patterns
 *
 * T87.4 — Remove clearances experience page:
 *   [x] Clearances page no longer uses sourceTypeFilter="clearance"
 *   [x] Redirects to /qualifications/credentials
 *   [x] Navigation no longer links to /experience/clearances
 */

import { describe, test, expect } from 'bun:test'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const SRC = join(import.meta.dir, '..')
const ROUTES = join(SRC, 'routes')
const LIB = join(SRC, 'lib')

function read(path: string): string {
  return readFileSync(path, 'utf-8')
}

// ────────────────────────────────────────────────────────────────
// T87.1 — Navigation
// ────────────────────────────────────────────────────────────────

describe('T87.1: Navigation', () => {
  const navContent = read(join(LIB, 'nav.ts'))

  test('Qualifications group exists with prefix /qualifications', () => {
    expect(navContent).toContain("label: 'Qualifications'")
    expect(navContent).toContain("prefix: '/qualifications'")
  })

  test('Qualifications has Credentials child', () => {
    expect(navContent).toContain("href: '/qualifications/credentials'")
    expect(navContent).toContain("label: 'Credentials'")
  })

  test('Qualifications has Certifications child', () => {
    expect(navContent).toContain("href: '/qualifications/certifications'")
    expect(navContent).toContain("label: 'Certifications'")
  })

  test('Experience group does NOT have a Clearances child', () => {
    // The string "/experience/clearances" should not appear as an href
    // in the Experience group. We test the whole nav export for this
    // pattern and assert it's gone.
    expect(navContent).not.toContain("href: '/experience/clearances'")
    expect(navContent).not.toContain("label: 'Clearances'")
  })

  test('Qualifications appears between Experience and Data', () => {
    // The nav array order should be:
    //   ... Experience ... Qualifications ... Data ...
    const expIdx = navContent.indexOf("label: 'Experience'")
    const qualIdx = navContent.indexOf("label: 'Qualifications'")
    const dataIdx = navContent.indexOf("label: 'Data'")
    expect(expIdx).toBeGreaterThan(0)
    expect(qualIdx).toBeGreaterThan(expIdx)
    expect(dataIdx).toBeGreaterThan(qualIdx)
  })
})

// ────────────────────────────────────────────────────────────────
// T87.2 — Credentials page
// ────────────────────────────────────────────────────────────────

describe('T87.2: Credentials page', () => {
  const pageFile = join(ROUTES, 'qualifications', 'credentials', '+page.svelte')

  test('page file exists', () => {
    expect(existsSync(pageFile)).toBe(true)
  })

  const content = read(pageFile)

  test('imports SplitPanel from $lib/components', () => {
    expect(content).toContain('SplitPanel')
    expect(content).toMatch(/import\s*\{[^}]*SplitPanel/)
  })

  test('imports ListPanelHeader from $lib/components', () => {
    expect(content).toContain('ListPanelHeader')
    expect(content).toMatch(/import\s*\{[^}]*ListPanelHeader/)
  })

  test('imports EmptyPanel from $lib/components', () => {
    expect(content).toContain('EmptyPanel')
    expect(content).toMatch(/import\s*\{[^}]*EmptyPanel/)
  })

  test('imports ListSearchInput from $lib/components', () => {
    expect(content).toContain('ListSearchInput')
    expect(content).toMatch(/import\s*\{[^}]*ListSearchInput/)
  })

  test('references forge.credentials for API calls', () => {
    expect(content).toContain('forge.credentials')
  })

  test('contains clearance detail fields (level dropdown)', () => {
    expect(content).toContain('clr-level')
    expect(content).toContain('CLEARANCE_LEVELS')
  })

  test("contains driver's license detail fields (class/state)", () => {
    expect(content).toContain('dl-class')
    expect(content).toContain('dl-state')
  })

  test('contains bar admission detail fields (jurisdiction)', () => {
    expect(content).toContain('bar-jurisdiction')
  })

  test('contains medical license detail fields (license_type/state)', () => {
    expect(content).toContain('med-type')
    expect(content).toContain('med-state')
  })

  test('contains credential_type selector', () => {
    expect(content).toContain('credential_type')
    expect(content).toContain('CREDENTIAL_TYPES')
  })

  test('no inline .list-panel CSS (use SplitPanel)', () => {
    expect(content).not.toMatch(/\.list-panel\s*\{/)
  })

  test('no inline .btn-new CSS (use ListPanelHeader)', () => {
    expect(content).not.toMatch(/\.btn-new\s*\{/)
  })

  test('no inline height: calc(100vh - 4rem) (use PageWrapper)', () => {
    expect(content).not.toMatch(/height:\s*calc\(100vh\s*-\s*4rem\)/)
  })
})

// ────────────────────────────────────────────────────────────────
// T87.3 — Certifications page
// ────────────────────────────────────────────────────────────────

describe('T87.3: Certifications page', () => {
  const pageFile = join(ROUTES, 'qualifications', 'certifications', '+page.svelte')

  test('page file exists', () => {
    expect(existsSync(pageFile)).toBe(true)
  })

  const content = read(pageFile)

  test('imports SplitPanel from $lib/components', () => {
    expect(content).toContain('SplitPanel')
    expect(content).toMatch(/import\s*\{[^}]*SplitPanel/)
  })

  test('imports ListPanelHeader from $lib/components', () => {
    expect(content).toContain('ListPanelHeader')
    expect(content).toMatch(/import\s*\{[^}]*ListPanelHeader/)
  })

  test('imports EmptyPanel from $lib/components', () => {
    expect(content).toContain('EmptyPanel')
    expect(content).toMatch(/import\s*\{[^}]*EmptyPanel/)
  })

  test('imports ListSearchInput from $lib/components', () => {
    expect(content).toContain('ListSearchInput')
    expect(content).toMatch(/import\s*\{[^}]*ListSearchInput/)
  })

  test('references forge.certifications for API calls', () => {
    expect(content).toContain('forge.certifications')
  })

  test('references skill junction methods (addSkill, removeSkill)', () => {
    expect(content).toContain('addSkill')
    expect(content).toContain('removeSkill')
  })

  test('contains skill picker section', () => {
    expect(content).toContain('skill-picker')
    expect(content).toContain('skill-dropdown')
  })

  test('contains education source dropdown', () => {
    expect(content).toContain('educationSources')
    expect(content).toContain('cert-edu-source')
  })

  test('contains expiry-based status display', () => {
    expect(content).toContain('displayStatus')
    expect(content).toContain('expired')
  })

  test('no inline .list-panel CSS (use SplitPanel)', () => {
    expect(content).not.toMatch(/\.list-panel\s*\{/)
  })

  test('no inline .btn-new CSS (use ListPanelHeader)', () => {
    expect(content).not.toMatch(/\.btn-new\s*\{/)
  })

  test('no inline height: calc(100vh - 4rem) (use PageWrapper)', () => {
    expect(content).not.toMatch(/height:\s*calc\(100vh\s*-\s*4rem\)/)
  })
})

// ────────────────────────────────────────────────────────────────
// T87.4 — Remove clearances experience page
// ────────────────────────────────────────────────────────────────

describe('T87.4: Remove clearances experience page', () => {
  const clearancesPageFile = join(ROUTES, 'experience', 'clearances', '+page.svelte')

  test('clearances page file exists (redirects rather than deleted)', () => {
    expect(existsSync(clearancesPageFile)).toBe(true)
  })

  const content = read(clearancesPageFile)

  test('no longer renders SourcesView with clearance filter', () => {
    // The script section must NOT import SourcesView or bind sourceTypeFilter.
    // The HTML comment may mention the old pattern for context — that's fine.
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/)
    const scriptContent = scriptMatch ? scriptMatch[1] : ''
    expect(scriptContent).not.toContain('SourcesView')
    expect(scriptContent).not.toContain('sourceTypeFilter')
  })

  test('redirects to /qualifications/credentials', () => {
    expect(content).toContain('/qualifications/credentials')
    expect(content).toContain('goto')
  })

  test('navigation has no link to /experience/clearances', () => {
    const navContent = read(join(LIB, 'nav.ts'))
    expect(navContent).not.toContain("'/experience/clearances'")
  })
})
