/**
 * US state resolution utility for free-text JD location strings.
 *
 * Extracts US state names from location strings using three strategies:
 * 1. Context-aware regex for 2-letter abbreviations after commas or at start
 * 2. Full state name matching (case-insensitive)
 * 3. Common city-to-state mappings
 *
 * The context-aware regex prevents false positives like "AI" matching Arizona
 * or "OK" matching Oklahoma when they appear in non-geographic context.
 */

/**
 * US state abbreviation to full name mapping.
 * Covers all 50 states + District of Columbia.
 */
const STATE_ABBR_TO_NAME: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas',
  CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
}

/**
 * Full state name to abbreviation mapping (reverse lookup).
 * Keys are lowercase for case-insensitive matching.
 */
const STATE_NAME_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_ABBR_TO_NAME).map(([abbr, name]) => [name.toLowerCase(), abbr])
)

/**
 * Common city-to-state mappings for locations that lack explicit state info.
 * Keys are lowercase. Covers major tech hubs and government centers.
 */
const CITY_TO_STATE: Record<string, string> = {
  'nyc': 'New York',
  'new york city': 'New York',
  'manhattan': 'New York',
  'brooklyn': 'New York',
  'san francisco': 'California',
  'sf': 'California',
  'los angeles': 'California',
  'la': 'California',
  'silicon valley': 'California',
  'san jose': 'California',
  'san diego': 'California',
  'seattle': 'Washington',
  'chicago': 'Illinois',
  'boston': 'Massachusetts',
  'austin': 'Texas',
  'dallas': 'Texas',
  'houston': 'Texas',
  'denver': 'Colorado',
  'portland': 'Oregon',
  'atlanta': 'Georgia',
  'miami': 'Florida',
  'dc': 'District of Columbia',
  'washington dc': 'District of Columbia',
  'washington, dc': 'District of Columbia',
  'arlington': 'Virginia',
  'reston': 'Virginia',
  'mclean': 'Virginia',
  'bethesda': 'Maryland',
  'baltimore': 'Maryland',
  'phoenix': 'Arizona',
  'minneapolis': 'Minnesota',
  'detroit': 'Michigan',
  'pittsburgh': 'Pennsylvania',
  'philadelphia': 'Pennsylvania',
}

/**
 * Attempt to resolve a US state from a free-text location string.
 * Returns the full state name (for GeoJSON matching) or null if unresolvable.
 *
 * Matching strategy (in order):
 * 1. Extract 2-letter state abbreviation from "City, ST" or "City, ST ZIP" patterns
 *    using context-aware regex to avoid false positives (AI, ML, OK, etc.)
 * 2. Match full state name anywhere in the string (case-insensitive)
 * 3. Match common city-to-state mappings (e.g., "NYC" -> "New York")
 * 4. Return null for "Remote", "Hybrid", or unresolvable locations
 */
export function resolveState(location: string | null | undefined): string | null {
  if (!location) return null

  const trimmed = location.trim()
  if (!trimmed) return null

  // Skip obvious non-geographic values
  const lower = trimmed.toLowerCase()
  if (lower === 'remote' || lower === 'doe' || lower === 'anywhere') return null

  // Pattern 1: "City, ST" or "City, ST 12345"
  // Context-aware regex: match state abbreviation only after a comma
  // (with optional whitespace) or at the very start of the string,
  // and followed by a zip code, end of string, or a non-letter character.
  // This prevents "AI" in "AI Engineer" from matching Arizona,
  // and "OK" in "Remote OK" from matching Oklahoma.
  const abbrMatch = trimmed.match(/(?:,\s*|^)([A-Z]{2})(?:\s+\d{5})?(?:\s*$|[^A-Za-z])/)
  if (abbrMatch) {
    const abbr = abbrMatch[1]
    if (STATE_ABBR_TO_NAME[abbr]) {
      return STATE_ABBR_TO_NAME[abbr]
    }
  }

  // Pattern 2: Full state name in the string (case-insensitive)
  for (const [name, _abbr] of Object.entries(STATE_NAME_TO_ABBR)) {
    if (lower.includes(name)) {
      return STATE_ABBR_TO_NAME[_abbr]
    }
  }

  // Pattern 3: Common city mappings
  for (const [city, state] of Object.entries(CITY_TO_STATE)) {
    if (lower.includes(city)) {
      return state
    }
  }

  return null
}
