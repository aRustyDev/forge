import { describe, test, expect } from 'bun:test'
import { validateExtraction } from '../../src/lib/validate'
import type { ExtractedJob } from '../../src/plugin/types'

function makeJob(overrides: Partial<ExtractedJob> = {}): ExtractedJob {
  return {
    title: 'Software Engineer',
    company: 'Acme Corp',
    location: 'San Francisco, CA',
    salary_range: '$150k-$200k',
    description: 'We are looking for a software engineer...',
    url: 'https://www.linkedin.com/jobs/view/123',
    extracted_at: new Date().toISOString(),
    source_plugin: 'linkedin',
    ...overrides,
  }
}

describe('validateExtraction', () => {
  test('passes when title and description present', () => {
    const result = validateExtraction(makeJob())
    expect(result.valid).toBe(true)
  })

  test('fails when title is null', () => {
    const result = validateExtraction(makeJob({ title: null }))
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.missing).toContain('title')
    }
  })

  test('fails when description is null', () => {
    const result = validateExtraction(makeJob({ description: null }))
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.missing).toContain('description')
    }
  })

  test('fails when both title and description are null', () => {
    const result = validateExtraction(makeJob({ title: null, description: null }))
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.missing).toEqual(['title', 'description'])
    }
  })

  test('fails when title is whitespace-only', () => {
    const result = validateExtraction(makeJob({ title: '   ' }))
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.missing).toContain('title')
    }
  })

  test('passes when optional fields are null', () => {
    const result = validateExtraction(makeJob({
      company: null,
      location: null,
      salary_range: null,
    }))
    expect(result.valid).toBe(true)
  })
})
