// packages/core/src/lib/jd-parser.ts

/**
 * JD Requirement Parser — programmatic extraction of individual requirements
 * from raw job description text.
 *
 * Splits on bullet points, numbered lists, and line breaks within
 * recognized sections (Requirements, Qualifications, etc.).
 *
 * Confidence scoring:
 * - 0.9: Structured list with clear bullet points under requirement sections
 * - 0.7: Structured list under responsibility sections (lower weight for alignment)
 * - 0.7-0.9: Semi-structured (line breaks, mixed formatting)
 * - 0.5-0.7: Some structure detected but ambiguous
 * - < 0.5: Prose paragraphs, hard to parse reliably
 *
 * NOTE (M4): Responsibility-section requirements are scored at 0.7 instead of 0.9
 * because responsibilities are less precise signals for skills matching than explicit
 * requirements/qualifications sections.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface ParsedRequirement {
  text: string
  confidence: number
  section: string | null  // which section it was found in (e.g., 'Requirements')
}

export interface ParsedRequirements {
  requirements: ParsedRequirement[]
  overall_confidence: number
}

// ── Section Detection ────────────────────────────────────────────────

/**
 * Known section headers that typically contain requirements.
 * Order matters: earlier entries are preferred when sections overlap.
 */
const REQUIREMENT_SECTIONS = [
  /^#{1,3}\s*(requirements|required\s+qualifications|minimum\s+qualifications|must[\s-]haves?)/im,
  /^#{1,3}\s*(qualifications|preferred\s+qualifications|desired\s+qualifications)/im,
  /^#{1,3}\s*(what\s+you('ll|\s+will)\s+(need|bring)|what\s+we('re|\s+are)\s+looking\s+for)/im,
  /^#{1,3}\s*(responsibilities|key\s+responsibilities|role\s+responsibilities)/im,
  /^#{1,3}\s*(nice[\s-]to[\s-]haves?|preferred|bonus|plus)/im,
  /^#{1,3}\s*(skills|technical\s+skills|required\s+skills)/im,
  /^\*{0,2}(requirements|qualifications|responsibilities|skills|what\s+you.+need)\*{0,2}\s*:?\s*$/im,
  /^(requirements|qualifications|responsibilities|skills|what\s+you.+need)\s*:?\s*$/im,
]

/** Patterns that match responsibility-section headers specifically. */
const RESPONSIBILITY_SECTION_PATTERNS = [
  /responsibilities/i,
]

/**
 * Section headers that indicate the end of requirements (e.g., Benefits, About Us).
 */
const NON_REQUIREMENT_SECTIONS = [
  /^#{1,3}\s*(benefits|perks|compensation|salary|about\s+(us|the\s+company|the\s+team))/im,
  /^#{1,3}\s*(how\s+to\s+apply|application\s+process|equal\s+opportunity)/im,
  /^#{1,3}\s*(company\s+(overview|description)|our\s+(mission|values|culture))/im,
  /^\*{0,2}(benefits|perks|about\s+(us|the))\*{0,2}\s*:?\s*$/im,
  /^(benefits|perks|about\s+(us|the))\s*:?\s*$/im,
]

// ── Bullet/List Detection ────────────────────────────────────────────

/** Matches lines starting with bullet characters or numbered list markers. */
const BULLET_PATTERN = /^[\s]*(?:[-*+]|\d+[.)]\s|[a-z][.)]\s|>\s)/
const SEMICOLON_LIST_PATTERN = /;\s*/

// ── Core Parser ──────────────────────────────────────────────────────

/**
 * Parse requirements from raw job description text.
 *
 * Strategy:
 * 1. Guard against excessively long input (max 100,000 chars).
 * 2. Detect requirement sections by header patterns.
 * 3. Extract content between requirement headers and next section header.
 * 4. Split section content on bullet points, numbered lists, or line breaks.
 * 5. Score each requirement based on how structured its source was.
 * 6. If no sections detected, attempt to parse the entire text.
 *
 * NOTE (IN3): If rawText exceeds 100,000 characters, return empty requirements
 * with confidence 0. This is a safety guard against pathologically long inputs
 * that could cause excessive processing time in the synchronous request path.
 */
export function parseRequirements(rawText: string): ParsedRequirements {
  if (!rawText || rawText.trim().length === 0) {
    return { requirements: [], overall_confidence: 0 }
  }

  // IN3: Max-length guard
  if (rawText.length > 100_000) {
    return { requirements: [], overall_confidence: 0 }
  }

  const lines = rawText.split('\n')
  const sections = detectSections(lines)

  let requirements: ParsedRequirement[]

  if (sections.length > 0) {
    // Parse structured sections
    requirements = []
    for (const section of sections) {
      const isResponsibilitySection = RESPONSIBILITY_SECTION_PATTERNS.some(p => p.test(section.name))
      const parsed = parseSectionContent(section.content, section.name, isResponsibilitySection)
      requirements.push(...parsed)
    }
  } else {
    // No sections detected -- try parsing the whole text
    requirements = parseSectionContent(rawText, null, false)
    // Lower confidence since we could not find section boundaries
    for (const req of requirements) {
      req.confidence *= 0.6
    }
  }

  // Filter out empty or too-short requirements
  requirements = requirements.filter(r => r.text.length >= 10)

  // Deduplicate by normalized text
  const seen = new Set<string>()
  requirements = requirements.filter(r => {
    const key = r.text.toLowerCase().trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const overall_confidence = requirements.length > 0
    ? requirements.reduce((sum, r) => sum + r.confidence, 0) / requirements.length
    : 0

  return { requirements, overall_confidence }
}

// ── Internal Helpers ─────────────────────────────────────────────────

interface DetectedSection {
  name: string
  content: string
  startLine: number
}

function detectSections(lines: string[]): DetectedSection[] {
  const sections: DetectedSection[] = []
  let currentSection: { name: string; startLine: number; lines: string[] } | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check if this line is a non-requirement section header (end current section)
    const isEndSection = NON_REQUIREMENT_SECTIONS.some(pat => pat.test(line))
    if (isEndSection && currentSection) {
      sections.push({
        name: currentSection.name,
        content: currentSection.lines.join('\n'),
        startLine: currentSection.startLine,
      })
      currentSection = null
      continue
    }

    // Check if this line is a requirement section header (start new section)
    for (const pat of REQUIREMENT_SECTIONS) {
      const match = line.match(pat)
      if (match) {
        // Close previous section if any
        if (currentSection) {
          sections.push({
            name: currentSection.name,
            content: currentSection.lines.join('\n'),
            startLine: currentSection.startLine,
          })
        }
        currentSection = {
          name: match[1] || 'Requirements',
          startLine: i,
          lines: [],
        }
        break
      }
    }

    // Accumulate lines into current section
    if (currentSection && !REQUIREMENT_SECTIONS.some(p => p.test(line))) {
      currentSection.lines.push(line)
    }
  }

  // Close final section
  if (currentSection) {
    sections.push({
      name: currentSection.name,
      content: currentSection.lines.join('\n'),
      startLine: currentSection.startLine,
    })
  }

  return sections
}

function parseSectionContent(
  content: string,
  sectionName: string | null,
  isResponsibilitySection: boolean,
): ParsedRequirement[] {
  const requirements: ParsedRequirement[] = []
  const lines = content.split('\n')

  // M4: Responsibility sections get lower base confidence (0.7 vs 0.9)
  const baseConfidence = isResponsibilitySection ? 0.7 : 0.9

  // Count how many lines look like bullets
  const bulletLines = lines.filter(l => BULLET_PATTERN.test(l))
  const isBulletList = bulletLines.length >= 1

  if (isBulletList) {
    // Structured bullet list -- high confidence
    for (const line of lines) {
      const trimmed = line.replace(BULLET_PATTERN, '').trim()
      if (trimmed.length === 0) continue

      // Check for semicolon-delimited sub-items
      if (SEMICOLON_LIST_PATTERN.test(trimmed) && trimmed.split(';').length >= 3) {
        for (const part of trimmed.split(';')) {
          const sub = part.trim()
          if (sub.length >= 10) {
            requirements.push({ text: sub, confidence: baseConfidence - 0.1, section: sectionName })
          }
        }
      } else {
        requirements.push({ text: trimmed, confidence: baseConfidence, section: sectionName })
      }
    }
  } else {
    // No clear bullet structure -- try splitting on line breaks
    const nonEmpty = lines.map(l => l.trim()).filter(l => l.length > 0)

    if (nonEmpty.length === 1) {
      // Single block of text -- try splitting on sentences
      // AP3: Use forward-looking split instead of lookbehind regex for JSC compatibility.
      // Tradeoff: This pattern may incorrectly split on abbreviations like "U.S. Army"
      // or "Dr. Smith", but is more resilient across JS engines than lookbehind.
      const sentences = nonEmpty[0].split(/\.\s+(?=[A-Z])/)
      for (const sentence of sentences) {
        const trimmed = sentence.trim()
        if (trimmed.length >= 10) {
          requirements.push({ text: trimmed, confidence: 0.4, section: sectionName })
        }
      }
    } else {
      // Multiple lines without bullet markers -- medium confidence
      for (const line of nonEmpty) {
        requirements.push({ text: line, confidence: 0.6, section: sectionName })
      }
    }
  }

  return requirements
}
