import { describe, test, expect } from 'bun:test'
import { escapeLatex, escapeMarkdown } from '../escape'

describe('escapeLatex', () => {
  test('escapes ampersand', () => {
    expect(escapeLatex('R&D')).toBe('R\\&D')
  })

  test('escapes percent', () => {
    expect(escapeLatex('80% reduction')).toBe('80\\% reduction')
  })

  test('escapes dollar', () => {
    expect(escapeLatex('$100K')).toBe('\\$100K')
  })

  test('escapes hash', () => {
    expect(escapeLatex('issue #42')).toBe('issue \\#42')
  })

  test('escapes underscore', () => {
    expect(escapeLatex('snake_case')).toBe('snake\\_case')
  })

  test('escapes curly braces', () => {
    expect(escapeLatex('{value}')).toBe('\\{value\\}')
  })

  test('escapes tilde', () => {
    expect(escapeLatex('~approx')).toBe('\\textasciitilde{}approx')
  })

  test('escapes caret', () => {
    expect(escapeLatex('2^10')).toBe('2\\textasciicircum{}10')
  })

  test('escapes backslash', () => {
    expect(escapeLatex('path\\to\\file')).toBe('path\\textbackslash{}to\\textbackslash{}file')
  })

  test('handles empty string', () => {
    expect(escapeLatex('')).toBe('')
  })

  test('passes through plain text unchanged', () => {
    expect(escapeLatex('Hello world')).toBe('Hello world')
  })

  test('passes through unicode unchanged', () => {
    expect(escapeLatex('Resume for Rene')).toBe('Resume for Rene')
    expect(escapeLatex('em dash — here')).toBe('em dash — here')
  })

  test('handles multiple special chars in one string', () => {
    expect(escapeLatex('R&D: 80% of $budget'))
      .toBe('R\\&D: 80\\% of \\$budget')
  })

  test('backslash does not double-escape other replacements', () => {
    // Input: "A\B&C" -> backslash first: "A\textbackslash{}B&C" -> then &: "A\textbackslash{}B\&C"
    expect(escapeLatex('A\\B&C')).toBe('A\\textbackslash{}B\\&C')
  })
})

describe('escapeMarkdown', () => {
  test('escapes square brackets', () => {
    expect(escapeMarkdown('[link]')).toBe('\\[link\\]')
  })

  test('escapes backslash', () => {
    expect(escapeMarkdown('path\\to')).toBe('path\\\\to')
  })

  test('does not escape asterisk', () => {
    expect(escapeMarkdown('*bold*')).toBe('*bold*')
  })

  test('does not escape underscore', () => {
    expect(escapeMarkdown('snake_case')).toBe('snake_case')
  })

  test('handles empty string', () => {
    expect(escapeMarkdown('')).toBe('')
  })

  test('passes through unicode unchanged', () => {
    expect(escapeMarkdown('cafe')).toBe('cafe')
  })

  test('handles combined special chars', () => {
    expect(escapeMarkdown('see [docs] at path\\ref'))
      .toBe('see \\[docs\\] at path\\\\ref')
  })
})
