/**
 * Unit tests for TaglineService (Phase 92).
 *
 * Tests are hermetic: the service is a pure function so we can assert exact
 * output without setting up a database.
 */

import { describe, test, expect } from 'bun:test'
import {
  tokenize,
  computeTfIdf,
  rankKeywords,
  generateTagline,
  DEFAULT_TOP_K,
  SKILL_MATCH_BOOST,
} from '../tagline-service'
import type { Skill } from '../../types'

// Minimal skill factory for tests — we only care about `name`
function makeSkill(name: string): Skill {
  return { id: crypto.randomUUID(), name, category: 'other' }
}

describe('tokenize', () => {
  test('lowercases input', () => {
    expect(tokenize('Python AND Terraform')).toContain('python')
    expect(tokenize('Python AND Terraform')).toContain('terraform')
  })

  test('drops stop words', () => {
    const tokens = tokenize('The quick brown fox jumps over the lazy dog')
    expect(tokens).not.toContain('the')
    expect(tokens).not.toContain('over')
    expect(tokens).toContain('quick')
    expect(tokens).toContain('brown')
  })

  test('drops tokens under 2 characters', () => {
    expect(tokenize('a b cd e')).toEqual(['cd'])
  })

  test('strips punctuation around tokens', () => {
    const tokens = tokenize('"python," terraform; aws!')
    expect(tokens).toEqual(['python', 'terraform', 'aws'])
  })

  test('preserves internal hyphens and plus signs', () => {
    const tokens = tokenize('front-end c++ ci-cd')
    expect(tokens).toContain('front-end')
    expect(tokens).toContain('c++')
    expect(tokens).toContain('ci-cd')
  })

  test('drops pure numbers', () => {
    // Pure digits have no alpha → filtered out
    const tokens = tokenize('5 years of python 10 plus kubernetes')
    expect(tokens).not.toContain('5')
    expect(tokens).not.toContain('10')
    expect(tokens).toContain('python')
    expect(tokens).toContain('kubernetes')
  })

  test('empty input returns empty array', () => {
    expect(tokenize('')).toEqual([])
    expect(tokenize(null as any)).toEqual([])
  })

  test('drops common job-description filler words', () => {
    const tokens = tokenize('looking for strong experience working with teams')
    expect(tokens).not.toContain('looking')
    expect(tokens).not.toContain('strong')
    expect(tokens).not.toContain('experience')
    expect(tokens).not.toContain('working')
    expect(tokens).not.toContain('teams')
  })
})

describe('computeTfIdf', () => {
  test('empty corpus yields empty map', () => {
    expect(computeTfIdf([]).size).toBe(0)
  })

  test('single JD assigns positive scores to every term', () => {
    const scores = computeTfIdf(['python terraform aws'])
    expect(scores.get('python')).toBeGreaterThan(0)
    expect(scores.get('terraform')).toBeGreaterThan(0)
    expect(scores.get('aws')).toBeGreaterThan(0)
  })

  test('term frequency in one JD boosts score', () => {
    // "python" appears 3x, "terraform" once
    const scores = computeTfIdf(['python python python terraform'])
    expect(scores.get('python')!).toBeGreaterThan(scores.get('terraform')!)
  })

  test('cross-JD repetition still accumulates score', () => {
    // "python" in two JDs, "terraform" in one
    const scores = computeTfIdf(['python terraform', 'python kubernetes'])
    expect(scores.get('python')!).toBeGreaterThan(scores.get('terraform')!)
    expect(scores.get('python')!).toBeGreaterThan(scores.get('kubernetes')!)
  })

  test('ubiquitous terms get down-weighted relative to unique terms', () => {
    // "python" appears in all 3 JDs (high df), "kafka" in only one (low df).
    // Despite python having equal or higher TF, kafka's IDF boost can't make
    // it beat python across the whole corpus. But a term that appears ONCE
    // in a single JD should still score higher per-JD than a term that
    // appears once in every JD.
    //
    // Concretely: compare a term unique to one JD vs a term in all JDs,
    // both with tf=1 in the JDs they appear in.
    const scores = computeTfIdf([
      'common rare1',
      'common rare2',
      'common rare3',
    ])
    // 'common' appears in every JD; rare1/2/3 each in exactly one.
    // With smoothed IDF = log((N+1)/(df+1))+1, unique terms get a higher
    // per-JD score than the ubiquitous term.
    expect(scores.get('rare1')!).toBeGreaterThan(scores.get('common')! / 3)
  })

  test('stop words are excluded from scores', () => {
    const scores = computeTfIdf(['the quick brown fox'])
    expect(scores.has('the')).toBe(false)
    expect(scores.has('over')).toBe(false)
    expect(scores.has('quick')).toBe(true)
  })
})

describe('rankKeywords', () => {
  test('returns entries sorted by score descending', () => {
    const map = new Map([
      ['alpha', 1.0],
      ['beta', 3.0],
      ['gamma', 2.0],
    ])
    const ranked = rankKeywords(map, [])
    expect(ranked.map((k) => k.term)).toEqual(['beta', 'gamma', 'alpha'])
  })

  test('skill match boosts score by SKILL_MATCH_BOOST', () => {
    const map = new Map([
      ['python', 1.0],
      ['terraform', 1.0],
    ])
    const skills = [makeSkill('Python')] // case-insensitive match
    const ranked = rankKeywords(map, skills)

    const python = ranked.find((k) => k.term === 'python')!
    const terraform = ranked.find((k) => k.term === 'terraform')!

    expect(python.matchedSkill).toBe(true)
    expect(terraform.matchedSkill).toBe(false)
    expect(python.score).toBe(1.0 * SKILL_MATCH_BOOST)
    expect(terraform.score).toBe(1.0)
    // With the boost, python should rank above terraform
    expect(ranked[0].term).toBe('python')
  })

  test('ties break alphabetically ascending', () => {
    const map = new Map([
      ['zebra', 1.0],
      ['apple', 1.0],
      ['mango', 1.0],
    ])
    const ranked = rankKeywords(map, [])
    expect(ranked.map((k) => k.term)).toEqual(['apple', 'mango', 'zebra'])
  })

  test('empty scores yield empty ranking', () => {
    expect(rankKeywords(new Map(), [])).toEqual([])
  })
})

describe('generateTagline', () => {
  test('empty corpus yields empty tagline', () => {
    const result = generateTagline([], [])
    expect(result.tagline).toBe('')
    expect(result.keywords).toEqual([])
  })

  test('whitespace-only texts yield empty tagline', () => {
    const result = generateTagline(['', '  ', '\n\t'], [])
    expect(result.tagline).toBe('')
  })

  test('produces top-K keywords joined by " + "', () => {
    const jd =
      'We build cloud infrastructure using python terraform kubernetes aws. ' +
      'Python experience required. Terraform mandatory.'
    const result = generateTagline([jd], [], { topK: 3 })

    expect(result.keywords.length).toBe(3)
    // The tagline must be the top-3 terms joined with ' + '
    expect(result.tagline).toBe(result.keywords.map((k) => k.term).join(' + '))
  })

  test('prefix renders as "<prefix> -- <keywords>"', () => {
    const jd = 'python terraform kubernetes'
    const result = generateTagline([jd], [], { prefix: 'Senior Platform Engineer' })
    expect(result.tagline.startsWith('Senior Platform Engineer -- ')).toBe(true)
  })

  test('default topK is DEFAULT_TOP_K', () => {
    const jd = 'alpha beta gamma delta epsilon zeta eta theta'
    const result = generateTagline([jd], [])
    expect(result.keywords.length).toBe(DEFAULT_TOP_K)
  })

  test('skill-matched terms rank above non-matched with equal base score', () => {
    // Build a corpus where terraform and postgres have identical raw TF-IDF.
    // Only one of them is a user skill — it should take the top slot.
    const jd = 'terraform postgres'
    const skills = [makeSkill('Terraform')]
    const result = generateTagline([jd], skills)
    expect(result.keywords[0].term).toBe('terraform')
    expect(result.keywords[0].matchedSkill).toBe(true)
  })

  test('handles multi-JD corpus and aggregates scores', () => {
    const jds = [
      'python aws kafka streaming',
      'python aws kinesis streaming',
      'python gcp pubsub',
    ]
    const result = generateTagline(jds, [], { topK: 3 })

    // python appears in all 3 JDs; aws in 2; streaming in 2. All ubiquity
    // gets dampened by IDF but python should still make the top list.
    const terms = result.keywords.map((k) => k.term)
    expect(terms).toContain('python')
  })

  test('matches skills case-insensitively', () => {
    const jd = 'JavaScript typescript'
    const skills = [makeSkill('TypeScript'), makeSkill('JAVASCRIPT')]
    const result = generateTagline([jd], skills, { topK: 2 })
    expect(result.keywords.every((k) => k.matchedSkill)).toBe(true)
  })

  test('omitting prefix yields bare keyword list', () => {
    const result = generateTagline(['alpha beta gamma'], [], { topK: 3 })
    expect(result.tagline).toBe('alpha + beta + gamma')
    expect(result.tagline).not.toContain('--')
  })
})
