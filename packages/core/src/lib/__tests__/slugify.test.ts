import { describe, expect, it } from 'bun:test'
import { slugify } from '../slugify'

describe('slugify', () => {
  it('slugifies regular string', () => {
    expect(slugify('Agentic AI Engineer')).toBe('agentic-ai-engineer')
  })

  it('strips leading and trailing hyphens', () => {
    expect(slugify('---foo---')).toBe('foo')
  })

  it('handles special characters', () => {
    expect(slugify('hello world! @#$')).toBe('hello-world')
  })

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('')
  })

  it('handles single word', () => {
    expect(slugify('Python')).toBe('python')
  })

  it('collapses multiple consecutive spaces into single hyphen', () => {
    expect(slugify('a   b')).toBe('a-b')
  })
})
