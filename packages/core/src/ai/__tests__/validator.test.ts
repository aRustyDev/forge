import { describe, expect, it } from 'bun:test'
import {
  validateBulletDerivation,
  validatePerspectiveDerivation,
} from '../validator'

// ---------------------------------------------------------------------------
// Bullet derivation validation
// ---------------------------------------------------------------------------

describe('validateBulletDerivation', () => {
  const validResponse = {
    bullets: [
      {
        content: 'Led 4-engineer team migrating cloud forensics platform',
        technologies: ['ELK', 'AWS OpenSearch'],
        metrics: '4 engineers, 6 months',
      },
      {
        content: 'Built infrastructure automation with Terraform',
        technologies: ['Terraform', 'GitLab CI/CD'],
        metrics: null,
      },
    ],
  }

  // --- Success cases ---

  it('accepts a valid response', () => {
    const result = validateBulletDerivation(validResponse)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.bullets).toHaveLength(2)
      expect(result.data.bullets[0].content).toBe(
        'Led 4-engineer team migrating cloud forensics platform',
      )
      expect(result.data.bullets[0].technologies).toEqual(['ELK', 'AWS OpenSearch'])
      expect(result.data.bullets[0].metrics).toBe('4 engineers, 6 months')
      expect(result.data.bullets[1].metrics).toBeNull()
      expect(result.warnings).toEqual([])
    }
  })

  it('accepts bullets with empty technologies array', () => {
    const response = {
      bullets: [{ content: 'Something', technologies: [], metrics: null }],
    }
    const result = validateBulletDerivation(response)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.bullets[0].technologies).toEqual([])
    }
  })

  // --- Extra fields (warning, not error) ---

  it('warns on extra root-level fields but still succeeds', () => {
    const response = {
      ...validResponse,
      extra_field: 'surprise',
    }
    const result = validateBulletDerivation(response)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain('extra_field')
    }
  })

  it('warns on extra bullet-item fields but still succeeds', () => {
    const response = {
      bullets: [
        {
          content: 'Test',
          technologies: [],
          metrics: null,
          confidence: 0.95,
        },
      ],
    }
    const result = validateBulletDerivation(response)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain('confidence')
    }
  })

  // --- Missing / invalid fields ---

  it('rejects null input', () => {
    const result = validateBulletDerivation(null)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('not an object')
  })

  it('rejects non-object input', () => {
    const result = validateBulletDerivation('string')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('not an object')
  })

  it('rejects missing bullets field', () => {
    const result = validateBulletDerivation({ content: 'no bullets here' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('Missing required field "bullets"')
  })

  it('rejects bullets that is not an array', () => {
    const result = validateBulletDerivation({ bullets: 'not an array' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('must be an array')
  })

  it('rejects empty bullets array', () => {
    const result = validateBulletDerivation({ bullets: [] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('empty')
  })

  it('rejects bullet item that is not an object', () => {
    const result = validateBulletDerivation({ bullets: ['not an object'] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('bullets[0] is not an object')
  })

  it('rejects missing content', () => {
    const result = validateBulletDerivation({
      bullets: [{ technologies: [], metrics: null }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('content must be a string')
  })

  it('rejects empty content', () => {
    const result = validateBulletDerivation({
      bullets: [{ content: '   ', technologies: [], metrics: null }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('content must be non-empty')
  })

  it('rejects non-array technologies', () => {
    const result = validateBulletDerivation({
      bullets: [{ content: 'Test', technologies: 'Python', metrics: null }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('technologies must be an array')
  })

  it('rejects non-string items in technologies', () => {
    const result = validateBulletDerivation({
      bullets: [{ content: 'Test', technologies: [123], metrics: null }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('technologies[0] must be a string')
  })

  it('rejects missing metrics field', () => {
    const result = validateBulletDerivation({
      bullets: [{ content: 'Test', technologies: [] }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('metrics is required')
  })

  it('rejects non-string non-null metrics', () => {
    const result = validateBulletDerivation({
      bullets: [{ content: 'Test', technologies: [], metrics: 42 }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('metrics must be a string or null')
  })
})

// ---------------------------------------------------------------------------
// Perspective derivation validation
// ---------------------------------------------------------------------------

describe('validatePerspectiveDerivation', () => {
  const validResponse = {
    content: 'Led cloud platform migration enabling ML-based log analysis pipeline',
    reasoning: 'Emphasized the ML/analytics enablement aspect of the migration',
  }

  // --- Success cases ---

  it('accepts a valid response', () => {
    const result = validatePerspectiveDerivation(validResponse)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.content).toBe(validResponse.content)
      expect(result.data.reasoning).toBe(validResponse.reasoning)
      expect(result.warnings).toEqual([])
    }
  })

  // --- Extra fields (warning, not error) ---

  it('warns on extra fields but still succeeds', () => {
    const response = { ...validResponse, confidence: 0.9 }
    const result = validatePerspectiveDerivation(response)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain('confidence')
    }
  })

  // --- Missing / invalid fields ---

  it('rejects null input', () => {
    const result = validatePerspectiveDerivation(null)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('not an object')
  })

  it('rejects non-object input', () => {
    const result = validatePerspectiveDerivation(42)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('not an object')
  })

  it('rejects missing content', () => {
    const result = validatePerspectiveDerivation({ reasoning: 'ok' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('"content"')
  })

  it('rejects empty content', () => {
    const result = validatePerspectiveDerivation({ content: '', reasoning: 'ok' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('non-empty')
  })

  it('rejects non-string content', () => {
    const result = validatePerspectiveDerivation({ content: 123, reasoning: 'ok' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('"content"')
  })

  it('rejects missing reasoning', () => {
    const result = validatePerspectiveDerivation({ content: 'test' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('"reasoning"')
  })

  it('rejects non-string reasoning', () => {
    const result = validatePerspectiveDerivation({ content: 'test', reasoning: null })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('"reasoning"')
  })
})
