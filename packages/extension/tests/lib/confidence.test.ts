import { describe, test, expect } from 'bun:test'
import {
  CONFIDENCE_ORDER,
  DEFAULT_FLOORS,
  CONFIDENCE_MODES,
  assignConfidence,
  shouldShowOverlay,
} from '../../src/lib/confidence'
import type { ExtractedJob, FieldConfidence } from '../../src/plugin/types'

function makeExtracted(overrides: Partial<ExtractedJob> = {}): ExtractedJob {
  return {
    title: null,
    company: null,
    location: null,
    salary_range: null,
    description: null,
    url: 'https://example.com/job/1',
    extracted_at: new Date().toISOString(),
    source_plugin: 'test',
    ...overrides,
  }
}

describe('CONFIDENCE_ORDER', () => {
  test('high > medium > low > absent', () => {
    expect(CONFIDENCE_ORDER.high).toBeGreaterThan(CONFIDENCE_ORDER.medium)
    expect(CONFIDENCE_ORDER.medium).toBeGreaterThan(CONFIDENCE_ORDER.low)
    expect(CONFIDENCE_ORDER.low).toBeGreaterThan(CONFIDENCE_ORDER.absent)
  })
})

describe('assignConfidence', () => {
  test('marks present fields as high by default', () => {
    const extracted = makeExtracted({
      title: 'Engineer',
      company: 'Acme',
    })
    const result = assignConfidence(extracted)
    const title = result.find((c) => c.field === 'title')
    const company = result.find((c) => c.field === 'company')
    expect(title?.tier).toBe('high')
    expect(company?.tier).toBe('high')
  })

  test('marks absent fields correctly', () => {
    const extracted = makeExtracted({ title: null, company: null })
    const result = assignConfidence(extracted)
    const title = result.find((c) => c.field === 'title')
    const company = result.find((c) => c.field === 'company')
    expect(title?.tier).toBe('absent')
    expect(title?.source).toBe('missing')
    expect(company?.tier).toBe('absent')
    expect(company?.source).toBe('missing')
  })

  test('uses override tiers when provided', () => {
    const extracted = makeExtracted({ salary_min: 100000 })
    const result = assignConfidence(extracted, {
      salary_min: { tier: 'medium', source: 'parser-body' },
    })
    const salary = result.find((c) => c.field === 'salary_min')
    expect(salary?.tier).toBe('medium')
    expect(salary?.source).toBe('parser-body')
  })

  test('returns all tracked fields', () => {
    const extracted = makeExtracted()
    const result = assignConfidence(extracted)
    const fields = result.map((c) => c.field)
    expect(fields).toContain('title')
    expect(fields).toContain('company')
    expect(fields).toContain('salary_min')
    expect(fields).toContain('salary_max')
    expect(fields).toContain('work_posture')
    expect(fields).toContain('location')
    expect(fields).toContain('url')
    expect(fields).toContain('description')
    expect(fields).toContain('source_plugin')
    expect(fields).toContain('parsed_requirements')
    expect(fields).toContain('parsed_responsibilities')
    expect(fields).toContain('parsed_preferred')
  })
})

describe('shouldShowOverlay', () => {
  function makeConfidence(overrides: Partial<Record<string, { tier: string; source: string }>> = {}): FieldConfidence[] {
    return Object.keys(DEFAULT_FLOORS).map((field) => ({
      field,
      tier: (overrides[field]?.tier ?? 'high') as FieldConfidence['tier'],
      source: overrides[field]?.source ?? 'selector',
    }))
  }

  test('returns false when all fields pass their floors', () => {
    const conf = makeConfidence()
    expect(shouldShowOverlay(conf, DEFAULT_FLOORS)).toBe(false)
  })

  test('returns true when a high-priority field is absent', () => {
    const conf = makeConfidence({
      title: { tier: 'absent', source: 'missing' },
    })
    expect(shouldShowOverlay(conf, DEFAULT_FLOORS)).toBe(true)
  })

  test('returns true when salary is absent with medium floor', () => {
    const conf = makeConfidence({
      salary_min: { tier: 'absent', source: 'missing' },
    })
    expect(shouldShowOverlay(conf, DEFAULT_FLOORS)).toBe(true)
  })

  test('returns true when forceManual is true', () => {
    const conf = makeConfidence()
    expect(shouldShowOverlay(conf, DEFAULT_FLOORS, true)).toBe(true)
  })

  test('returns false with dev mode (all floors absent)', () => {
    const conf = makeConfidence({
      title: { tier: 'absent', source: 'missing' },
      company: { tier: 'absent', source: 'missing' },
      salary_min: { tier: 'absent', source: 'missing' },
    })
    expect(shouldShowOverlay(conf, CONFIDENCE_MODES['dev'])).toBe(false)
  })

  test('returns true with debug mode on medium field', () => {
    const conf = makeConfidence({
      salary_min: { tier: 'medium', source: 'parser-body' },
    })
    expect(shouldShowOverlay(conf, CONFIDENCE_MODES['debug'])).toBe(true)
  })

  test('returns false with debug mode when all high', () => {
    const conf = makeConfidence()
    expect(shouldShowOverlay(conf, CONFIDENCE_MODES['debug'])).toBe(false)
  })
})
