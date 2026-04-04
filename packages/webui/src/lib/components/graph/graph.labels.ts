/**
 * Type prefix mapping for slug generation.
 * Short codes for entity types used in graph node identification.
 */
export const TYPE_PREFIXES: Record<string, string> = {
  source: 'src',
  bullet: 'blt',
  perspective: 'psp',
  resume_entry: 'ent',
  organization: 'org',
  skill: 'skl',
  job_description: 'jd',
  resume: 'rsm',
}

/**
 * Convert a name/title to a compact slug identifier.
 * Takes the first N significant words (default 2), lowercases, hyphenates.
 * Strips common stop words (the, a, an, of, for, and, to, in, with, on, at, by).
 *
 * Examples:
 *   slugifyName('Raytheon PCFE Migration Project')   -> 'raytheon-pcfe'
 *   slugifyName('Built an AI taxonomy pipeline')     -> 'built-ai'
 *   slugifyName('Kubernetes')                        -> 'kubernetes'
 *   slugifyName('C++ & Python (Advanced)')           -> 'c-python'
 */
export function slugifyName(name: string, maxWords = 2): string {
  const STOP_WORDS = new Set([
    'the', 'a', 'an', 'of', 'for', 'and', 'to', 'in', 'with', 'on', 'at', 'by',
  ])

  const words = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0 && !STOP_WORDS.has(w))

  const selected = words.slice(0, maxWords)
  const slug = selected.join('-')

  // Truncate to 20 chars, trimming at word boundary if possible
  if (slug.length <= 20) return slug
  const truncated = slug.slice(0, 20)
  const lastHyphen = truncated.lastIndexOf('-')
  return lastHyphen > 5 ? truncated.slice(0, lastHyphen) : truncated
}

/**
 * Generate a shortname slug for a graph node.
 * Format: {type_prefix}:{identifier}
 *
 * Examples:
 *   generateSlug('source', 'Raytheon PCFE Migration')     -> 'src:raytheon-pcfe'
 *   generateSlug('bullet', 'Built AI taxonomy pipeline')   -> 'blt:built-ai'
 *   generateSlug('perspective', 'DevSecOps Security Lead') -> 'psp:devsecops-security'
 *   generateSlug('organization', 'Booz Allen Hamilton')    -> 'org:booz-allen'
 *   generateSlug('skill', 'Kubernetes')                    -> 'skl:kubernetes'
 */
export function generateSlug(type: string, name: string): string {
  const prefix = TYPE_PREFIXES[type] ?? type.slice(0, 3)
  const identifier = slugifyName(name)
  return `${prefix}:${identifier}`
}
