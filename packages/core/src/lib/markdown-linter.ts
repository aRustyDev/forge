/**
 * Markdown linter for resume content.
 *
 * Validates structural rules before accepting Markdown overrides.
 * Returns { ok: true } or { ok: false, errors: [...] }.
 */

import type { LintResult } from '../types'

export function lintMarkdown(content: string): LintResult {
  const errors: string[] = []
  const lines = content.split('\n')

  // Rule 1: Document begins with # Name (H1)
  const firstNonEmpty = lines.find(l => l.trim().length > 0)
  if (!firstNonEmpty || !firstNonEmpty.startsWith('# ')) {
    errors.push('Document must begin with a level-1 heading (# Name)')
  }

  // Rule 2: Sections start with ## (H2) -- only one H1 allowed
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    // H3+ used for org names/projects is fine, but H1 after the first line is not
    if (i > 0 && line.startsWith('# ') && !line.startsWith('## ') && !line.startsWith('### ')) {
      errors.push(`Line ${i + 1}: Only one level-1 heading allowed. Sections must use ## (H2)`)
    }
  }

  // Rule 3: Bullet items start with "- " (not "*" or "+")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trimStart()
    if ((trimmed.startsWith('* ') || trimmed.startsWith('+ ')) && !trimmed.startsWith('**')) {
      errors.push(`Line ${i + 1}: Bullet items must start with "- " (not "*" or "+")`)
    }
  }

  // Rule 4: No blank lines within a bullet item (deferred -- hard to detect without full parsing)

  // Rule 5: No more than 2 consecutive blank lines
  let consecutiveBlanks = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length === 0) {
      consecutiveBlanks++
      if (consecutiveBlanks > 2) {
        errors.push(`Line ${i + 1}: No more than 2 consecutive blank lines allowed`)
        break // Report once
      }
    } else {
      consecutiveBlanks = 0
    }
  }

  // Rule 6: Skills section items match **Label**: content pattern
  let inSkillsSection = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line.startsWith('## ') && line.toLowerCase().includes('skill')) {
      inSkillsSection = true
      continue
    }
    if (line.startsWith('## ') && !line.toLowerCase().includes('skill')) {
      inSkillsSection = false
      continue
    }

    if (inSkillsSection && line.length > 0 && !line.startsWith('## ')) {
      // Each non-empty line in skills section should match **Label**: content
      if (!line.match(/^\*\*[^*]+\*\*\s*:/)) {
        errors.push(`Line ${i + 1}: Skills section items must match "**Label**: content" pattern`)
      }
    }
  }

  if (errors.length === 0) {
    return { ok: true }
  }
  return { ok: false, errors }
}
