/**
 * Normalize a job page URL to its canonical form for dedup lookups.
 * Strips query params, hash, ensures trailing slash.
 */
export function normalizeJobUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.search = ''
    parsed.hash = ''
    if (!parsed.pathname.endsWith('/')) {
      parsed.pathname += '/'
    }
    return parsed.toString()
  } catch {
    return url
  }
}
