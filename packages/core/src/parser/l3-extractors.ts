import type { ClassifiedSection, SalaryRange } from './types'

// ── Salary Extractor ────────────────────────────────────────────────

/**
 * Salary range patterns, ordered by specificity.
 *
 * Handles: $200,000 - $300,000, $200,000—$405,000 (em-dash),
 * $200,000 to $300,000, $120k-$160k, $75 - $120/hr, $95,000/year
 */
const SALARY_RANGE_PATTERNS: RegExp[] = [
  // $X,XXX—$Y,YYY or $X,XXX - $Y,YYY or $X,XXX – $Y,YYY
  /\$\s*([\d,]+(?:\.\d+)?)\s*[—–\-]\s*\$\s*([\d,]+(?:\.\d+)?)/,
  // $Xk-$Yk or $Xk–$Yk
  /\$\s*(\d+)\s*k\s*[—–\-]\s*\$\s*(\d+)\s*k/i,
  // $X to $Y
  /\$\s*([\d,]+(?:\.\d+)?)\s+to\s+\$\s*([\d,]+(?:\.\d+)?)/i,
  // $Xk to $Yk
  /\$\s*(\d+)\s*k\s+to\s+\$\s*(\d+)\s*k/i,
  // ranges from $X to $Y
  /from\s+\$\s*([\d,]+(?:\.\d+)?)\s+to\s+\$\s*([\d,]+(?:\.\d+)?)/i,
]

const HOURLY_INDICATORS = /\/\s*h(?:ou)?r|per\s+hour|hourly/i
const ANNUAL_INDICATORS = /\/\s*y(?:ea)?r|per\s+year|annual|annually|USD/i

function parseSalaryNumber(raw: string): number {
  return parseFloat(raw.replace(/,/g, ''))
}

export function extractSalary(sections: ClassifiedSection[]): SalaryRange | null {
  // Prioritize compensation sections, then scan all
  const ordered = [
    ...sections.filter(s => s.category === 'compensation'),
    ...sections.filter(s => s.category !== 'compensation'),
  ]

  for (const section of ordered) {
    const lines = section.text.split('\n')

    for (const line of lines) {
      // Try range patterns
      for (const pattern of SALARY_RANGE_PATTERNS) {
        const match = line.match(pattern)
        if (match) {
          let min = parseSalaryNumber(match[1])
          let max = parseSalaryNumber(match[2])

          // Handle $Xk shorthand
          if (min < 1000 && max < 1000 && /k/i.test(line)) {
            min *= 1000
            max *= 1000
          }

          const period = HOURLY_INDICATORS.test(line)
            ? 'hourly' as const
            : (min >= 1000 || ANNUAL_INDICATORS.test(line))
              ? 'annual' as const
              : 'unknown' as const

          return { min, max, period }
        }
      }
    }
  }

  // Fallback: single salary number with context
  for (const section of ordered) {
    for (const line of section.text.split('\n')) {
      if (!/salary|compensation|pay|starting/i.test(line)) continue
      const match = line.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(?:\/\s*(?:yr|year|hour|hr))?\b/)
      if (match) {
        const value = parseSalaryNumber(match[1])
        if (value < 100) continue

        const period = HOURLY_INDICATORS.test(line)
          ? 'hourly' as const
          : 'annual' as const

        return { min: value, max: value, period }
      }
    }
  }

  return null
}

// ── Location Extractor ──────────────────────────────────────────────

const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV',
  'NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN',
  'TX','UT','VT','VA','WA','WV','WI','WY','DC',
])

// "City, ST" pattern — "New York, NY" or "San Francisco, CA"
// City names: 1-4 capitalized words (handles "San Francisco", "New York", "Salt Lake City")
// Uses a non-greedy approach: capture the last 1-4 words before ", ST"
const CITY_STATE_PATTERN = /(?:^|[;,.\s])((?:[A-Z][a-zA-Z.'-]+\s?){1,4}),\s*([A-Z]{2})\b/g

export function extractLocations(sections: ClassifiedSection[]): string[] {
  // Prioritize location sections, then description/compensation
  const ordered = [
    ...sections.filter(s => s.category === 'location'),
    ...sections.filter(s => s.category === 'description' || s.category === 'compensation'),
    ...sections.filter(s => !['location', 'description', 'compensation'].includes(s.category)),
  ]

  const locations = new Set<string>()

  for (const section of ordered) {
    // Reset lastIndex for global regex
    CITY_STATE_PATTERN.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = CITY_STATE_PATTERN.exec(section.text)) !== null) {
      const city = match[1].trim()
      const state = match[2]
      if (US_STATES.has(state)) {
        locations.add(`${city}, ${state}`)
      }
    }
  }

  return [...locations]
}

// ── Work Posture Extractor ──────────────────────────────────────────

const REMOTE_STRONG = [
  /fully\s+remote/i,
  /100%\s+remote/i,
  /remote\s+position/i,
  /remote\s+role/i,
  /this\s+is\s+a\s+(?:fully\s+)?remote/i,
]

const REMOTE_WEAK = [
  /\bremote\b/i,
]

const HYBRID_PATTERNS = [
  /hybrid\s+(?:position|role|work|schedule|arrangement)/i,
  /\bhybrid\b/i,
  /days?\s+(?:per\s+week|\/\s*week)\s+in[\s-]?office/i,
  /in[\s-]?office\s+\d+/i,
  /\d+\s+days?\s+(?:per\s+week|\/\s*week|in[\s-]?office)/i,
]

const ONSITE_PATTERNS = [
  /\bon[\s-]?site\b/i,
  /\bin[\s-]?person\b/i,
]

export function extractWorkPosture(sections: ClassifiedSection[]): 'remote' | 'hybrid' | 'on-site' | null {
  let remoteScore = 0
  let hybridScore = 0
  let onsiteScore = 0

  for (const section of sections) {
    const text = section.text

    for (const p of REMOTE_STRONG) {
      if (p.test(text)) remoteScore += 3
    }
    for (const p of REMOTE_WEAK) {
      if (p.test(text)) remoteScore += 1
    }
    for (const p of HYBRID_PATTERNS) {
      if (p.test(text)) hybridScore += 3
    }
    for (const p of ONSITE_PATTERNS) {
      if (p.test(text)) onsiteScore += 2
    }
  }

  // Hybrid beats remote when both present (e.g., "hybrid, 2 days in office")
  if (hybridScore > 0 && hybridScore >= remoteScore) return 'hybrid'
  if (remoteScore > 0) return 'remote'
  if (onsiteScore > 0) return 'on-site'
  return null
}
