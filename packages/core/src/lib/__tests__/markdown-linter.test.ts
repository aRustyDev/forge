import { describe, test, expect } from 'bun:test'
import { lintMarkdown } from '../markdown-linter'

const VALID_MARKDOWN = `# Adam Smith
Security Engineer

## Summary

Senior security engineer with 14+ years experience.

## Experience

### Raytheon
**Principal Engineer** | Mar 2024 - Jul 2025
- Built cloud forensics platform
- Developed detection rules

## Technical Skills

**Languages**: Python, Rust, Go
**DevSecOps**: Kubernetes, Terraform

## Security Clearance

TS/SCI - Active
`

describe('lintMarkdown', () => {
  test('valid document passes', () => {
    const result = lintMarkdown(VALID_MARKDOWN)
    expect(result.ok).toBe(true)
  })

  test('missing H1 fails with rule 1 error', () => {
    const result = lintMarkdown('## Summary\nSome text')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0]).toContain('level-1 heading')
    }
  })

  test('multiple H1 headings fails with rule 2 error', () => {
    const result = lintMarkdown('# Name\n# Another Name')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.includes('Only one level-1 heading'))).toBe(true)
    }
  })

  test('bullet with * fails with rule 3 error', () => {
    const result = lintMarkdown('# Name\n\n## Experience\n\n* Wrong bullet style')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.includes('must start with "- "'))).toBe(true)
    }
  })

  test('bullet with + fails with rule 3 error', () => {
    const result = lintMarkdown('# Name\n\n## Experience\n\n+ Wrong bullet style')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.includes('must start with "- "'))).toBe(true)
    }
  })

  test('- bullet passes rule 3', () => {
    const result = lintMarkdown('# Name\n\n## Experience\n\n- Correct bullet style')
    expect(result.ok).toBe(true)
  })

  test('**bold** text is not flagged as a bullet (rule 3 edge case)', () => {
    const result = lintMarkdown('# Name\n\n## Skills\n\n**Languages**: Python')
    expect(result.ok).toBe(true)
  })

  test('3+ consecutive blank lines fails with rule 5 error', () => {
    const result = lintMarkdown('# Name\n\n\n\n## Section')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.includes('consecutive blank lines'))).toBe(true)
    }
  })

  test('2 consecutive blank lines passes rule 5', () => {
    const result = lintMarkdown('# Name\n\n\n## Section')
    expect(result.ok).toBe(true)
  })

  test('skills section with missing **Label**: pattern fails rule 6', () => {
    const result = lintMarkdown('# Name\n\n## Technical Skills\n\nPython, Rust')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.includes('Skills section'))).toBe(true)
    }
  })

  test('skills section with correct pattern passes rule 6', () => {
    const result = lintMarkdown('# Name\n\n## Technical Skills\n\n**Languages**: Python, Rust')
    expect(result.ok).toBe(true)
  })

  test('errors include line numbers', () => {
    const result = lintMarkdown('# Name\n\n## Skills\n\nbad line')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => /Line \d+/.test(e))).toBe(true)
    }
  })
})
