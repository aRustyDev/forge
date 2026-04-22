import { describe, it, expect } from 'bun:test'
import { splitSections } from '../l1-splitter'
import { readFileSync } from 'fs'
import { join } from 'path'

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf-8')

describe('splitSections (L1)', () => {
  // ── Empty / edge cases ──────────────────────────────────────────────
  it('returns empty array for empty string', () => {
    expect(splitSections('')).toEqual([])
  })

  it('returns single preamble section for text with no headings', () => {
    const result = splitSections('Just some text.\nAnother line.')
    expect(result).toHaveLength(1)
    expect(result[0].heading).toBeNull()
    expect(result[0].text).toContain('Just some text.')
    expect(result[0].byteOffset).toBe(0)
  })

  // ── Markdown headings ──────────────────────────────────────────────
  it('splits on markdown ## headings', () => {
    const result = splitSections(fixture('generic-markdown-headings.txt'))
    const headings = result.map(s => s.heading)
    expect(headings).toContain('About Us')
    expect(headings).toContain('Responsibilities')
    expect(headings).toContain('Requirements')
    expect(headings).toContain('Benefits')
  })

  it('preserves section text without the heading line', () => {
    const result = splitSections(fixture('generic-markdown-headings.txt'))
    const req = result.find(s => s.heading === 'Requirements')!
    expect(req.text).toContain('5+ years Python experience')
    expect(req.text).not.toContain('## Requirements')
  })

  // ── Bold headings ──────────────────────────────────────────────────
  it('splits on **bold** headings', () => {
    const result = splitSections(fixture('generic-bold-headings.txt'))
    const headings = result.map(s => s.heading)
    expect(headings).toContain('About the Role')
    expect(headings).toContain('Responsibilities')
    expect(headings).toContain('Qualifications')
  })

  // ── ALL CAPS headings ──────────────────────────────────────────────
  it('splits on ALL CAPS headings', () => {
    const result = splitSections(fixture('generic-allcaps-headings.txt'))
    const headings = result.map(s => s.heading)
    expect(headings).toContain('ABOUT THE COMPANY')
    expect(headings).toContain('WHAT YOU WILL DO')
    expect(headings).toContain('WHAT WE ARE LOOKING FOR')
    expect(headings).toContain('COMPENSATION AND BENEFITS')
  })

  it('does not treat short ALL CAPS as headings', () => {
    const result = splitSections('AWS and GCP are required.\nNO WAY')
    const headings = result.filter(s => s.heading !== null)
    expect(headings).toHaveLength(0)
  })

  // ── HTML headings ──────────────────────────────────────────────────
  it('splits on HTML <h2>-<h4> headings', () => {
    const result = splitSections(fixture('generic-html-headings.txt'))
    const headings = result.map(s => s.heading)
    expect(headings).toContain('About Us')
    expect(headings).toContain('Key Responsibilities')
    expect(headings).toContain('Requirements')
    expect(headings).toContain('Nice to Have')
  })

  // ── Mixed headings ────────────────────────────────────────────────
  it('handles mixed heading styles in one document', () => {
    const result = splitSections(fixture('generic-mixed-headings.txt'))
    expect(result.length).toBeGreaterThanOrEqual(4)
    const headings = result.map(s => s.heading)
    expect(headings).toContain('Overview')
    expect(headings).toContain("What You'll Do")
    expect(headings).toContain('Compensation')
  })

  // ── Real JDs ──────────────────────────────────────────────────────
  it('splits Anthropic JD (markdown + bold headings)', () => {
    const result = splitSections(fixture('anthropic-cybersec-re.txt'))
    expect(result.length).toBeGreaterThanOrEqual(4)
    const headings = result.map(s => s.heading).filter(Boolean)
    expect(headings.length).toBeGreaterThanOrEqual(3)
  })

  it('splits Snorkel JD (plain text headings)', () => {
    const result = splitSections(fixture('snorkel-training-infra.txt'))
    expect(result.length).toBeGreaterThanOrEqual(3)
  })

  it('splits BetterUp wall-of-text JD', () => {
    const result = splitSections(fixture('betterup-ai-security.txt'))
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  // ── Byte offsets ──────────────────────────────────────────────────
  it('tracks byte offsets correctly', () => {
    const text = '## First\nContent 1\n\n## Second\nContent 2'
    const result = splitSections(text)
    expect(result[0].byteOffset).toBe(0)
    expect(result[1].byteOffset).toBe(text.indexOf('## Second'))
  })

  // ── No headings ───────────────────────────────────────────────────
  it('returns single section for text with no recognizable headings', () => {
    const result = splitSections(fixture('generic-no-headings.txt'))
    expect(result).toHaveLength(1)
    expect(result[0].heading).toBeNull()
    expect(result[0].text).toContain('software engineer')
  })

  // ── Does not split on bullet lines that look uppercase ────────────
  it('does not treat bullet-prefixed ALL CAPS lines as headings', () => {
    const text = '## Real Heading\n- THIS IS A BULLET ITEM\n- ANOTHER BULLET ITEM'
    const result = splitSections(text)
    const headings = result.map(s => s.heading).filter(Boolean)
    expect(headings).toEqual(['Real Heading'])
  })
})
