import { describe, test, expect } from 'bun:test'
import { buildProfileFieldMap, type ProfileFields } from '../../src/lib/profile-map'

/** Helper to build a minimal ProfileFields with defaults */
function profile(overrides: Partial<ProfileFields> = {}): ProfileFields {
  return {
    name: 'Test',
    email: null,
    phone: null,
    address: null,
    urls: [],
    ...overrides,
  }
}

describe('buildProfileFieldMap', () => {
  test('maps all profile fields to field kinds', () => {
    const map = buildProfileFieldMap({
      name: 'Adam Smith',
      email: 'adam@example.com',
      phone: '+1 555-1234',
      address: { city: 'Reston', state: 'VA', country_code: 'US' },
      urls: [
        { key: 'linkedin', url: 'https://linkedin.com/in/adamsmith' },
        { key: 'github', url: 'https://github.com/adamsmith' },
        { key: 'blog', url: 'https://adamsmith.dev' },
      ],
    })

    expect(map['name.full']).toBe('Adam Smith')
    expect(map['name.first']).toBe('Adam')
    expect(map['name.last']).toBe('Smith')
    expect(map['email']).toBe('adam@example.com')
    expect(map['phone']).toBe('555-1234')
    expect(map['address.city']).toBe('Reston')
    expect(map['address.state']).toBe('VA')
    expect(map['address.country']).toBe('United States of America')
    expect(map['profile.linkedin']).toBe('https://linkedin.com/in/adamsmith')
    expect(map['profile.github']).toBe('https://github.com/adamsmith')
    expect(map['profile.website']).toBe('https://adamsmith.dev')
  })

  test('splits multi-word last names correctly', () => {
    const map = buildProfileFieldMap(profile({ name: 'Jean Claude Van Damme' }))

    expect(map['name.first']).toBe('Jean')
    expect(map['name.last']).toBe('Claude Van Damme')
  })

  test('handles single-word name (first only)', () => {
    const map = buildProfileFieldMap(profile({ name: 'Prince' }))

    expect(map['name.full']).toBe('Prince')
    expect(map['name.first']).toBe('Prince')
    expect(map['name.last']).toBeUndefined()
  })

  test('skips null fields', () => {
    const map = buildProfileFieldMap(profile({ name: 'Test User' }))

    expect(map['email']).toBeUndefined()
    expect(map['phone']).toBeUndefined()
    expect(map['address.city']).toBeUndefined()
    expect(map['address.state']).toBeUndefined()
    expect(map['address.country']).toBeUndefined()
    expect(map['profile.linkedin']).toBeUndefined()
    expect(map['profile.github']).toBeUndefined()
    expect(map['profile.website']).toBeUndefined()
  })

  test('strips country code from phone', () => {
    const map = buildProfileFieldMap(profile({ phone: '+1 (816) 447-6683' }))
    expect(map['phone']).toBe('(816) 447-6683')
  })

  test('keeps phone without country code unchanged', () => {
    const map = buildProfileFieldMap(profile({ phone: '(816) 447-6683' }))
    expect(map['phone']).toBe('(816) 447-6683')
  })

  test('maps structured address fields individually', () => {
    const map = buildProfileFieldMap(profile({
      address: { city: 'Reston', state: 'VA', country_code: 'US' },
    }))
    expect(map['address.city']).toBe('Reston')
    expect(map['address.state']).toBe('VA')
    expect(map['address.country']).toBe('United States of America')
  })

  test('handles address with only city', () => {
    const map = buildProfileFieldMap(profile({
      address: { city: 'Remote', state: null, country_code: 'US' },
    }))
    expect(map['address.city']).toBe('Remote')
    expect(map['address.state']).toBeUndefined()
    expect(map['address.country']).toBe('United States of America')
  })

  test('maps portfolio URL to profile.website', () => {
    const map = buildProfileFieldMap(profile({
      urls: [{ key: 'portfolio', url: 'https://myportfolio.dev' }],
    }))
    expect(map['profile.website']).toBe('https://myportfolio.dev')
  })

  test('ignores unknown URL keys', () => {
    const map = buildProfileFieldMap(profile({
      urls: [{ key: 'indeed', url: 'https://indeed.com/me' }],
    }))
    expect(map['profile.linkedin']).toBeUndefined()
    expect(map['profile.github']).toBeUndefined()
    expect(map['profile.website']).toBeUndefined()
  })

  test('returns empty object for empty name', () => {
    const map = buildProfileFieldMap(profile({ name: '' }))

    expect(map['name.full']).toBeUndefined()
    expect(map['name.first']).toBeUndefined()
  })

  test('maps country code US to display name', () => {
    const map = buildProfileFieldMap(profile({
      address: { city: 'Reston', state: 'VA', country_code: 'US' },
    }))
    expect(map['address.country']).toBe('United States of America')
  })

  test('maps country code CA to Canada', () => {
    const map = buildProfileFieldMap(profile({
      address: { city: 'Toronto', state: 'ON', country_code: 'CA' },
    }))
    expect(map['address.country']).toBe('Canada')
  })

  test('passes through unknown country code as-is', () => {
    const map = buildProfileFieldMap(profile({
      address: { city: 'Seoul', state: null, country_code: 'KR' },
    }))
    expect(map['address.country']).toBe('KR')
  })

  test('sets phone.type to Mobile when phone exists', () => {
    const map = buildProfileFieldMap(profile({ phone: '555-1234' }))
    expect(map['phone.type']).toBe('Mobile')
  })

  test('does not set phone.type when phone is null', () => {
    const map = buildProfileFieldMap(profile({ phone: null }))
    expect(map['phone.type']).toBeUndefined()
  })
})
