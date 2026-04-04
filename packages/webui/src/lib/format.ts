/**
 * Format a raw phone string (e.g. "+15551234567") into display format.
 * Supports US numbers (+1) and international numbers.
 *
 * @param raw - Raw phone string, or null/undefined
 * @returns Formatted phone string, or empty string for falsy input
 *
 * Examples:
 *   "+15551234567"  -> "+1 (555) 123-4567"
 *   "+442071234567" -> "+44 207 123 4567"
 *   "5551234567"    -> "(555) 123-4567"    (assumes US, no country code)
 *   ""              -> ""                   (empty passthrough)
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')

  // US number with country code: 11 digits starting with 1
  if (digits.length === 11 && digits.startsWith('1')) {
    const cc = digits[0]
    const area = digits.slice(1, 4)
    const prefix = digits.slice(4, 7)
    const line = digits.slice(7, 11)
    return `+${cc} (${area}) ${prefix}-${line}`
  }

  // US number without country code: 10 digits
  if (digits.length === 10) {
    const area = digits.slice(0, 3)
    const prefix = digits.slice(3, 6)
    const line = digits.slice(6, 10)
    return `(${area}) ${prefix}-${line}`
  }

  // International: insert spaces after country code using basic grouping
  if (raw.startsWith('+') && digits.length > 10) {
    // Determine country code length (1-3 digits).
    // Heuristic: if total digits > 12, cc is 3; > 11, cc is 2; else 1.
    const ccLen = digits.length > 12 ? 3 : digits.length > 11 ? 2 : 1
    const cc = digits.slice(0, ccLen)
    const rest = digits.slice(ccLen)
    // Group remaining digits in chunks of 3-4
    const groups: string[] = []
    let i = 0
    while (i < rest.length) {
      const remaining = rest.length - i
      // Use groups of 3, but if only 4 left, use 4 (avoid leaving a lone digit)
      const chunk = remaining > 4 ? 3 : remaining
      groups.push(rest.slice(i, i + chunk))
      i += chunk
    }
    return `+${cc} ${groups.join(' ')}`
  }

  // Fallback: return as-is
  return raw
}
