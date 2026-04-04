import { describe, test, expect } from 'bun:test'
import {
  CLEARANCE_LEVELS,
  CLEARANCE_POLYGRAPHS,
  CLEARANCE_STATUSES,
  CLEARANCE_TYPES,
  CLEARANCE_ACCESS_PROGRAMS,
  CLEARANCE_LEVEL_LABELS,
  CLEARANCE_POLYGRAPH_LABELS,
  CLEARANCE_ACCESS_PROGRAM_LABELS,
  CLEARANCE_LEVEL_HIERARCHY,
  clearanceLevelRank,
  clearanceMeetsRequirement,
} from '../clearance'

describe('clearanceLevelRank', () => {
  test('public returns 0', () => {
    expect(clearanceLevelRank('public')).toBe(0)
  })

  test('l returns 1', () => {
    expect(clearanceLevelRank('l')).toBe(1)
  })

  test('confidential returns 2', () => {
    expect(clearanceLevelRank('confidential')).toBe(2)
  })

  test('secret returns 3', () => {
    expect(clearanceLevelRank('secret')).toBe(3)
  })

  test('top_secret returns 4', () => {
    expect(clearanceLevelRank('top_secret')).toBe(4)
  })

  test('q returns 4 (reciprocal with top_secret)', () => {
    expect(clearanceLevelRank('q')).toBe(4)
  })
})

describe('clearanceMeetsRequirement', () => {
  test('top_secret satisfies secret requirement', () => {
    expect(clearanceMeetsRequirement('top_secret', 'secret')).toBe(true)
  })

  test('secret does not satisfy top_secret requirement', () => {
    expect(clearanceMeetsRequirement('secret', 'top_secret')).toBe(false)
  })

  test('q satisfies top_secret requirement (reciprocal)', () => {
    expect(clearanceMeetsRequirement('q', 'top_secret')).toBe(true)
  })

  test('top_secret satisfies q requirement (reciprocal)', () => {
    expect(clearanceMeetsRequirement('top_secret', 'q')).toBe(true)
  })

  test('public does not satisfy confidential requirement', () => {
    expect(clearanceMeetsRequirement('public', 'confidential')).toBe(false)
  })

  test('secret satisfies public requirement', () => {
    expect(clearanceMeetsRequirement('secret', 'public')).toBe(true)
  })

  test('public satisfies public requirement', () => {
    expect(clearanceMeetsRequirement('public', 'public')).toBe(true)
  })

  test('l satisfies l requirement', () => {
    expect(clearanceMeetsRequirement('l', 'l')).toBe(true)
  })

  test('confidential does not satisfy secret requirement', () => {
    expect(clearanceMeetsRequirement('confidential', 'secret')).toBe(false)
  })
})

describe('enum arrays', () => {
  test('CLEARANCE_LEVELS has 6 entries', () => {
    expect(CLEARANCE_LEVELS).toHaveLength(6)
    expect(CLEARANCE_LEVELS).toEqual(['public', 'l', 'confidential', 'secret', 'top_secret', 'q'])
  })

  test('CLEARANCE_POLYGRAPHS has 3 entries', () => {
    expect(CLEARANCE_POLYGRAPHS).toHaveLength(3)
    expect(CLEARANCE_POLYGRAPHS).toEqual(['none', 'ci', 'full_scope'])
  })

  test('CLEARANCE_STATUSES has 2 entries', () => {
    expect(CLEARANCE_STATUSES).toHaveLength(2)
    expect(CLEARANCE_STATUSES).toEqual(['active', 'inactive'])
  })

  test('CLEARANCE_TYPES has 2 entries', () => {
    expect(CLEARANCE_TYPES).toHaveLength(2)
    expect(CLEARANCE_TYPES).toEqual(['personnel', 'facility'])
  })

  test('CLEARANCE_ACCESS_PROGRAMS has 3 entries', () => {
    expect(CLEARANCE_ACCESS_PROGRAMS).toHaveLength(3)
    expect(CLEARANCE_ACCESS_PROGRAMS).toEqual(['sci', 'sap', 'nato'])
  })

  test('CLEARANCE_LEVEL_HIERARCHY excludes public', () => {
    expect(CLEARANCE_LEVEL_HIERARCHY).not.toContain('public')
    expect(CLEARANCE_LEVEL_HIERARCHY).toHaveLength(5)
  })
})

describe('label maps', () => {
  test('CLEARANCE_LEVEL_LABELS has entries for every level', () => {
    for (const level of CLEARANCE_LEVELS) {
      expect(CLEARANCE_LEVEL_LABELS[level]).toBeDefined()
      expect(typeof CLEARANCE_LEVEL_LABELS[level]).toBe('string')
    }
  })

  test('CLEARANCE_POLYGRAPH_LABELS has entries for every polygraph', () => {
    for (const poly of CLEARANCE_POLYGRAPHS) {
      expect(CLEARANCE_POLYGRAPH_LABELS[poly]).toBeDefined()
      expect(typeof CLEARANCE_POLYGRAPH_LABELS[poly]).toBe('string')
    }
  })

  test('CLEARANCE_ACCESS_PROGRAM_LABELS has entries for every program', () => {
    for (const prog of CLEARANCE_ACCESS_PROGRAMS) {
      expect(CLEARANCE_ACCESS_PROGRAM_LABELS[prog]).toBeDefined()
      expect(typeof CLEARANCE_ACCESS_PROGRAM_LABELS[prog]).toBe('string')
    }
  })

  test('specific label values are correct', () => {
    expect(CLEARANCE_LEVEL_LABELS.top_secret).toBe('Top Secret (TS)')
    expect(CLEARANCE_LEVEL_LABELS.q).toBe('DOE Q')
    expect(CLEARANCE_LEVEL_LABELS.l).toBe('DOE L')
    expect(CLEARANCE_POLYGRAPH_LABELS.full_scope).toBe('Full Scope (Lifestyle)')
    expect(CLEARANCE_ACCESS_PROGRAM_LABELS.sci).toBe('SCI')
  })
})
