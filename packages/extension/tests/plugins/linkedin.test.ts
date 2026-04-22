// packages/extension/tests/plugins/linkedin.test.ts

import { describe, test, expect } from 'bun:test'
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { linkedinPlugin } from '../../src/plugin/plugins/linkedin'

const fixtureDir = join(import.meta.dir, '..', 'fixtures', 'linkedin')

function loadFixture(name: string): { dom: JSDOM; expected: Record<string, string> } {
  const html = readFileSync(join(fixtureDir, `${name}.html`), 'utf-8')
  const expected = JSON.parse(
    readFileSync(join(fixtureDir, `${name}.expected.json`), 'utf-8'),
  )
  const dom = new JSDOM(html, { url: `https://www.linkedin.com${expected.url_suffix}` })
  return { dom, expected }
}

describe('linkedinPlugin.extractJD', () => {
  test('extracts fields from job detail fixture', () => {
    const { dom, expected } = loadFixture('job-detail-standard')
    const extract = linkedinPlugin.capabilities.extractJD
    expect(extract).toBeDefined()
    if (!extract) throw new Error('extractJD is required')

    const result = extract(dom.window.document, dom.window.location.href)
    expect(result).not.toBeNull()
    if (!result) return

    expect(result.title).toBe(expected.title)
    expect(result.company).toBe(expected.company)
    expect(result.location).toBe(expected.location)
    expect(result.url).toContain(expected.url_suffix)
    expect(result.description).not.toBeNull()
    expect(result.description!.length).toBeGreaterThan(100)
    expect(result.source_plugin).toBe('linkedin')
    expect(result.extracted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test('extracts fields from Capital One fixture (no salary chip, different chip order)', () => {
    const { dom, expected } = loadFixture('job-detail-capital-one')
    const extract = linkedinPlugin.capabilities.extractJD
    expect(extract).toBeDefined()
    if (!extract) throw new Error('extractJD is required')

    const result = extract(dom.window.document, dom.window.location.href)
    expect(result).not.toBeNull()
    if (!result) return

    expect(result.title).toBe(expected.title)
    expect(result.company).toBe(expected.company)
    expect(result.location).toBe(expected.location)
    expect(result.salary_range).toBeNull()
    expect(result.url).toContain(expected.url_suffix)
    expect(result.description).not.toBeNull()
    expect(result.description!.length).toBeGreaterThan(100)
    expect(result.source_plugin).toBe('linkedin')
    // "Full-time" must NOT appear as salary_range
    expect(result.salary_range).not.toBe('Full-time')
  })

  test('returns null on empty document', () => {
    const dom = new JSDOM('<html><body></body></html>', {
      url: 'https://www.linkedin.com/jobs/view/0',
    })
    const extract = linkedinPlugin.capabilities.extractJD!
    expect(extract(dom.window.document, dom.window.location.href)).toBeNull()
  })

  test('returns null on search listing page', () => {
    const html = readFileSync(join(fixtureDir, 'job-search-listing.html'), 'utf-8')
    const dom = new JSDOM(html, {
      url: 'https://www.linkedin.com/jobs/search/?keywords=software%20engineer',
    })
    const extract = linkedinPlugin.capabilities.extractJD!
    expect(extract(dom.window.document, dom.window.location.href)).toBeNull()
  })

  test('extracts external apply URL from LinkedIn safety redirect (3bp.14)', () => {
    const html = readFileSync(join(fixtureDir, 'job-detail-external-apply.html'), 'utf-8')
    const dom = new JSDOM(html, {
      url: 'https://www.linkedin.com/jobs/view/4982193008/',
    })
    const extract = linkedinPlugin.capabilities.extractJD!
    const result = extract(dom.window.document, dom.window.location.href)
    expect(result).not.toBeNull()
    expect(result!.apply_url).toBe('https://job-boards.greenhouse.io/anthropic/jobs/4982193008')
  })

  test('apply_url is null when no external apply link present', () => {
    const { dom } = loadFixture('job-detail-standard')
    const extract = linkedinPlugin.capabilities.extractJD!
    const result = extract(dom.window.document, dom.window.location.href)
    expect(result).not.toBeNull()
    // Standard fixture has Easy Apply, not external — apply_url should be null
    expect(result!.apply_url).toBeNull()
  })

  test('extracts company LinkedIn URL from company link', () => {
    const { dom } = loadFixture('job-detail-standard')
    const extract = linkedinPlugin.capabilities.extractJD!
    const result = extract(dom.window.document, dom.window.location.href)
    expect(result).not.toBeNull()
    expect(result!.company_url).toBe('https://www.linkedin.com/company/crossinghurdles/')
  })

  test('extracts company URL from external-apply fixture', () => {
    const html = readFileSync(join(fixtureDir, 'job-detail-external-apply.html'), 'utf-8')
    const dom = new JSDOM(html, {
      url: 'https://www.linkedin.com/jobs/view/4982193008/',
    })
    const extract = linkedinPlugin.capabilities.extractJD!
    const result = extract(dom.window.document, dom.window.location.href)
    expect(result).not.toBeNull()
    expect(result!.company_url).toBe('https://www.linkedin.com/company/anthropic/')
  })

  test('extracts full salary range from nested chip spans (3bp.13 truncation fix)', () => {
    const html = readFileSync(join(fixtureDir, 'salary-chip-truncation.html'), 'utf-8')
    const dom = new JSDOM(html, {
      url: 'https://www.linkedin.com/jobs/view/4322360108/',
    })
    const extract = linkedinPlugin.capabilities.extractJD!
    const result = extract(dom.window.document, dom.window.location.href)
    expect(result).not.toBeNull()
    // Must get the FULL salary range, not truncated
    expect(result!.salary_range).toBe('$300,000/yr')
  })
})

describe('linkedinPlugin metadata', () => {
  test('has correct name and matches', () => {
    expect(linkedinPlugin.name).toBe('linkedin')
    expect(linkedinPlugin.matches).toContain('linkedin.com')
    expect(linkedinPlugin.matches).toContain('*.linkedin.com')
  })
})

describe('linkedinPlugin.normalizeUrl', () => {
  const normalize = linkedinPlugin.capabilities.normalizeUrl

  test('normalizeUrl capability exists', () => {
    expect(normalize).toBeDefined()
  })

  test('strips query params', () => {
    expect(normalize!('https://www.linkedin.com/jobs/view/4366558926/?utm_source=google&trackingId=abc'))
      .toBe('https://www.linkedin.com/jobs/view/4366558926/')
  })

  test('strips hash fragment', () => {
    expect(normalize!('https://www.linkedin.com/jobs/view/4366558926/#details'))
      .toBe('https://www.linkedin.com/jobs/view/4366558926/')
  })

  test('adds trailing slash if missing', () => {
    expect(normalize!('https://www.linkedin.com/jobs/view/4366558926'))
      .toBe('https://www.linkedin.com/jobs/view/4366558926/')
  })

  test('preserves already-clean URL', () => {
    expect(normalize!('https://www.linkedin.com/jobs/view/4366558926/'))
      .toBe('https://www.linkedin.com/jobs/view/4366558926/')
  })

  test('strips ?currentJobId param (LinkedIn search sidebar variant)', () => {
    expect(normalize!('https://www.linkedin.com/jobs/view/4366558926/?currentJobId=4366558926'))
      .toBe('https://www.linkedin.com/jobs/view/4366558926/')
  })

  test('returns input unchanged for non-URL strings', () => {
    expect(normalize!('not-a-url')).toBe('not-a-url')
  })
})
