const MAX_RESPONSE_BYTES = 50 * 1024  // 50KB

export interface TruncationResult {
  text: string
  truncated: boolean
}

/**
 * Truncate a JSON response if it exceeds MAX_RESPONSE_BYTES.
 *
 * When truncated, the response includes a _truncated flag and a message
 * telling the AI to use more specific filters or pagination.
 */
export function truncateResponse(data: unknown): TruncationResult {
  const json = JSON.stringify(data, null, 2)

  if (Buffer.byteLength(json, 'utf8') <= MAX_RESPONSE_BYTES) {
    return { text: json, truncated: false }
  }

  // For arrays, truncate by reducing items
  if (Array.isArray(data)) {
    let sliceSize = Math.max(10, Math.floor(data.length / 4))
    const truncated = {
      _truncated: true,
      _message: `Response truncated (${data.length} items). Use offset/limit pagination or more specific filters to get remaining results.`,
      _total_items: data.length,
      items: data.slice(0, sliceSize),
    }
    // Binary reduction: if still over limit, halve slice until it fits
    let result = JSON.stringify(truncated, null, 2)
    while (Buffer.byteLength(result, 'utf8') > MAX_RESPONSE_BYTES && sliceSize > 1) {
      sliceSize = Math.floor(sliceSize / 2)
      truncated.items = data.slice(0, sliceSize)
      result = JSON.stringify(truncated, null, 2)
    }
    return { text: result, truncated: true }
  }

  // For objects with array properties, truncate the largest array
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    const clone = { ...obj }

    for (const [key, value] of Object.entries(clone)) {
      if (Array.isArray(value) && value.length > 20) {
        (clone as any)[key] = value.slice(0, 20)
        ;(clone as any)[`_${key}_truncated`] = true
        ;(clone as any)[`_${key}_total`] = value.length
      }
    }

    let result = JSON.stringify(
      { ...clone, _truncated: true, _message: 'Large arrays truncated. Use pagination for full results.' },
      null,
      2,
    )
    // Post-truncation size check: if still over limit, halve array slices
    let maxItems = 20
    while (Buffer.byteLength(result, 'utf8') > MAX_RESPONSE_BYTES && maxItems > 1) {
      maxItems = Math.floor(maxItems / 2)
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value) && value.length > maxItems) {
          (clone as any)[key] = value.slice(0, maxItems)
          ;(clone as any)[`_${key}_truncated`] = true
          ;(clone as any)[`_${key}_total`] = value.length
        }
      }
      result = JSON.stringify(
        { ...clone, _truncated: true, _message: 'Large arrays truncated. Use pagination for full results.' },
        null,
        2,
      )
    }
    return { text: result, truncated: true }
  }

  // Fallback: hard truncate
  const truncatedJson = json.slice(0, MAX_RESPONSE_BYTES - 200)
  const fallback = {
    _truncated: true,
    _message: 'Response too large. Use more specific filters.',
    _partial: truncatedJson,
  }
  return { text: JSON.stringify(fallback), truncated: true }
}
