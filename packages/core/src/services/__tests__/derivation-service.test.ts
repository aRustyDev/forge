import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { createTestDb, seedSource } from '../../db/__tests__/helpers'
import { buildDefaultElm } from '../../storage/build-elm'
import { DerivationService } from '../derivation-service'
import type { PendingDerivation } from '../../types'

// ── helpers (replacing deleted repositories) ────────────────────────────────

function seedApprovedBullet(db: Database, sourceId: string) {
  const id = crypto.randomUUID()
  const row = db
    .query(
      `INSERT INTO bullets (id, content, source_content_snapshot, metrics, domain, status)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(id, 'Led 4-engineer team migrating cloud forensics platform', 'snapshot', '4-engineer team', null, 'approved') as any

  // Insert bullet_sources junction
  db.run(
    'INSERT INTO bullet_sources (bullet_id, source_id, is_primary) VALUES (?, ?, 1)',
    [id, sourceId],
  )

  // Link technologies
  for (const tech of ['aws', 'opensearch']) {
    const existing = db.query('SELECT id FROM skills WHERE LOWER(name) = LOWER(?)').get(tech) as { id: string } | null
    const skillId = existing?.id ?? (() => { const sid = crypto.randomUUID(); db.run('INSERT INTO skills (id, name, category) VALUES (?, ?, ?)', [sid, tech, 'other']); return sid })()
    db.run('INSERT INTO bullet_skills (bullet_id, skill_id) VALUES (?, ?)', [id, skillId])
  }

  return { ...row, id, technologies: ['aws', 'opensearch'] }
}

function seedBulletWithStatus(db: Database, sourceId: string, content: string, status: string) {
  const id = crypto.randomUUID()
  const row = db
    .query(
      `INSERT INTO bullets (id, content, source_content_snapshot, metrics, domain, status)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(id, content, 'snapshot', null, null, status) as any

  db.run(
    'INSERT INTO bullet_sources (bullet_id, source_id, is_primary) VALUES (?, ?, 1)',
    [id, sourceId],
  )
  return { ...row, id, technologies: [] }
}

function getPendingDerivation(db: Database, id: string): PendingDerivation | null {
  return db.query('SELECT * FROM pending_derivations WHERE id = ?').get(id) as PendingDerivation | null
}

function createPendingDerivation(db: Database, input: {
  entity_type: string; entity_id: string; client_id: string;
  prompt: string; snapshot: string; derivation_params: string | null; expires_at: string;
}): PendingDerivation {
  return db
    .query(
      `INSERT INTO pending_derivations (entity_type, entity_id, client_id, prompt, snapshot, derivation_params, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(input.entity_type, input.entity_id, input.client_id, input.prompt, input.snapshot, input.derivation_params, input.expires_at) as PendingDerivation
}

function getBulletSources(db: Database, bulletId: string) {
  return db
    .query(
      `SELECT s.id, s.title, bs.is_primary
       FROM bullet_sources bs JOIN sources s ON bs.source_id = s.id
       WHERE bs.bullet_id = ?
       ORDER BY bs.is_primary DESC, s.title ASC`,
    )
    .all(bulletId) as Array<{ id: string; title: string; is_primary: number }>
}

// ── DerivationService: prepareBulletDerivation ───────────────────────────────

describe('DerivationService', () => {
  let db: Database
  let service: DerivationService

  beforeEach(() => {
    db = createTestDb()
    service = new DerivationService(buildDefaultElm(db))
  })

  afterEach(() => db.close())

  // ── prepareBulletDerivation ─────────────────────────────────────────────

  describe('prepareBulletDerivation', () => {
    test('returns PrepareResult with derivation_id, prompt, snapshot for approved source', async () => {
      const srcId = seedSource(db, { status: 'approved', description: 'Led a cloud migration project.' })

      const result = await service.prepareBulletDerivation(srcId, 'client-1')
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.data.derivation_id).toBeTruthy()
      expect(typeof result.data.prompt).toBe('string')
      expect(result.data.prompt.length).toBeGreaterThan(0)
      expect(result.data.snapshot).toBe('Led a cloud migration project.')
      expect(result.data.instructions).toBeTruthy()
      expect(result.data.expires_at).toBeTruthy()
    })

    test('creates a pending_derivations row', async () => {
      const srcId = seedSource(db, { status: 'approved' })
      const result = await service.prepareBulletDerivation(srcId, 'client-1')
      expect(result.ok).toBe(true)
      if (!result.ok) return

      const row = getPendingDerivation(db,result.data.derivation_id)
      expect(row).not.toBeNull()
      expect(row!.entity_type).toBe('source')
      expect(row!.entity_id).toBe(srcId)
      expect(row!.client_id).toBe('client-1')
    })

    test('returns NOT_FOUND for missing source', async () => {
      const result = await service.prepareBulletDerivation('nonexistent', 'client-1')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('NOT_FOUND')
    })

    test('returns VALIDATION_ERROR for archived source', async () => {
      const srcId = seedSource(db, { status: 'archived' })
      const result = await service.prepareBulletDerivation(srcId, 'client-1')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('VALIDATION_ERROR')
      expect(result.error.message).toContain('archived')
    })

    test('returns CONFLICT when source already has a pending derivation', async () => {
      const srcId = seedSource(db, { status: 'approved' })
      const first = await service.prepareBulletDerivation(srcId, 'client-1')
      expect(first.ok).toBe(true)

      const second = await service.prepareBulletDerivation(srcId, 'client-2')
      expect(second.ok).toBe(false)
      if (second.ok) return
      expect(second.error.code).toBe('CONFLICT')
    })
  })

  // ── commitBulletDerivation ──────────────────────────────────────────────

  describe('commitBulletDerivation', () => {
    test('creates bullets and deletes pending row on success', async () => {
      const srcId = seedSource(db, { status: 'approved' })
      const prepare = await service.prepareBulletDerivation(srcId, 'client-1')
      expect(prepare.ok).toBe(true)
      if (!prepare.ok) return

      const commit = await service.commitBulletDerivation(prepare.data.derivation_id, {
        bullets: [
          { content: 'Led cloud migration', technologies: ['aws'], metrics: '4 engineers' },
        ],
      })
      expect(commit.ok).toBe(true)
      if (!commit.ok) return

      expect(commit.data).toHaveLength(1)
      expect(commit.data[0].content).toBe('Led cloud migration')
      expect(commit.data[0].status).toBe('in_review')

      // Verify bullet_sources junction row with is_primary=1
      const sources = getBulletSources(db,commit.data[0].id)
      expect(sources).toHaveLength(1)
      expect(sources[0].id).toBe(srcId)
      expect(sources[0].is_primary).toBe(1)

      // Pending row should be deleted
      const pending = getPendingDerivation(db,prepare.data.derivation_id)
      expect(pending).toBeNull()
    })

    test('creates multiple bullets from one commit', async () => {
      const srcId = seedSource(db, { status: 'approved' })
      const prepare = await service.prepareBulletDerivation(srcId, 'client-1')
      expect(prepare.ok).toBe(true)
      if (!prepare.ok) return

      const commit = await service.commitBulletDerivation(prepare.data.derivation_id, {
        bullets: [
          { content: 'Bullet one', technologies: ['go'], metrics: null },
          { content: 'Bullet two', technologies: ['rust'], metrics: '10x performance' },
        ],
      })
      expect(commit.ok).toBe(true)
      if (!commit.ok) return
      expect(commit.data).toHaveLength(2)
    })

    test('returns NOT_FOUND for missing derivation_id', async () => {
      const result = await service.commitBulletDerivation('nonexistent-id', {
        bullets: [{ content: 'x', technologies: [], metrics: null }],
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('NOT_FOUND')
    })

    test('returns GONE for expired derivation and deletes the row', async () => {
      const srcId = seedSource(db, { status: 'approved' })

      // Manually insert an expired pending derivation row
      const expiredAt = new Date(Date.now() - 60_000).toISOString()
      const row = createPendingDerivation(db, {
        entity_type: 'source',
        entity_id: srcId,
        client_id: 'client-1',
        prompt: 'test prompt',
        snapshot: 'test snapshot',
        derivation_params: null,
        expires_at: expiredAt,
      })

      const result = await service.commitBulletDerivation(row.id, {
        bullets: [{ content: 'x', technologies: [], metrics: null }],
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('GONE')

      // Row should be cleaned up
      const pending = getPendingDerivation(db,row.id)
      expect(pending).toBeNull()
    })

    test('returns VALIDATION_ERROR for empty bullets array', async () => {
      const srcId = seedSource(db, { status: 'approved' })
      const prepare = await service.prepareBulletDerivation(srcId, 'client-1')
      expect(prepare.ok).toBe(true)
      if (!prepare.ok) return

      const result = await service.commitBulletDerivation(prepare.data.derivation_id, {
        bullets: [],
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('VALIDATION_ERROR')
    })

    test('returns VALIDATION_ERROR for bullet with empty content', async () => {
      const srcId = seedSource(db, { status: 'approved' })
      const prepare = await service.prepareBulletDerivation(srcId, 'client-1')
      expect(prepare.ok).toBe(true)
      if (!prepare.ok) return

      const result = await service.commitBulletDerivation(prepare.data.derivation_id, {
        bullets: [{ content: '   ', technologies: [], metrics: null }],
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // ── preparePerspectiveDerivation ────────────────────────────────────────

  describe('preparePerspectiveDerivation', () => {
    test('returns PrepareResult for approved bullet', async () => {
      const srcId = seedSource(db)
      const bullet = seedApprovedBullet(db, srcId)

      const result = await service.preparePerspectiveDerivation(
        bullet.id,
        { archetype: 'agentic-ai', domain: 'ai_ml', framing: 'accomplishment' },
        'client-1',
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.data.derivation_id).toBeTruthy()
      expect(typeof result.data.prompt).toBe('string')
      expect(result.data.prompt.length).toBeGreaterThan(0)
      expect(result.data.snapshot).toBe(bullet.content)
      expect(result.data.instructions).toBeTruthy()
      expect(result.data.expires_at).toBeTruthy()
    })

    test('creates a pending_derivations row with derivation_params', async () => {
      const srcId = seedSource(db)
      const bullet = seedApprovedBullet(db, srcId)

      const result = await service.preparePerspectiveDerivation(
        bullet.id,
        { archetype: 'agentic-ai', domain: 'ai_ml', framing: 'accomplishment' },
        'client-1',
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return

      const row = getPendingDerivation(db,result.data.derivation_id)
      expect(row).not.toBeNull()
      expect(row!.entity_type).toBe('bullet')
      expect(row!.entity_id).toBe(bullet.id)
      expect(row!.derivation_params).toBeTruthy()

      const params = JSON.parse(row!.derivation_params!)
      expect(params.archetype).toBe('agentic-ai')
      expect(params.domain).toBe('ai_ml')
      expect(params.framing).toBe('accomplishment')
    })

    test('returns NOT_FOUND for missing bullet', async () => {
      const result = await service.preparePerspectiveDerivation(
        'nonexistent',
        { archetype: 'agentic-ai', domain: 'ai_ml', framing: 'accomplishment' },
        'client-1',
      )
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('NOT_FOUND')
    })

    test('returns VALIDATION_ERROR for non-approved bullet', async () => {
      const srcId = seedSource(db)
      const bullet = seedBulletWithStatus(db, srcId, 'Draft bullet', 'draft')

      const result = await service.preparePerspectiveDerivation(
        bullet.id,
        { archetype: 'agentic-ai', domain: 'ai_ml', framing: 'accomplishment' },
        'client-1',
      )
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('VALIDATION_ERROR')
      expect(result.error.message).toContain('approved')
    })

    test('returns VALIDATION_ERROR for archived bullet', async () => {
      const srcId = seedSource(db)
      const bullet = seedBulletWithStatus(db, srcId, 'Archived bullet', 'archived')

      const result = await service.preparePerspectiveDerivation(
        bullet.id,
        { archetype: 'agentic-ai', domain: 'ai_ml', framing: 'accomplishment' },
        'client-1',
      )
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('VALIDATION_ERROR')
      expect(result.error.message).toContain('archived')
    })

    test('returns CONFLICT when bullet already has a pending derivation', async () => {
      const srcId = seedSource(db)
      const bullet = seedApprovedBullet(db, srcId)

      const first = await service.preparePerspectiveDerivation(
        bullet.id,
        { archetype: 'agentic-ai', domain: 'ai_ml', framing: 'accomplishment' },
        'client-1',
      )
      expect(first.ok).toBe(true)

      const second = await service.preparePerspectiveDerivation(
        bullet.id,
        { archetype: 'agentic-ai', domain: 'ai_ml', framing: 'accomplishment' },
        'client-2',
      )
      expect(second.ok).toBe(false)
      if (second.ok) return
      expect(second.error.code).toBe('CONFLICT')
    })

    test('returns VALIDATION_ERROR for unknown archetype', async () => {
      const srcId = seedSource(db)
      const bullet = seedApprovedBullet(db, srcId)

      const result = await service.preparePerspectiveDerivation(
        bullet.id,
        { archetype: 'unknown-archetype', domain: 'ai_ml', framing: 'accomplishment' },
        'client-1',
      )
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('VALIDATION_ERROR')
      expect(result.error.message).toContain('archetype')
    })

    test('returns VALIDATION_ERROR for unknown domain', async () => {
      const srcId = seedSource(db)
      const bullet = seedApprovedBullet(db, srcId)

      const result = await service.preparePerspectiveDerivation(
        bullet.id,
        { archetype: 'agentic-ai', domain: 'unknown-domain', framing: 'accomplishment' },
        'client-1',
      )
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('VALIDATION_ERROR')
      expect(result.error.message).toContain('domain')
    })
  })

  // ── commitPerspectiveDerivation ─────────────────────────────────────────

  describe('commitPerspectiveDerivation', () => {
    test('creates perspective and deletes pending row on success', async () => {
      const srcId = seedSource(db)
      const bullet = seedApprovedBullet(db, srcId)

      const prepare = await service.preparePerspectiveDerivation(
        bullet.id,
        { archetype: 'agentic-ai', domain: 'ai_ml', framing: 'accomplishment' },
        'client-1',
      )
      expect(prepare.ok).toBe(true)
      if (!prepare.ok) return

      const commit = await service.commitPerspectiveDerivation(prepare.data.derivation_id, {
        content: 'Reframed perspective content',
        reasoning: 'Focus on AI impact',
      })
      expect(commit.ok).toBe(true)
      if (!commit.ok) return

      expect(commit.data.content).toBe('Reframed perspective content')
      expect(commit.data.status).toBe('in_review')
      expect(commit.data.bullet_id).toBe(bullet.id)
      expect(commit.data.target_archetype).toBe('agentic-ai')
      expect(commit.data.domain).toBe('ai_ml')
      expect(commit.data.framing).toBe('accomplishment')

      // Pending row should be deleted
      const pending = getPendingDerivation(db,prepare.data.derivation_id)
      expect(pending).toBeNull()
    })

    test('returns NOT_FOUND for missing derivation_id', async () => {
      const result = await service.commitPerspectiveDerivation('nonexistent-id', {
        content: 'x',
        reasoning: 'y',
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('NOT_FOUND')
    })

    test('returns GONE for expired derivation and deletes the row', async () => {
      const srcId = seedSource(db)
      const bullet = seedApprovedBullet(db, srcId)

      const expiredAt = new Date(Date.now() - 60_000).toISOString()
      const row = createPendingDerivation(db, {
        entity_type: 'bullet',
        entity_id: bullet.id,
        client_id: 'client-1',
        prompt: 'test prompt',
        snapshot: 'test snapshot',
        derivation_params: JSON.stringify({ archetype: 'agentic-ai', domain: 'ai_ml', framing: 'accomplishment' }),
        expires_at: expiredAt,
      })

      const result = await service.commitPerspectiveDerivation(row.id, {
        content: 'x',
        reasoning: 'y',
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('GONE')

      // Row should be cleaned up
      const pending = getPendingDerivation(db,row.id)
      expect(pending).toBeNull()
    })

    test('returns VALIDATION_ERROR for empty content', async () => {
      const srcId = seedSource(db)
      const bullet = seedApprovedBullet(db, srcId)

      const prepare = await service.preparePerspectiveDerivation(
        bullet.id,
        { archetype: 'agentic-ai', domain: 'ai_ml', framing: 'accomplishment' },
        'client-1',
      )
      expect(prepare.ok).toBe(true)
      if (!prepare.ok) return

      const result = await service.commitPerspectiveDerivation(prepare.data.derivation_id, {
        content: '   ',
        reasoning: 'some reasoning',
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('VALIDATION_ERROR')
    })

    test('returns VALIDATION_ERROR when entity_type is source (not bullet)', async () => {
      const srcId = seedSource(db, { status: 'approved' })

      // Create a pending derivation for a source, not a bullet
      const futureAt = new Date(Date.now() + 120_000).toISOString()
      const row = createPendingDerivation(db, {
        entity_type: 'source',
        entity_id: srcId,
        client_id: 'client-1',
        prompt: 'test prompt',
        snapshot: 'test snapshot',
        derivation_params: null,
        expires_at: futureAt,
      })

      const result = await service.commitPerspectiveDerivation(row.id, {
        content: 'some content',
        reasoning: 'some reasoning',
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // ── recoverStaleLocks ────────────────────────────────────────────────────

  describe('recoverStaleLocks', () => {
    test('deletes expired pending_derivations rows', async () => {
      const srcId = seedSource(db, { status: 'approved' })
      const expiredAt = new Date(Date.now() - 60_000).toISOString()

      createPendingDerivation(db, {
        entity_type: 'source',
        entity_id: srcId,
        client_id: 'client-1',
        prompt: 'prompt',
        snapshot: 'snapshot',
        derivation_params: null,
        expires_at: expiredAt,
      })

      const count = await DerivationService.recoverStaleLocks(db)
      expect(count).toBeGreaterThanOrEqual(1)

      // The expired row should be gone
      const rows = db
        .query('SELECT * FROM pending_derivations WHERE entity_id = ?')
        .all(srcId)
      expect(rows).toHaveLength(0)
    })

    test('does not delete non-expired pending_derivations rows', async () => {
      const srcId = seedSource(db, { status: 'approved' })
      const futureAt = new Date(Date.now() + 120_000).toISOString()

      createPendingDerivation(db, {
        entity_type: 'source',
        entity_id: srcId,
        client_id: 'client-1',
        prompt: 'prompt',
        snapshot: 'snapshot',
        derivation_params: null,
        expires_at: futureAt,
      })

      const count = await DerivationService.recoverStaleLocks(db)
      expect(count).toBe(0)

      const rows = db
        .query('SELECT * FROM pending_derivations WHERE entity_id = ?')
        .all(srcId)
      expect(rows).toHaveLength(1)
    })

    test('still resets stale deriving sources for backward compat', async () => {
      // Old lock mechanism: source stuck in 'deriving' status
      const srcId = seedSource(db, { status: 'approved' })
      const oldTimestamp = new Date(Date.now() - 600_000).toISOString()
      db.run(
        "UPDATE sources SET status = 'deriving', updated_at = ? WHERE id = ?",
        [oldTimestamp, srcId],
      )

      await DerivationService.recoverStaleLocks(db)

      const source = db.query('SELECT status FROM sources WHERE id = ?').get(srcId) as { status: string }
      expect(source.status).toBe('draft')
    })
  })
})
