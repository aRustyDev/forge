import type { Section } from './types'

// Lines starting with bullet characters are never headings
const BULLET_PREFIX = /^\s*[-*+•]\s|^\s*\d+[.)]\s/

interface HeadingMatch {
  heading: string
  remainder: string | null  // text after heading on same line (for inline bold headings)
}

/**
 * Try to detect a heading in a line. Returns the heading text if found,
 * plus any remainder text on the same line (for patterns like "**Heading** body text").
 */
function detectHeading(line: string): HeadingMatch | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  if (BULLET_PREFIX.test(trimmed)) return null

  // 1. Markdown: ## Heading
  const mdMatch = trimmed.match(/^#{1,4}\s+(.+?)\s*$/)
  if (mdMatch) return { heading: mdMatch[1].trim(), remainder: null }

  // 2. HTML: <h2>Heading</h2>
  const htmlMatch = trimmed.match(/^<h[2-4][^>]*>(.+?)<\/h[2-4]>\s*$/i)
  if (htmlMatch) return { heading: htmlMatch[1].trim(), remainder: null }

  // 3. Bold: **Heading** possibly followed by text on same line
  //    - "**Heading**" alone → heading, no remainder
  //    - "**Heading** some text" → heading, remainder = "some text"
  const boldMatch = trimmed.match(/^\*{2}(.+?)\*{2}\s*:?\s*(.*)$/)
  if (boldMatch) {
    const heading = boldMatch[1].trim()
    const after = boldMatch[2].trim()
    return { heading, remainder: after || null }
  }

  // 4. ALL CAPS: all uppercase on its own line, at least 8 chars
  //    Excludes short fragments like "NO WAY" or "AWS OK"
  if (/^[A-Z][A-Z\s&/,'-]*$/.test(trimmed) && trimmed.length >= 8) {
    return { heading: trimmed, remainder: null }
  }

  // 5. Title-case standalone heading: "About The Role", "Main Responsibilities"
  //    Only matches lines that contain known heading keywords.
  //    This prevents false positives on random capitalized text like "Content 1".
  if (trimmed.length <= 60 && !trimmed.includes('.') && !trimmed.includes(',')) {
    const lower = trimmed.toLowerCase()
    const headingKeywords = [
      'about', 'overview', 'summary', 'responsibilities', 'requirements',
      'qualifications', 'preferred', 'benefits', 'compensation', 'salary',
      'location', 'role', 'position', 'company', 'team', 'culture',
      'opportunity', 'skills', 'experience', 'what you', "what we",
      'how to apply', 'equal opportunity', 'nice to have',
    ]
    if (headingKeywords.some(kw => lower.includes(kw))) {
      const words = trimmed.split(/\s+/)
      if (words.length >= 2 && words.length <= 8 && /^[A-Z]/.test(words[0])) {
        return { heading: trimmed, remainder: null }
      }
    }
  }

  return null
}

export function splitSections(rawText: string): Section[] {
  if (!rawText || rawText.trim().length === 0) return []

  const lines = rawText.split('\n')
  const sections: Section[] = []
  let currentHeading: string | null = null
  let currentLines: string[] = []
  let currentOffset = 0
  let bytePos = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = detectHeading(line)

    if (match !== null) {
      // Flush previous section
      const text = currentLines.join('\n').trim()
      if (currentHeading !== null || text.length > 0) {
        sections.push({ heading: currentHeading, text, byteOffset: currentOffset })
      }

      currentHeading = match.heading
      currentLines = []
      currentOffset = bytePos

      // If heading had inline remainder text, add it as section content
      if (match.remainder) {
        currentLines.push(match.remainder)
      }
    } else {
      currentLines.push(line)
    }

    bytePos += Buffer.byteLength(line, 'utf-8') + 1 // +1 for \n
  }

  // Flush final section
  const text = currentLines.join('\n').trim()
  if (currentHeading !== null || text.length > 0) {
    sections.push({ heading: currentHeading, text, byteOffset: currentOffset })
  }

  return sections
}
