import { describe, it, expect } from 'bun:test'
import { extractSalary, extractLocations, extractWorkPosture } from '../l3-extractors'
import { splitSections } from '../l1-splitter'
import { classifySections } from '../l2-classifier'
import { readFileSync } from 'fs'
import { join } from 'path'

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf-8')

function pipeline(text: string) {
  return classifySections(splitSections(text))
}

describe('extractSalary (L3)', () => {
  it('returns null for no salary info', () => {
    const sections = pipeline('## Requirements\n- 5+ years experience')
    expect(extractSalary(sections)).toBeNull()
  })

  it('extracts salary range with dash: $200,000 - $300,000', () => {
    const sections = pipeline(fixture('salary-range-dash.txt'))
    const salary = extractSalary(sections)
    expect(salary).not.toBeNull()
    expect(salary!.min).toBe(200_000)
    expect(salary!.max).toBe(300_000)
    expect(salary!.period).toBe('annual')
  })

  it('extracts salary range with "to": $180,000 to $260,000', () => {
    const sections = pipeline(fixture('salary-range-to.txt'))
    const salary = extractSalary(sections)
    expect(salary).not.toBeNull()
    expect(salary!.min).toBe(180_000)
    expect(salary!.max).toBe(260_000)
  })

  it('extracts hourly rate: $75 - $120/hr', () => {
    const sections = pipeline(fixture('salary-hourly.txt'))
    const salary = extractSalary(sections)
    expect(salary).not.toBeNull()
    expect(salary!.min).toBe(75)
    expect(salary!.max).toBe(120)
    expect(salary!.period).toBe('hourly')
  })

  it('extracts salary with em-dash: $300,000—$405,000', () => {
    const sections = pipeline(fixture('salary-em-dash.txt'))
    const salary = extractSalary(sections)
    expect(salary).not.toBeNull()
    expect(salary!.min).toBe(300_000)
    expect(salary!.max).toBe(405_000)
  })

  it('extracts salary from Anthropic JD body text', () => {
    const sections = pipeline(fixture('anthropic-cybersec-re.txt'))
    const salary = extractSalary(sections)
    expect(salary).not.toBeNull()
    expect(salary!.min).toBe(300_000)
    expect(salary!.max).toBe(405_000)
  })

  it('extracts salary from Snorkel JD', () => {
    const sections = pipeline(fixture('snorkel-training-infra.txt'))
    const salary = extractSalary(sections)
    expect(salary).not.toBeNull()
    expect(salary!.min).toBe(150_000)
    expect(salary!.max).toBe(180_000)
  })

  it('handles single salary number: $95,000/year', () => {
    const sections = pipeline(fixture('salary-single-number.txt'))
    const salary = extractSalary(sections)
    expect(salary).not.toBeNull()
    expect(salary!.min).toBe(95_000)
    expect(salary!.max).toBe(95_000)
  })

  it('handles $120k-$160k shorthand', () => {
    const sections = pipeline(fixture('minimal-jd.txt'))
    const salary = extractSalary(sections)
    expect(salary).not.toBeNull()
    expect(salary!.min).toBe(120_000)
    expect(salary!.max).toBe(160_000)
  })
})

describe('extractLocations (L3)', () => {
  it('returns empty array for no location info', () => {
    const sections = pipeline('## Requirements\n- 5+ years experience')
    expect(extractLocations(sections)).toEqual([])
  })

  it('extracts multiple locations from multi-location fixture', () => {
    const sections = pipeline(fixture('multi-location.txt'))
    const locations = extractLocations(sections)
    expect(locations.length).toBeGreaterThanOrEqual(3)
    expect(locations).toContain('New York, NY')
    expect(locations).toContain('San Francisco, CA')
    expect(locations).toContain('Seattle, WA')
    expect(locations).toContain('Austin, TX')
  })

  it('extracts single location from hybrid fixture', () => {
    const sections = pipeline(fixture('hybrid-location.txt'))
    const locations = extractLocations(sections)
    expect(locations.length).toBeGreaterThanOrEqual(1)
    expect(locations).toContain('Arlington, VA')
  })

  it('returns array for remote-only fixture', () => {
    const sections = pipeline(fixture('remote-only.txt'))
    const locations = extractLocations(sections)
    expect(Array.isArray(locations)).toBe(true)
  })

  it('extracts location from Snorkel JD', () => {
    const sections = pipeline(fixture('snorkel-training-infra.txt'))
    const locations = extractLocations(sections)
    expect(locations.length).toBeGreaterThanOrEqual(1)
  })
})

describe('extractWorkPosture (L3)', () => {
  it('returns null for no posture info', () => {
    const sections = pipeline('## Requirements\n- 5+ years experience')
    expect(extractWorkPosture(sections)).toBeNull()
  })

  it('detects remote from remote-only fixture', () => {
    const sections = pipeline(fixture('remote-only.txt'))
    expect(extractWorkPosture(sections)).toBe('remote')
  })

  it('detects hybrid from hybrid fixture', () => {
    const sections = pipeline(fixture('hybrid-location.txt'))
    expect(extractWorkPosture(sections)).toBe('hybrid')
  })

  it('detects hybrid from wall-of-text', () => {
    const sections = pipeline(fixture('wall-of-text.txt'))
    expect(extractWorkPosture(sections)).toBe('hybrid')
  })

  it('detects remote from Snorkel JD', () => {
    const sections = pipeline(fixture('snorkel-training-infra.txt'))
    const posture = extractWorkPosture(sections)
    expect(posture).toBe('remote')
  })
})
