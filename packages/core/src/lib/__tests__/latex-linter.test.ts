import { describe, test, expect } from 'bun:test'
import { lintLatex } from '../latex-linter'

const VALID_LATEX = `\\documentclass[letterpaper,10pt]{article}
\\usepackage[empty]{fullpage}
\\input{glyphtounicode}

\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=*]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}

\\begin{document}

\\section{Experience}
\\resumeSubHeadingListStart
  \\resumeItemListStart
    \\item Built things
  \\resumeItemListEnd
\\resumeSubHeadingListEnd

\\end{document}
`

describe('lintLatex', () => {
  test('valid LaTeX document passes', () => {
    const result = lintLatex(VALID_LATEX)
    expect(result.ok).toBe(true)
  })

  test('missing \\begin{document} fails', () => {
    const result = lintLatex('\\end{document}')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.includes('\\begin{document}'))).toBe(true)
    }
  })

  test('missing \\end{document} fails', () => {
    const result = lintLatex('\\begin{document}')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.includes('\\end{document}'))).toBe(true)
    }
  })

  test('unmatched \\resumeItemListStart without End fails', () => {
    const result = lintLatex(`\\begin{document}
\\resumeItemListStart
\\end{document}`)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.includes('Unmatched \\resumeItemListStart'))).toBe(true)
    }
  })

  test('matched resumeItemListStart/End passes', () => {
    const result = lintLatex(`\\begin{document}
\\resumeItemListStart
\\resumeItemListEnd
\\end{document}`)
    expect(result.ok).toBe(true)
  })

  test('unmatched \\resumeSubHeadingListStart fails', () => {
    const result = lintLatex(`\\begin{document}
\\resumeSubHeadingListStart
\\end{document}`)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.includes('Unmatched \\resumeSubHeadingListStart'))).toBe(true)
    }
  })

  test('\\write18 anywhere in document fails with SECURITY error', () => {
    const result = lintLatex(`\\begin{document}
\\write18{rm -rf /}
\\end{document}`)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.includes('SECURITY') && e.includes('\\write18'))).toBe(true)
    }
  })

  test('\\input{/etc/passwd} fails with SECURITY error', () => {
    const result = lintLatex(`\\begin{document}
\\input{/etc/passwd}
\\end{document}`)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.includes('SECURITY') && e.includes('\\input'))).toBe(true)
    }
  })

  test('\\input{glyphtounicode} is allowed (preamble standard)', () => {
    const result = lintLatex(`\\input{glyphtounicode}
\\begin{document}
\\end{document}`)
    expect(result.ok).toBe(true)
  })

  test('unescaped & outside tabular context warns', () => {
    const result = lintLatex(`\\begin{document}
R&D Corp
\\end{document}`)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(e => e.includes("unescaped '&'"))).toBe(true)
    }
  })

  test('& in line with $ (math mode) does not warn', () => {
    const result = lintLatex(`\\begin{document}
\\small Reston, VA $|$ adam@example.com
\\end{document}`)
    expect(result.ok).toBe(true)
  })

  test('& in tabular context does not warn', () => {
    const result = lintLatex(`\\begin{document}
\\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
  Cell1 & Cell2
\\end{tabular*}
\\end{document}`)
    expect(result.ok).toBe(true)
  })
})
