import { describe, it, expect } from 'vitest'
import { resolveState } from '../state-resolver'

describe('resolveState', () => {
  // Pattern 1: "City, ST" abbreviation after comma
  it('resolves "San Francisco, CA" to California', () => {
    expect(resolveState('San Francisco, CA')).toBe('California')
  })

  it('resolves "Austin, TX 78701" to Texas (with zip code)', () => {
    expect(resolveState('Austin, TX 78701')).toBe('Texas')
  })

  it('resolves "Hybrid - Seattle, WA" to Washington', () => {
    expect(resolveState('Hybrid - Seattle, WA')).toBe('Washington')
  })

  it('resolves "Remote (Denver, CO preferred)" to Colorado', () => {
    expect(resolveState('Remote (Denver, CO preferred)')).toBe('Colorado')
  })

  it('resolves "Washington, DC" to District of Columbia', () => {
    expect(resolveState('Washington, DC')).toBe('District of Columbia')
  })

  it('resolves "Reston, VA" to Virginia', () => {
    expect(resolveState('Reston, VA')).toBe('Virginia')
  })

  // Pattern 2: Full state name
  it('resolves "California" to California (full name)', () => {
    expect(resolveState('California')).toBe('California')
  })

  it('resolves "new york" to New York (case-insensitive)', () => {
    expect(resolveState('new york')).toBe('New York')
  })

  // Pattern 3: City mapping
  it('resolves "NYC" to New York', () => {
    expect(resolveState('NYC')).toBe('New York')
  })

  it('resolves "DC" to District of Columbia', () => {
    expect(resolveState('DC')).toBe('District of Columbia')
  })

  // Null/empty/non-geographic
  it('returns null for "Remote"', () => {
    expect(resolveState('Remote')).toBeNull()
  })

  it('returns null for "DOE"', () => {
    expect(resolveState('DOE')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(resolveState('')).toBeNull()
  })

  it('returns null for null', () => {
    expect(resolveState(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(resolveState(undefined)).toBeNull()
  })

  it('returns null for "Anywhere"', () => {
    expect(resolveState('Anywhere')).toBeNull()
  })

  // False positive protection
  it('returns null for "AI Engineer" (should NOT match Arizona)', () => {
    expect(resolveState('AI Engineer')).toBeNull()
  })

  it('returns null for "Remote OK" (should NOT match Oklahoma)', () => {
    expect(resolveState('Remote OK')).toBeNull()
  })

  // Standalone abbreviation edge case
  // resolveState('OK') returns 'Oklahoma' -- standalone two-letter abbreviations
  // are resolved when they match a state. This is intentional: if a location is
  // literally 'OK', we interpret it as Oklahoma. If this causes false positives,
  // add an exclusion list in a future iteration.
  it('resolves standalone "OK" to Oklahoma (intentional)', () => {
    expect(resolveState('OK')).toBe('Oklahoma')
  })
})
