import { describe, it, expect } from 'bun:test'
import { parseJobDescription } from '../index'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf-8')

describe('parseJobDescription (integration)', () => {
  it('parses Anthropic Cybersecurity RE JD end-to-end', () => {
    const result = parseJobDescription(fixture('anthropic-cybersec-re.txt'))

    expect(result.sections.length).toBeGreaterThanOrEqual(4)
    const categories = result.sections.map(s => s.category)
    expect(categories).toContain('requirements')
    expect(categories).toContain('compensation')

    expect(result.salary).not.toBeNull()
    expect(result.salary!.min).toBe(300_000)
    expect(result.salary!.max).toBe(405_000)
  })

  it('parses Snorkel Training Infra JD end-to-end', () => {
    const result = parseJobDescription(fixture('snorkel-training-infra.txt'))

    const categories = result.sections.map(s => s.category)
    expect(categories).toContain('responsibilities')

    expect(result.salary).not.toBeNull()
    expect(result.salary!.min).toBe(150_000)
    expect(result.salary!.max).toBe(180_000)

    expect(result.locations.length).toBeGreaterThanOrEqual(1)
  })

  it('parses minimal JD', () => {
    const result = parseJobDescription(fixture('minimal-jd.txt'))

    expect(result.salary).not.toBeNull()
    expect(result.salary!.min).toBe(120_000)
    expect(result.salary!.max).toBe(160_000)

    expect(result.workPosture).toBe('remote')
  })

  it('parses wall-of-text JD', () => {
    const result = parseJobDescription(fixture('wall-of-text.txt'))

    expect(result.salary).not.toBeNull()
    expect(result.salary!.min).toBe(150_000)
    expect(result.salary!.max).toBe(200_000)

    expect(result.workPosture).toBe('hybrid')
    expect(result.locations).toContain('Chicago, IL')
  })

  it('handles empty string gracefully', () => {
    const result = parseJobDescription('')
    expect(result.sections).toEqual([])
    expect(result.salary).toBeNull()
    expect(result.locations).toEqual([])
    expect(result.workPosture).toBeNull()
  })

  it('handles whitespace-only input', () => {
    const result = parseJobDescription('   \n\n   ')
    expect(result.sections).toEqual([])
    expect(result.salary).toBeNull()
  })

  it('extracts from all fixture files without throwing', () => {
    const fixtureDir = join(__dirname, 'fixtures')
    const files = readdirSync(fixtureDir).filter(f => f.endsWith('.txt'))

    for (const file of files) {
      const text = readFileSync(join(fixtureDir, file), 'utf-8')
      const result = parseJobDescription(text)
      expect(result.sections).toBeDefined()
      expect(result.salary === null || typeof result.salary.min === 'number').toBe(true)
      expect(Array.isArray(result.locations)).toBe(true)
    }
  })

  it('parses BetterUp JD with EEO section', () => {
    const result = parseJobDescription(fixture('betterup-ai-security.txt'))

    expect(result.sections.length).toBeGreaterThanOrEqual(3)
    expect(result.salary).not.toBeNull()
    // BetterUp salary: $232,000 - $333,000
    expect(result.salary!.min).toBe(232_000)
    expect(result.salary!.max).toBe(333_000)
  })
})
