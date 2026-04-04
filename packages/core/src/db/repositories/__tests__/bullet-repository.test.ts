import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { BulletRepository } from '../bullet-repository'
import { createTestDb, seedSource, seedBullet } from '../../__tests__/helpers'

describe('BulletRepository', () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.close()
  })

  // ── create ──────────────────────────────────────────────────────────

  describe('create', () => {
    test('creates bullet without source_ids', () => {
      const bullet = BulletRepository.create(db, {
        content: 'Test bullet',
        source_content_snapshot: 'snapshot',
        technologies: ['typescript'],
        metrics: null,
      })

      expect(bullet.id).toHaveLength(36)
      expect(bullet.content).toBe('Test bullet')
      expect(bullet.source_content_snapshot).toBe('snapshot')
      expect(bullet.domain).toBeNull()
      expect(bullet.notes).toBeNull()
      expect(bullet.status).toBe('pending_review')
      expect(bullet.technologies).toEqual(['typescript'])

      const sources = BulletRepository.getSources(db, bullet.id)
      expect(sources).toHaveLength(0)
    })

    test('creates bullet with source_ids and junction rows', () => {
      const srcId = seedSource(db)
      const bullet = BulletRepository.create(db, {
        content: 'Test bullet',
        source_content_snapshot: 'snapshot',
        technologies: [],
        metrics: null,
        source_ids: [{ id: srcId, is_primary: true }],
      })

      const sources = BulletRepository.getSources(db, bullet.id)
      expect(sources).toHaveLength(1)
      expect(sources[0].is_primary).toBe(1)
    })

    test('creates bullet with multiple sources', () => {
      const src1 = seedSource(db, { title: 'Primary' })
      const src2 = seedSource(db, { title: 'Secondary' })

      const bullet = BulletRepository.create(db, {
        content: 'Multi-source bullet',
        source_content_snapshot: 'snapshot',
        technologies: [],
        metrics: null,
        source_ids: [
          { id: src1, is_primary: true },
          { id: src2, is_primary: false },
        ],
      })

      const sources = BulletRepository.getSources(db, bullet.id)
      expect(sources).toHaveLength(2)
      const primaries = sources.filter(s => s.is_primary === 1)
      expect(primaries).toHaveLength(1)
      expect(primaries[0].title).toBe('Primary')
    })

    test('creates bullet with domain', () => {
      const bullet = BulletRepository.create(db, {
        content: 'AI bullet',
        source_content_snapshot: 'snapshot',
        technologies: [],
        metrics: null,
        domain: 'ai_ml',
      })

      expect(bullet.domain).toBe('ai_ml')
    })

    test('respects explicit status', () => {
      const bullet = BulletRepository.create(db, {
        content: 'Draft bullet',
        source_content_snapshot: 'snapshot',
        technologies: [],
        metrics: null,
        status: 'draft',
      })

      expect(bullet.status).toBe('draft')
    })

    test('normalizes technologies to lowercase', () => {
      const bullet = BulletRepository.create(db, {
        content: 'Test',
        source_content_snapshot: 'snapshot',
        technologies: ['TypeScript', 'REACT', '  docker  '],
        metrics: null,
      })

      expect(bullet.technologies).toEqual(['docker', 'react', 'typescript'])
    })
  })

  // ── get ─────────────────────────────────────────────────────────────

  describe('get', () => {
    test('returns bullet with technologies', () => {
      const created = BulletRepository.create(db, {
        content: 'Test',
        source_content_snapshot: 'snap',
        technologies: ['ts'],
        metrics: '4x faster',
      })

      const fetched = BulletRepository.get(db, created.id)
      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.technologies).toEqual(['ts'])
      expect(fetched!.metrics).toBe('4x faster')
    })

    test('returns null for nonexistent ID', () => {
      const result = BulletRepository.get(db, crypto.randomUUID())
      expect(result).toBeNull()
    })
  })

  // ── list ────────────────────────────────────────────────────────────

  describe('list', () => {
    test('returns all bullets with no filter', () => {
      BulletRepository.create(db, {
        content: 'Bullet 1',
        source_content_snapshot: 'snap',
        technologies: [],
        metrics: null,
      })
      BulletRepository.create(db, {
        content: 'Bullet 2',
        source_content_snapshot: 'snap',
        technologies: [],
        metrics: null,
      })

      const result = BulletRepository.list(db)
      expect(result.total).toBe(2)
      expect(result.data).toHaveLength(2)
    })

    test('filters by source_id via junction', () => {
      const src1 = seedSource(db)
      const src2 = seedSource(db, { title: 'Source 2' })
      seedBullet(db, [{ id: src1 }])
      seedBullet(db, [{ id: src2 }])
      seedBullet(db, [{ id: src1 }, { id: src2, isPrimary: false }])

      const result = BulletRepository.list(db, { source_id: src1 })
      expect(result.total).toBe(2) // bullet 1 + bullet 3
    })

    test('filters by status', () => {
      seedBullet(db, [], { status: 'approved' })
      seedBullet(db, [], { status: 'draft' })

      const result = BulletRepository.list(db, { status: 'approved' })
      expect(result.total).toBe(1)
      expect(result.data[0].status).toBe('approved')
    })

    test('filters by domain', () => {
      seedBullet(db, [], { domain: 'ai_ml' })
      seedBullet(db, [], { domain: 'security' })

      const result = BulletRepository.list(db, { domain: 'ai_ml' })
      expect(result.total).toBe(1)
      expect(result.data[0].domain).toBe('ai_ml')
    })

    test('pagination works', () => {
      for (let i = 0; i < 5; i++) {
        seedBullet(db, [], { content: `Bullet ${i}` })
      }

      const page1 = BulletRepository.list(db, {}, 0, 2)
      expect(page1.data).toHaveLength(2)
      expect(page1.total).toBe(5)

      const page3 = BulletRepository.list(db, {}, 4, 2)
      expect(page3.data).toHaveLength(1)
    })
  })

  // ── update ──────────────────────────────────────────────────────────

  describe('update', () => {
    test('updates content', () => {
      const bullet = BulletRepository.create(db, {
        content: 'Original',
        source_content_snapshot: 'snap',
        technologies: [],
        metrics: null,
      })

      const updated = BulletRepository.update(db, bullet.id, {
        content: 'Updated content',
      })

      expect(updated).not.toBeNull()
      expect(updated!.content).toBe('Updated content')
    })

    test('updates metrics', () => {
      const bullet = BulletRepository.create(db, {
        content: 'Test',
        source_content_snapshot: 'snap',
        technologies: [],
        metrics: null,
      })

      const updated = BulletRepository.update(db, bullet.id, {
        metrics: '50% improvement',
      })

      expect(updated!.metrics).toBe('50% improvement')
    })

    test('empty input returns existing bullet', () => {
      const bullet = BulletRepository.create(db, {
        content: 'Test',
        source_content_snapshot: 'snap',
        technologies: [],
        metrics: null,
      })

      const result = BulletRepository.update(db, bullet.id, {})
      expect(result).not.toBeNull()
      expect(result!.content).toBe('Test')
    })

    test('returns null for nonexistent ID', () => {
      const result = BulletRepository.update(db, crypto.randomUUID(), {
        content: 'nope',
      })
      expect(result).toBeNull()
    })
  })

  // ── delete ──────────────────────────────────────────────────────────

  describe('delete', () => {
    test('deletes bullet and cascades junction rows', () => {
      const srcId = seedSource(db)
      const bullet = BulletRepository.create(db, {
        content: 'Test',
        source_content_snapshot: 'snap',
        technologies: ['ts'],
        metrics: null,
        source_ids: [{ id: srcId }],
      })

      const deleted = BulletRepository.delete(db, bullet.id)
      expect(deleted).toBe(true)
      expect(BulletRepository.get(db, bullet.id)).toBeNull()
      expect(BulletRepository.getSources(db, bullet.id)).toHaveLength(0)
    })

    test('returns false for nonexistent ID', () => {
      const result = BulletRepository.delete(db, crypto.randomUUID())
      expect(result).toBe(false)
    })
  })

  // ── updateStatus ────────────────────────────────────────────────────

  describe('updateStatus', () => {
    test('sets status to approved with approved_at and approved_by', () => {
      const bullet = BulletRepository.create(db, {
        content: 'Test',
        source_content_snapshot: 'snap',
        technologies: [],
        metrics: null,
      })

      const approved = BulletRepository.updateStatus(db, bullet.id, 'approved')
      expect(approved).not.toBeNull()
      expect(approved!.status).toBe('approved')
      expect(approved!.approved_at).toBeTruthy()
      expect(approved!.approved_by).toBe('human')
    })

    test('sets rejection_reason when rejecting', () => {
      const bullet = BulletRepository.create(db, {
        content: 'Test',
        source_content_snapshot: 'snap',
        technologies: [],
        metrics: null,
      })

      const rejected = BulletRepository.updateStatus(db, bullet.id, 'rejected', {
        rejection_reason: 'Too vague',
      })
      expect(rejected!.status).toBe('rejected')
      expect(rejected!.rejection_reason).toBe('Too vague')
    })

    test('returns null for nonexistent ID', () => {
      const result = BulletRepository.updateStatus(db, crypto.randomUUID(), 'approved')
      expect(result).toBeNull()
    })
  })

  // ── source association methods ──────────────────────────────────────

  describe('source associations', () => {
    test('getSources returns all associated sources', () => {
      const src1 = seedSource(db, { title: 'Alpha' })
      const src2 = seedSource(db, { title: 'Beta' })
      const bulletId = seedBullet(db, [
        { id: src1, isPrimary: true },
        { id: src2, isPrimary: false },
      ])

      const sources = BulletRepository.getSources(db, bulletId)
      expect(sources).toHaveLength(2)
      // Primary first, then by title
      expect(sources[0].is_primary).toBe(1)
    })

    test('getPrimarySource returns the primary source', () => {
      const src1 = seedSource(db, { title: 'Primary' })
      const src2 = seedSource(db, { title: 'Secondary' })
      const bulletId = seedBullet(db, [
        { id: src1, isPrimary: true },
        { id: src2, isPrimary: false },
      ])

      const primary = BulletRepository.getPrimarySource(db, bulletId)
      expect(primary).not.toBeNull()
      expect(primary!.title).toBe('Primary')
    })

    test('getPrimarySource returns null when no primary', () => {
      const bulletId = seedBullet(db)
      const result = BulletRepository.getPrimarySource(db, bulletId)
      expect(result).toBeNull()
    })

    test('addSource creates a junction row', () => {
      const srcId = seedSource(db)
      const bulletId = seedBullet(db)

      BulletRepository.addSource(db, bulletId, srcId, false)

      const sources = BulletRepository.getSources(db, bulletId)
      expect(sources).toHaveLength(1)
      expect(sources[0].is_primary).toBe(0)
    })

    test('addSource with isPrimary=true demotes existing primary', () => {
      const src1 = seedSource(db, { title: 'First Primary' })
      const src2 = seedSource(db, { title: 'New Primary' })
      const bulletId = seedBullet(db, [{ id: src1, isPrimary: true }])

      BulletRepository.addSource(db, bulletId, src2, true)

      const sources = BulletRepository.getSources(db, bulletId)
      const primaries = sources.filter(s => s.is_primary === 1)
      expect(primaries).toHaveLength(1)
      expect(primaries[0].title).toBe('New Primary')
    })

    test('removeSource deletes junction row', () => {
      const srcId = seedSource(db)
      const bulletId = seedBullet(db, [{ id: srcId }])

      const removed = BulletRepository.removeSource(db, bulletId, srcId)
      expect(removed).toBe(true)
      expect(BulletRepository.getSources(db, bulletId)).toHaveLength(0)
    })

    test('removeSource returns false if not found', () => {
      const bulletId = seedBullet(db)
      const result = BulletRepository.removeSource(db, bulletId, crypto.randomUUID())
      expect(result).toBe(false)
    })
  })
})
