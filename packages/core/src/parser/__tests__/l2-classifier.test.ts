import { describe, it, expect } from 'bun:test'
import { classifySections } from '../l2-classifier'
import { splitSections } from '../l1-splitter'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { Section, SectionCategory } from '../types'

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf-8')

function classify(text: string) {
  return classifySections(splitSections(text))
}

describe('classifySections (L2)', () => {
  // ── Empty input ───────────────────────────────────────────────────
  it('returns empty array for empty sections', () => {
    expect(classifySections([])).toEqual([])
  })

  // ── Heading-based classification ──────────────────────────────────
  it('classifies "Requirements" heading as requirements', () => {
    const result = classify(fixture('generic-markdown-headings.txt'))
    const req = result.find(s => s.category === 'requirements')
    expect(req).toBeDefined()
    expect(req!.confidence).toBeGreaterThanOrEqual(0.8)
  })

  it('classifies "Responsibilities" heading as responsibilities', () => {
    const result = classify(fixture('generic-markdown-headings.txt'))
    const resp = result.find(s => s.category === 'responsibilities')
    expect(resp).toBeDefined()
  })

  it('classifies "Benefits" heading as benefits', () => {
    const result = classify(fixture('generic-markdown-headings.txt'))
    const ben = result.find(s => s.category === 'benefits')
    expect(ben).toBeDefined()
  })

  it('classifies "About Us" heading as about_company', () => {
    const result = classify(fixture('generic-markdown-headings.txt'))
    const about = result.find(s => s.category === 'about_company')
    expect(about).toBeDefined()
  })

  it('classifies "Qualifications" as requirements', () => {
    const result = classify(fixture('generic-bold-headings.txt'))
    const req = result.find(s => s.category === 'requirements')
    expect(req).toBeDefined()
  })

  it('classifies "Preferred Qualifications" as preferred', () => {
    const sections: Section[] = [
      { heading: 'Preferred Qualifications', text: '- Nice to have skills', byteOffset: 0 },
    ]
    const result = classifySections(sections)
    expect(result[0].category).toBe('preferred')
  })

  it('classifies "Nice to Have" as preferred', () => {
    const result = classify(fixture('generic-html-headings.txt'))
    const pref = result.find(s => s.category === 'preferred')
    expect(pref).toBeDefined()
  })

  // ── Compensation classification ───────────────────────────────────
  it('classifies section with salary info as compensation', () => {
    const result = classify(fixture('generic-allcaps-headings.txt'))
    const comp = result.find(s => s.category === 'compensation')
    expect(comp).toBeDefined()
  })

  // ── EEO classification ────────────────────────────────────────────
  it('classifies EEO boilerplate as eeo', () => {
    const sections: Section[] = [
      {
        heading: 'Equal Opportunity Employer',
        text: 'We are an equal opportunity employer and value diversity. We do not discriminate on the basis of race, religion, color, national origin, gender, sexual orientation, age, marital status, veteran status, or disability status.',
        byteOffset: 0,
      },
    ]
    const result = classifySections(sections)
    expect(result[0].category).toBe('eeo')
  })

  // ── Content-based classification (no heading) ─────────────────────
  it('classifies preamble with company description as description', () => {
    const result = classify(fixture('generic-no-headings.txt'))
    expect(result[0].category).toBe('description')
  })

  // ── Confidence scores ─────────────────────────────────────────────
  it('assigns higher confidence when heading strongly matches', () => {
    const sections: Section[] = [
      { heading: 'Requirements', text: '- 5+ years experience\n- Python', byteOffset: 0 },
    ]
    const result = classifySections(sections)
    expect(result[0].confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('assigns lower confidence for ambiguous content', () => {
    const sections: Section[] = [
      { heading: null, text: 'We are looking for talented people.', byteOffset: 0 },
    ]
    const result = classifySections(sections)
    expect(result[0].confidence).toBeLessThan(0.7)
  })

  // ── Real JD accuracy ─────────────────────────────────────────────
  it('achieves correct classification on Anthropic JD', () => {
    const result = classify(fixture('anthropic-cybersec-re.txt'))
    const categories = result.map(s => s.category)
    expect(categories).toContain('requirements')
    expect(categories).toContain('compensation')
  })

  it('achieves correct classification on Snorkel JD', () => {
    const result = classify(fixture('snorkel-training-infra.txt'))
    const categories = result.map(s => s.category)
    expect(categories).toContain('responsibilities')
    expect(categories).toContain('preferred')
  })

  // ── >85% accuracy on fixture corpus ───────────────────────────────
  it('achieves >85% classification accuracy on labeled fixtures', () => {
    const expectations: [string, SectionCategory[]][] = [
      ['generic-markdown-headings.txt', ['about_company', 'responsibilities', 'requirements', 'benefits']],
      ['generic-bold-headings.txt', ['description', 'responsibilities', 'requirements']],
      ['generic-allcaps-headings.txt', ['about_company', 'responsibilities', 'requirements', 'compensation']],
      ['generic-html-headings.txt', ['about_company', 'responsibilities', 'requirements', 'preferred']],
      ['generic-mixed-headings.txt', ['description', 'responsibilities', 'requirements', 'compensation']],
      ['salary-range-dash.txt', ['description', 'requirements', 'compensation']],
      ['salary-range-to.txt', ['description', 'requirements', 'compensation']],
      ['multi-location.txt', ['description', 'location', 'requirements']],
      ['remote-only.txt', ['description', 'location', 'requirements']],
      ['hybrid-location.txt', ['description', 'location', 'requirements']],
    ]

    let correct = 0
    let total = 0

    for (const [file, expectedCategories] of expectations) {
      const result = classify(fixture(file))
      const actualCategories = result.map(s => s.category)
      for (const expected of expectedCategories) {
        total++
        if (actualCategories.includes(expected)) correct++
      }
    }

    const accuracy = correct / total
    expect(accuracy).toBeGreaterThan(0.85)
  })
})
