import { describe, it, expect } from 'vitest'
import { formatPhone } from './format'

describe('formatPhone', () => {
  it('formats US number with country code', () => {
    expect(formatPhone('+15551234567')).toBe('+1 (555) 123-4567')
  })

  it('formats US number with country code (digits only, no +)', () => {
    expect(formatPhone('15551234567')).toBe('+1 (555) 123-4567')
  })

  it('formats US number without country code', () => {
    expect(formatPhone('5551234567')).toBe('(555) 123-4567')
  })

  it('formats international number (UK)', () => {
    expect(formatPhone('+442071234567')).toBe('+44 207 123 4567')
  })

  it('returns empty string for empty input', () => {
    expect(formatPhone('')).toBe('')
  })

  it('returns empty string for null', () => {
    expect(formatPhone(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatPhone(undefined)).toBe('')
  })

  it('strips non-digit characters before processing', () => {
    expect(formatPhone('+1 (555) 123-4567')).toBe('+1 (555) 123-4567')
  })

  it('returns raw input for unrecognized formats', () => {
    expect(formatPhone('12345')).toBe('12345')
  })

  it('handles number with dashes and spaces', () => {
    expect(formatPhone('555-123-4567')).toBe('(555) 123-4567')
  })

  it('handles number with parentheses', () => {
    expect(formatPhone('(555) 123-4567')).toBe('(555) 123-4567')
  })
})
