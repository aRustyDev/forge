import { describe, test, expect } from 'bun:test'
import { enrichWithParser } from '../../src/lib/enrich-extraction'
import type { ExtractedJob } from '../../src/plugin/types'

function makeExtracted(overrides: Partial<ExtractedJob> = {}): ExtractedJob {
  return {
    title: 'Senior Engineer',
    company: 'Acme',
    location: 'San Francisco, CA',
    salary_range: null,
    description: null,
    url: 'https://example.com/job/1',
    extracted_at: new Date().toISOString(),
    source_plugin: 'test',
    ...overrides,
  }
}

describe('enrichWithParser', () => {
  test('returns unchanged when description is null', () => {
    const input = makeExtracted({ description: null })
    const result = enrichWithParser(input)
    expect(result.extracted.parsed_sections).toBeUndefined()
    expect(result.extracted.salary_min).toBeUndefined()
  })

  test('extracts salary from description body', () => {
    const input = makeExtracted({
      description: `
## Compensation
The salary range is $150,000 - $200,000 per year.

## Requirements
5+ years experience with TypeScript.
`,
    })
    const result = enrichWithParser(input)
    expect(result.extracted.salary_min).toBe(150000)
    expect(result.extracted.salary_max).toBe(200000)
    expect(result.extracted.salary_period).toBe('annual')
  })

  test('extracts work posture', () => {
    const input = makeExtracted({
      description: `
## About the Role
This is a fully remote position.

## Responsibilities
Build great software.
`,
    })
    const result = enrichWithParser(input)
    expect(result.extracted.work_posture).toBe('remote')
  })

  test('extracts multiple locations', () => {
    const input = makeExtracted({
      description: `
## Location
Positions available in San Francisco, CA and Austin, TX.

## About
A great company.
`,
    })
    const result = enrichWithParser(input)
    expect(result.extracted.parsed_locations).toContain('San Francisco, CA')
    expect(result.extracted.parsed_locations).toContain('Austin, TX')
  })

  test('populates parsed_sections as JSON string', () => {
    const input = makeExtracted({
      description: `
## Requirements
5+ years experience.

## Benefits
Health insurance.
`,
    })
    const result = enrichWithParser(input)
    expect(result.extracted.parsed_sections).toBeTruthy()
    const sections = JSON.parse(result.extracted.parsed_sections!)
    expect(Array.isArray(sections)).toBe(true)
    expect(sections.length).toBeGreaterThan(0)
    expect(sections[0]).toHaveProperty('category')
    expect(sections[0]).toHaveProperty('confidence')
  })

  test('includes confidence array in result', () => {
    const input = makeExtracted({
      description: `
## Requirements
5+ years experience.
`,
    })
    const result = enrichWithParser(input)
    expect(Array.isArray(result.confidence)).toBe(true)
    expect(result.confidence.length).toBeGreaterThan(0)
    expect(result.confidence[0]).toHaveProperty('field')
    expect(result.confidence[0]).toHaveProperty('tier')
    expect(result.confidence[0]).toHaveProperty('source')
  })

  test('chip-sourced salary gets high confidence', () => {
    const input = makeExtracted({
      salary_range: '$150k - $200k',
      description: `
## About
A great job.
`,
    })
    const result = enrichWithParser(input)
    const salaryMin = result.confidence.find((c) => c.field === 'salary_min')
    const salaryMax = result.confidence.find((c) => c.field === 'salary_max')
    expect(salaryMin?.tier).toBe('high')
    expect(salaryMin?.source).toBe('chip')
    expect(salaryMax?.tier).toBe('high')
    expect(salaryMax?.source).toBe('chip')
  })

  test('parser-body salary gets medium confidence', () => {
    const input = makeExtracted({
      description: `
## Compensation
The salary range is $150,000 - $200,000 per year.

## Requirements
5+ years experience.
`,
    })
    const result = enrichWithParser(input)
    const salaryMin = result.confidence.find((c) => c.field === 'salary_min')
    const salaryMax = result.confidence.find((c) => c.field === 'salary_max')
    expect(salaryMin?.tier).toBe('medium')
    expect(salaryMin?.source).toBe('parser-body')
    expect(salaryMax?.tier).toBe('medium')
    expect(salaryMax?.source).toBe('parser-body')
  })

  test('DOM-extracted fields get high/selector confidence', () => {
    const input = makeExtracted({
      title: 'Senior Engineer',
      company: 'Acme',
      location: 'San Francisco, CA',
      company_url: 'https://linkedin.com/company/acme',
      description: `
## About
A great job.
`,
    })
    const result = enrichWithParser(input)
    const title = result.confidence.find((c) => c.field === 'title')
    const company = result.confidence.find((c) => c.field === 'company')
    const location = result.confidence.find((c) => c.field === 'location')
    const companyUrl = result.confidence.find((c) => c.field === 'company_url')
    expect(title?.tier).toBe('high')
    expect(title?.source).toBe('selector')
    expect(company?.tier).toBe('high')
    expect(company?.source).toBe('selector')
    expect(location?.tier).toBe('high')
    expect(location?.source).toBe('chip')
    expect(companyUrl?.tier).toBe('high')
    expect(companyUrl?.source).toBe('selector')
  })

  test('parser-derived work posture gets medium/parser-body', () => {
    const input = makeExtracted({
      description: `
## About
This is a fully remote position.

## Responsibilities
Build software.
`,
    })
    const result = enrichWithParser(input)
    const wp = result.confidence.find((c) => c.field === 'work_posture')
    expect(wp?.tier).toBe('medium')
    expect(wp?.source).toBe('parser-body')
  })
})
