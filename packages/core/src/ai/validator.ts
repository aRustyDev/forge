/**
 * Output validation for AI-generated responses.
 *
 * Validates the parsed JSON payload against expected schemas before any
 * data is persisted.  Invalid output is never partially saved.
 */

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface BulletDerivationResponse {
  bullets: Array<{
    content: string
    technologies: string[]
    metrics: string | null
  }>
}

export interface PerspectiveDerivationResponse {
  content: string
  reasoning: string
}

// ---------------------------------------------------------------------------
// Validation result types
// ---------------------------------------------------------------------------

export type ValidationResult<T> =
  | { ok: true; data: T; warnings: string[] }
  | { ok: false; error: string }

// ---------------------------------------------------------------------------
// Known field sets (for extra-field detection)
// ---------------------------------------------------------------------------

const BULLET_ITEM_FIELDS = new Set(['content', 'technologies', 'metrics'])
const BULLET_ROOT_FIELDS = new Set(['bullets'])
const PERSPECTIVE_FIELDS = new Set(['content', 'reasoning'])

function extraFields(obj: Record<string, unknown>, known: Set<string>): string[] {
  return Object.keys(obj).filter((k) => !known.has(k))
}

// ---------------------------------------------------------------------------
// Bullet derivation validator
// ---------------------------------------------------------------------------

export function validateBulletDerivation(
  data: unknown,
): ValidationResult<BulletDerivationResponse> {
  const warnings: string[] = []

  if (data === null || data === undefined || typeof data !== 'object') {
    return { ok: false, error: 'Response is not an object' }
  }

  const obj = data as Record<string, unknown>

  // Extra fields at root level
  const rootExtra = extraFields(obj, BULLET_ROOT_FIELDS)
  if (rootExtra.length > 0) {
    warnings.push(`Unexpected root fields: ${rootExtra.join(', ')}`)
  }

  // .bullets must exist and be an array
  if (!('bullets' in obj)) {
    return { ok: false, error: 'Missing required field "bullets"' }
  }

  if (!Array.isArray(obj.bullets)) {
    return { ok: false, error: '"bullets" must be an array' }
  }

  // Empty array is a validation error
  if (obj.bullets.length === 0) {
    return { ok: false, error: '"bullets" array is empty — no bullets produced' }
  }

  // Validate each bullet item
  const bullets: BulletDerivationResponse['bullets'] = []
  for (let i = 0; i < obj.bullets.length; i++) {
    const item = obj.bullets[i]
    const prefix = `bullets[${i}]`

    if (item === null || item === undefined || typeof item !== 'object') {
      return { ok: false, error: `${prefix} is not an object` }
    }

    const bullet = item as Record<string, unknown>

    // Extra fields on bullet items
    const itemExtra = extraFields(bullet, BULLET_ITEM_FIELDS)
    if (itemExtra.length > 0) {
      warnings.push(`${prefix}: unexpected fields: ${itemExtra.join(', ')}`)
    }

    // content — required, non-empty string
    if (typeof bullet.content !== 'string') {
      return { ok: false, error: `${prefix}.content must be a string` }
    }
    if (bullet.content.trim().length === 0) {
      return { ok: false, error: `${prefix}.content must be non-empty` }
    }

    // technologies — required, array of strings
    if (!Array.isArray(bullet.technologies)) {
      return { ok: false, error: `${prefix}.technologies must be an array` }
    }
    for (let j = 0; j < bullet.technologies.length; j++) {
      if (typeof bullet.technologies[j] !== 'string') {
        return {
          ok: false,
          error: `${prefix}.technologies[${j}] must be a string`,
        }
      }
    }

    // metrics — required field, must be string or null
    if (!('metrics' in bullet)) {
      return { ok: false, error: `${prefix}.metrics is required (use null if none)` }
    }
    if (bullet.metrics !== null && typeof bullet.metrics !== 'string') {
      return { ok: false, error: `${prefix}.metrics must be a string or null` }
    }

    bullets.push({
      content: bullet.content,
      technologies: bullet.technologies as string[],
      metrics: bullet.metrics as string | null,
    })
  }

  return { ok: true, data: { bullets }, warnings }
}

// ---------------------------------------------------------------------------
// Perspective derivation validator
// ---------------------------------------------------------------------------

export function validatePerspectiveDerivation(
  data: unknown,
): ValidationResult<PerspectiveDerivationResponse> {
  const warnings: string[] = []

  if (data === null || data === undefined || typeof data !== 'object') {
    return { ok: false, error: 'Response is not an object' }
  }

  const obj = data as Record<string, unknown>

  // Extra fields
  const extra = extraFields(obj, PERSPECTIVE_FIELDS)
  if (extra.length > 0) {
    warnings.push(`Unexpected fields: ${extra.join(', ')}`)
  }

  // content — required, non-empty string
  if (typeof obj.content !== 'string') {
    return { ok: false, error: 'Missing or invalid "content" field (must be a string)' }
  }
  if (obj.content.trim().length === 0) {
    return { ok: false, error: '"content" must be non-empty' }
  }

  // reasoning — required, string
  if (typeof obj.reasoning !== 'string') {
    return { ok: false, error: 'Missing or invalid "reasoning" field (must be a string)' }
  }

  return {
    ok: true,
    data: { content: obj.content, reasoning: obj.reasoning },
    warnings,
  }
}
