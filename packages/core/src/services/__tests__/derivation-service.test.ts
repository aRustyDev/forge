import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { createTestDb, seedSource } from '../../db/__tests__/helpers'
import { BulletRepository } from '../../db/repositories/bullet-repository'

// Mock the AI module to avoid actual CLI calls
const mockInvokeClaude = mock(() => Promise.resolve({
  ok: true as const,
  data: {
    bullets: [
      {
        content: 'Led 4-engineer team migrating cloud forensics platform',
        technologies: ['aws', 'opensearch'],
        metrics: '4-engineer team',
      },
    ],
  },
  rawResponse: '{"bullets":[...]}',
}))

const mockValidateBulletDerivation = mock((data: unknown) => ({
  ok: true as const,
  data: data as { bullets: Array<{ content: string; technologies: string[]; metrics: string | null }> },
  warnings: [],
}))

const mockValidatePerspectiveDerivation = mock((data: unknown) => ({
  ok: true as const,
  data: data as { content: string; reasoning: string },
  warnings: [],
}))

// We need to mock before importing the service
mock.module('../../ai', () => ({
  invokeClaude: mockInvokeClaude,
  renderSourceToBulletPrompt: () => 'mocked prompt',
  renderBulletToPerspectivePrompt: () => 'mocked prompt',
  validateBulletDerivation: mockValidateBulletDerivation,
  validatePerspectiveDerivation: mockValidatePerspectiveDerivation,
  SOURCE_TO_BULLET_TEMPLATE_VERSION: 'v1-test',
  BULLET_TO_PERSPECTIVE_TEMPLATE_VERSION: 'v1-test',
}))

// Import after mocking
const { DerivationService } = await import('../derivation-service')

describe('DerivationService', () => {
  let db: Database
  let service: InstanceType<typeof DerivationService>
  let derivingBullets: Set<string>

  beforeEach(() => {
    db = createTestDb()
    derivingBullets = new Set<string>()
    service = new DerivationService(db, derivingBullets)

    // Reset mocks
    mockInvokeClaude.mockClear()
    mockValidateBulletDerivation.mockClear()
    mockValidatePerspectiveDerivation.mockClear()

    // Default: successful bullet derivation
    mockInvokeClaude.mockResolvedValue({
      ok: true as const,
      data: {
        bullets: [
          {
            content: 'Led 4-engineer team migrating cloud forensics platform',
            technologies: ['aws', 'opensearch'],
            metrics: '4-engineer team',
          },
        ],
      },
      rawResponse: '{"bullets":[...]}',
    })

    mockValidateBulletDerivation.mockReturnValue({
      ok: true as const,
      data: {
        bullets: [
          {
            content: 'Led 4-engineer team migrating cloud forensics platform',
            technologies: ['aws', 'opensearch'],
            metrics: '4-engineer team',
          },
        ],
      },
      warnings: [],
    })
  })

  afterEach(() => db.close())

  // ── deriveBulletsFromSource ───────────────────────────────────────

  test('deriveBulletsFromSource creates bullets with source junction', async () => {
    const srcId = seedSource(db, { status: 'approved' })

    const result = await service.deriveBulletsFromSource(srcId)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data).toHaveLength(1)
    expect(result.data[0].content).toBe('Led 4-engineer team migrating cloud forensics platform')
    expect(result.data[0].status).toBe('pending_review')

    // Verify bullet_sources junction row with is_primary=1
    const sources = BulletRepository.getSources(db, result.data[0].id)
    expect(sources).toHaveLength(1)
    expect(sources[0].id).toBe(srcId)
    expect(sources[0].is_primary).toBe(1)
  })

  test('deriveBulletsFromSource returns NOT_FOUND for missing source', async () => {
    const result = await service.deriveBulletsFromSource('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('deriveBulletsFromSource returns CONFLICT for deriving source', async () => {
    const srcId = seedSource(db, { status: 'approved' })

    // First call acquires the lock
    const firstPromise = service.deriveBulletsFromSource(srcId)

    // Simulate concurrent lock - manually set status to deriving
    // (In practice the first call already set it, so the second would fail)
    const result2 = await service.deriveBulletsFromSource(srcId)
    // The source is still locked from the first call
    expect(result2.ok).toBe(false)
    if (result2.ok) return
    expect(result2.error.code).toBe('CONFLICT')

    // Await the first call to clean up
    await firstPromise
  })

  test('deriveBulletsFromSource handles AI failure', async () => {
    const srcId = seedSource(db, { status: 'approved' })

    mockInvokeClaude.mockResolvedValueOnce({
      ok: false as const,
      error: 'PROCESS_ERROR' as const,
      message: 'Claude CLI failed',
      raw: 'error output',
    })

    const result = await service.deriveBulletsFromSource(srcId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('AI_ERROR')

    // Source should be unlocked after failure
    const source = db.query('SELECT status FROM sources WHERE id = ?').get(srcId) as { status: string }
    expect(source.status).not.toBe('deriving')
  })

  test('deriveBulletsFromSource handles validation failure', async () => {
    const srcId = seedSource(db, { status: 'approved' })

    mockValidateBulletDerivation.mockReturnValueOnce({
      ok: false as const,
      error: 'Missing bullets array',
    })

    const result = await service.deriveBulletsFromSource(srcId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('AI_ERROR')
  })

  // ── derivePerspectivesFromBullet ──────────────────────────────────

  test('derivePerspectivesFromBullet creates perspective for approved bullet', async () => {
    const srcId = seedSource(db)
    // Create an approved bullet
    const bullet = BulletRepository.create(db, {
      content: 'Led migration',
      source_content_snapshot: 'snapshot',
      technologies: ['aws'],
      metrics: null,
      status: 'approved',
      source_ids: [{ id: srcId, is_primary: true }],
    })

    mockInvokeClaude.mockResolvedValueOnce({
      ok: true as const,
      data: { content: 'Perspective content', reasoning: 'reasoning' },
      rawResponse: '{"content":"..."}',
    })

    mockValidatePerspectiveDerivation.mockReturnValueOnce({
      ok: true as const,
      data: { content: 'Perspective content', reasoning: 'reasoning' },
      warnings: [],
    })

    const result = await service.derivePerspectivesFromBullet(bullet.id, {
      archetype: 'agentic-ai',
      domain: 'ai_ml',
      framing: 'accomplishment',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.content).toBe('Perspective content')
    expect(result.data.status).toBe('pending_review')
    expect(result.data.bullet_id).toBe(bullet.id)
  })

  test('derivePerspectivesFromBullet rejects non-approved bullet', async () => {
    const srcId = seedSource(db)
    const bullet = BulletRepository.create(db, {
      content: 'Draft bullet',
      source_content_snapshot: 'snapshot',
      technologies: [],
      metrics: null,
      status: 'draft',
      source_ids: [{ id: srcId, is_primary: true }],
    })

    const result = await service.derivePerspectivesFromBullet(bullet.id, {
      archetype: 'agentic-ai',
      domain: 'ai_ml',
      framing: 'accomplishment',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('approved')
  })

  test('derivePerspectivesFromBullet returns NOT_FOUND for missing bullet', async () => {
    const result = await service.derivePerspectivesFromBullet('nonexistent', {
      archetype: 'agentic-ai',
      domain: 'ai_ml',
      framing: 'accomplishment',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('derivePerspectivesFromBullet returns CONFLICT for concurrent derivation', async () => {
    const srcId = seedSource(db)
    const bullet = BulletRepository.create(db, {
      content: 'Approved bullet',
      source_content_snapshot: 'snapshot',
      technologies: [],
      metrics: null,
      status: 'approved',
      source_ids: [{ id: srcId, is_primary: true }],
    })

    // Simulate in-memory lock
    derivingBullets.add(bullet.id)

    const result = await service.derivePerspectivesFromBullet(bullet.id, {
      archetype: 'agentic-ai',
      domain: 'ai_ml',
      framing: 'accomplishment',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CONFLICT')
  })

  // ── recoverStaleLocks ─────────────────────────────────────────────

  test('recoverStaleLocks resets stale deriving sources', () => {
    // Create a source stuck in 'deriving' with old timestamp
    const srcId = seedSource(db, { status: 'approved' })
    const oldTimestamp = new Date(Date.now() - 600_000).toISOString()
    db.run(
      "UPDATE sources SET status = 'deriving', updated_at = ? WHERE id = ?",
      [oldTimestamp, srcId],
    )

    const count = DerivationService.recoverStaleLocks(db)
    expect(count).toBe(1)

    const source = db.query('SELECT status FROM sources WHERE id = ?').get(srcId) as { status: string }
    expect(source.status).toBe('draft')
  })

  test('recoverStaleLocks does not reset recent deriving sources', () => {
    const srcId = seedSource(db, { status: 'approved' })
    db.run(
      "UPDATE sources SET status = 'deriving', updated_at = ? WHERE id = ?",
      [new Date().toISOString(), srcId],
    )

    const count = DerivationService.recoverStaleLocks(db)
    expect(count).toBe(0)
  })
})
