/**
 * LaTeX linter for resume content.
 *
 * Validates structural rules and security gates before accepting
 * LaTeX overrides. The security gate (\write18, \input) is critical --
 * prevents filesystem access via LaTeX compilation.
 */

import type { LintResult } from '../types'

export function lintLatex(content: string): LintResult {
  const errors: string[] = []

  // Rule 1: Document contains \begin{document} and \end{document}
  if (!content.includes('\\begin{document}')) {
    errors.push('Document must contain \\begin{document}')
  }
  if (!content.includes('\\end{document}')) {
    errors.push('Document must contain \\end{document}')
  }

  // Rule 2: All \resumeItemListStart matched by \resumeItemListEnd
  const itemListStarts = (content.match(/\\resumeItemListStart/g) || []).length
  const itemListEnds = (content.match(/\\resumeItemListEnd/g) || []).length
  if (itemListStarts !== itemListEnds) {
    errors.push(
      `Unmatched \\resumeItemListStart/\\resumeItemListEnd: ${itemListStarts} starts, ${itemListEnds} ends`
    )
  }

  // Rule 3: All \resumeSubHeadingListStart matched by \resumeSubHeadingListEnd
  const subHeadingStarts = (content.match(/\\resumeSubHeadingListStart/g) || []).length
  const subHeadingEnds = (content.match(/\\resumeSubHeadingListEnd/g) || []).length
  if (subHeadingStarts !== subHeadingEnds) {
    errors.push(
      `Unmatched \\resumeSubHeadingListStart/\\resumeSubHeadingListEnd: ${subHeadingStarts} starts, ${subHeadingEnds} ends`
    )
  }

  // Rule 4: Warn on unescaped & outside math mode / tabular context
  const lines = content.split('\n')
  let inTabular = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Track tabular environment
    if (line.includes('\\begin{tabular')) inTabular = true
    if (line.includes('\\end{tabular')) inTabular = false
    // Skip comment lines
    if (line.trimStart().startsWith('%')) continue
    // Skip lines in math mode or tabular context
    if (line.includes('$')) continue
    if (inTabular || line.includes('tabular') || line.includes('@{')) continue

    // Check for unescaped & (not preceded by \)
    if (/(?<!\\)&/.test(line)) {
      errors.push(`Line ${i + 1}: Possibly unescaped '&' (use \\& in text)`)
    }
  }

  // Rule 5: Security gate -- No \write18 or \input commands
  if (/\\write18/i.test(content)) {
    errors.push('SECURITY: \\write18 is forbidden (enables shell escape)')
  }
  if (/\\input\s*\{/i.test(content)) {
    // Allow \input{glyphtounicode} which is in the preamble
    const inputMatches = content.match(/\\input\s*\{([^}]+)\}/gi) || []
    for (const match of inputMatches) {
      if (!match.includes('glyphtounicode')) {
        errors.push(`SECURITY: \\input commands are forbidden (prevents filesystem access): ${match}`)
      }
    }
  }

  if (errors.length === 0) {
    return { ok: true }
  }
  return { ok: false, errors }
}
