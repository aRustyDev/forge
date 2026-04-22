/**
 * Map user profile fields to canonical FieldKind values for form autofill.
 * Returns a plain Record (not a Map) so it serializes over chrome messaging.
 *
 * Matches the UserProfile shape from @forge/sdk (post-migration 046):
 * - address is a structured Address object (city/state/country_code)
 * - URLs are in a profile_urls array keyed by 'linkedin', 'github', etc.
 */
export interface ProfileAddress {
  city: string | null
  state: string | null
  country_code: string
}

export interface ProfileUrl {
  key: string
  url: string
}

export interface ProfileFields {
  name: string
  email: string | null
  phone: string | null
  address: ProfileAddress | null
  urls: ProfileUrl[]
}

/**
 * Map ISO country codes to Workday display names.
 * Workday custom dropdowns show full country names, not ISO codes.
 */
const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  'US': 'United States of America',
  'CA': 'Canada',
  'GB': 'United Kingdom',
  'AU': 'Australia',
  'DE': 'Germany',
  'FR': 'France',
  'IN': 'India',
  'JP': 'Japan',
  'BR': 'Brazil',
  'MX': 'Mexico',
  'IL': 'Israel',
  'SG': 'Singapore',
  'IE': 'Ireland',
  'NL': 'Netherlands',
  'SE': 'Sweden',
  'CH': 'Switzerland',
  'NZ': 'New Zealand',
}

export function buildProfileFieldMap(profile: ProfileFields): Record<string, string> {
  const map: Record<string, string> = {}

  if (profile.name?.trim()) {
    map['name.full'] = profile.name
    const parts = profile.name.trim().split(/\s+/)
    if (parts.length >= 2) {
      map['name.first'] = parts[0]
      map['name.last'] = parts.slice(1).join(' ')
    } else {
      map['name.first'] = parts[0]
    }
  }

  if (profile.email) map['email'] = profile.email
  if (profile.phone) {
    // Strip country code (e.g. "+1 (816)..." → "(816)...") — country code goes in a separate dropdown
    map['phone'] = profile.phone.replace(/^\+\d+\s+/, '')
    map['phone.type'] = 'Mobile'
  }

  if (profile.address) {
    if (profile.address.city) map['address.city'] = profile.address.city
    if (profile.address.state) map['address.state'] = profile.address.state
    if (profile.address.country_code) {
      map['address.country'] = COUNTRY_CODE_TO_NAME[profile.address.country_code] ?? profile.address.country_code
    }
  }

  // Map well-known URL keys to FieldKind
  for (const entry of profile.urls) {
    if (entry.key === 'linkedin') map['profile.linkedin'] = entry.url
    else if (entry.key === 'github') map['profile.github'] = entry.url
    else if (entry.key === 'blog' || entry.key === 'portfolio') map['profile.website'] = entry.url
  }

  return map
}
