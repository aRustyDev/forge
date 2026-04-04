/**
 * Escape utilities for resume format compilers.
 *
 * These functions escape user-authored content before insertion into
 * LaTeX or Markdown output. Template structural strings are NEVER escaped.
 */

/**
 * Escape the 10 LaTeX special characters.
 *
 * Order matters: backslash MUST be escaped FIRST to avoid double-escaping
 * the backslashes introduced by later replacements.
 */
export function escapeLatex(text: string): string {
  if (!text) return text

  // Use placeholders for multi-char replacements to avoid double-escaping.
  // The sentinel chars \x00-\x02 won't appear in real resume text.
  return text
    .replace(/\\/g, '\x00BACKSLASH\x00')
    .replace(/~/g, '\x01TILDE\x01')
    .replace(/\^/g, '\x02CARET\x02')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\x00BACKSLASH\x00/g, '\\textbackslash{}')
    .replace(/\x01TILDE\x01/g, '\\textasciitilde{}')
    .replace(/\x02CARET\x02/g, '\\textasciicircum{}')
}

/**
 * Escape Markdown special characters in inline positions.
 *
 * Only escapes [, ], and \ -- IR content is plain text with no
 * inline formatting in MVP. Does NOT escape * or _ (they only
 * matter in formatting contexts which IR content doesn't use).
 */
export function escapeMarkdown(text: string): string {
  if (!text) return text

  return text
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
}
