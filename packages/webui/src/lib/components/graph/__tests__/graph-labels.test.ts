import { describe, it, expect } from 'vitest'
import { generateSlug, slugifyName, TYPE_PREFIXES } from '../graph.labels'

describe('slugifyName', () => {
  it('takes first two significant words', () => {
    expect(slugifyName('Raytheon PCFE Migration Project')).toBe('raytheon-pcfe')
  })

  it('strips stop words', () => {
    expect(slugifyName('Built an AI taxonomy pipeline')).toBe('built-ai')
  })

  it('handles single word', () => {
    expect(slugifyName('Kubernetes')).toBe('kubernetes')
  })

  it('truncates long slugs at word boundary', () => {
    expect(slugifyName('Superlongcompanyname Anotherlongword', 2).length).toBeLessThanOrEqual(20)
  })

  it('strips special characters', () => {
    expect(slugifyName('C++ & Python (Advanced)')).toBe('c-python')
  })

  it('handles empty string', () => {
    expect(slugifyName('')).toBe('')
  })

  it('returns empty string when all words are stop words', () => {
    expect(slugifyName('the a of')).toBe('')
  })

  it('respects maxWords parameter', () => {
    expect(slugifyName('one two three four', 3)).toBe('one-two-three')
  })

  it('handles multiple spaces and tabs', () => {
    expect(slugifyName('  word1   word2  ')).toBe('word1-word2')
  })

  it('handles hyphenated input and truncates at word boundary', () => {
    // 'cloud-native-infrastructure' is 27 chars, truncated at 20 = 'cloud-native-infrastr',
    // lastIndexOf('-') > 5 gives 'cloud-native'
    expect(slugifyName('cloud-native infrastructure')).toBe('cloud-native')
  })
})

describe('generateSlug', () => {
  it('uses known type prefix', () => {
    expect(generateSlug('source', 'Raytheon PCFE')).toBe('src:raytheon-pcfe')
  })

  it('uses first 3 chars for unknown type', () => {
    expect(generateSlug('widget', 'My Widget')).toBe('wid:my-widget')
  })

  it('maps all known types', () => {
    for (const [type, prefix] of Object.entries(TYPE_PREFIXES)) {
      const slug = generateSlug(type, 'Test Name')
      expect(slug.startsWith(`${prefix}:`)).toBe(true)
    }
  })

  it('handles all-stop-word names producing bare-colon slug', () => {
    expect(generateSlug('source', 'the a of')).toBe('src:')
  })

  it('handles empty name', () => {
    expect(generateSlug('bullet', '')).toBe('blt:')
  })
})

describe('TYPE_PREFIXES', () => {
  it('contains all expected entity types', () => {
    expect(TYPE_PREFIXES).toHaveProperty('source', 'src')
    expect(TYPE_PREFIXES).toHaveProperty('bullet', 'blt')
    expect(TYPE_PREFIXES).toHaveProperty('perspective', 'psp')
    expect(TYPE_PREFIXES).toHaveProperty('resume_entry', 'ent')
    expect(TYPE_PREFIXES).toHaveProperty('organization', 'org')
    expect(TYPE_PREFIXES).toHaveProperty('skill', 'skl')
    expect(TYPE_PREFIXES).toHaveProperty('job_description', 'jd')
    expect(TYPE_PREFIXES).toHaveProperty('resume', 'rsm')
  })
})
