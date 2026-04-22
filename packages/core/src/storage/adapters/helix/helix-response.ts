import type { ListResult } from '../../adapter-types'

/**
 * Normalize a HelixDB node query response to a single row.
 * HelixDB may return an array (from traversals) or a single object.
 */
export function normalizeNodeResponse(
  raw: unknown,
): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null
    return raw[0] as Record<string, unknown>
  }
  if (typeof raw === 'object') {
    return raw as Record<string, unknown>
  }
  return null
}

/**
 * Flatten a HelixDB edge response to the junction table row shape
 * the ELM expects (e.g. {bullet_id, skill_id, is_primary}).
 */
export function normalizeEdgeResponse(
  raw: Record<string, unknown>,
  fromField: string,
  toField: string,
): Record<string, unknown> {
  const from = raw.from as Record<string, unknown> | undefined
  const to = raw.to as Record<string, unknown> | undefined
  const properties = (raw.properties ?? {}) as Record<string, unknown>

  return {
    [fromField]: from?.id ?? null,
    [toField]: to?.id ?? null,
    ...properties,
  }
}

/**
 * Wrap a HelixDB list response in the ListResult shape.
 */
export function normalizeListResponse(
  raw: unknown,
  total?: number,
): ListResult {
  if (raw === null || raw === undefined) {
    return { rows: [], total: 0 }
  }
  const rows = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : [raw as Record<string, unknown>]
  return { rows, total: total ?? rows.length }
}
