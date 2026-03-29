import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { BulletRepository } from '../bullet-repository'
import type { CreateBulletInput } from '../bullet-repository'
import { createTestDb, seedSource, seedBullet, seedPerspective } from '../../__tests__/helpers'

describe('BulletRepository', () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.close()
  })

  /** Convenience: create a source and return its ID */
  function source(): string {
    return seedSource(db)
  }

  /** Convenience: default create input */
  function defaultInput(sourceId: string): CreateBulletInput {
    return {
      source_id: sourceId,
      content: 'Led 4-engineer team migrating cloud forensics platform from ELK to AWS OpenSearch',
      source_content_snapshot: 'Full source description snapshot',
      technologies: ['Kubernetes', 'AWS', 'OpenSearch'],
      metrics: '40% reduction in query latency',
    }
  }

  // ── CRUD lifecycle ───────────────────────────────────────────────

  describe('CRUD lifecycle', () => {
    test('create returns bullet with generated UUID and correct fields', () => {
      const srcId = source()
      const bullet = BulletRepository.create(db, defaultInput(srcId))

      expect(bullet.id).toHaveLength(36)
      expect(bullet.source_id).toBe(srcId)
      expect(bullet.content).toBe(defaultInput(srcId).content)
      expect(bullet.source_content_snapshot).toBe('Full source description snapshot')
      expect(bullet.metrics).toBe('40% reduction in query latency')
      expect(bullet.status).toBe('pending_review')
      expect(bullet.rejection_reason).toBeNull()
      expect(bullet.approved_at).toBeNull()
      expect(bullet.approved_by).toBeNull()
      expect(bullet.created_at).toBeTruthy()
    })

    test('create respects explicit status', () => {
      const srcId = source()
      const input = { ...defaultInput(srcId), status: 'draft' }
      const bullet = BulletRepository.create(db, input)

      expect(bullet.status).toBe('draft')
    })

    test('get retrieves created bullet', () => {
      const srcId = source()
      const created = BulletRepository.create(db, defaultInput(srcId))
      const fetched = BulletRepository.get(db, created.id)

      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.content).toBe(created.content)
    })

    test('get returns null for nonexistent ID', () => {
      const result = BulletRepository.get(db, crypto.randomUUID())
      expect(result).toBeNull()
    })

    test('update modifies content', () => {
      const srcId = source()
      const created = BulletRepository.create(db, defaultInput(srcId))

      const updated = BulletRepository.update(db, created.id, {
        content: 'Updated content',
      })

      expect(updated).not.toBeNull()
      expect(updated!.content).toBe('Updated content')
      expect(updated!.metrics).toBe(created.metrics)
    })

    test('update modifies metrics', () => {
      const srcId = source()
      const created = BulletRepository.create(db, defaultInput(srcId))

      const updated = BulletRepository.update(db, created.id, {
        metrics: '60% improvement',
      })

      expect(updated).not.toBeNull()
      expect(updated!.metrics).toBe('60% improvement')
    })

    test('update can set metrics to null', () => {
      const srcId = source()
      const created = BulletRepository.create(db, defaultInput(srcId))

      const updated = BulletRepository.update(db, created.id, {
        metrics: null,
      })

      expect(updated).not.toBeNull()
      expect(updated!.metrics).toBeNull()
    })

    test('update returns null for nonexistent ID', () => {
      const result = BulletRepository.update(db, crypto.randomUUID(), {
        content: 'nope',
      })
      expect(result).toBeNull()
    })

    test('delete removes bullet', () => {
      const srcId = source()
      const created = BulletRepository.create(db, defaultInput(srcId))

      const deleted = BulletRepository.delete(db, created.id)
      expect(deleted).toBe(true)

      const fetched = BulletRepository.get(db, created.id)
      expect(fetched).toBeNull()
    })

    test('delete returns false for nonexistent ID', () => {
      const result = BulletRepository.delete(db, crypto.randomUUID())
      expect(result).toBe(false)
    })
  })

  // ── Technology junction ──────────────────────────────────────────

  describe('technology junction', () => {
    test('create inserts technologies into junction table', () => {
      const srcId = source()
      const bullet = BulletRepository.create(db, defaultInput(srcId))

      expect(bullet.technologies).toHaveLength(3)
      // Normalized to lowercase
      expect(bullet.technologies).toContain('kubernetes')
      expect(bullet.technologies).toContain('aws')
      expect(bullet.technologies).toContain('opensearch')
    })

    test('get returns technologies array from junction table', () => {
      const srcId = source()
      const created = BulletRepository.create(db, defaultInput(srcId))
      const fetched = BulletRepository.get(db, created.id)

      expect(fetched!.technologies).toHaveLength(3)
      expect(fetched!.technologies).toContain('kubernetes')
    })

    test('technologies are normalized: lowercase and trimmed', () => {
      const srcId = source()
      const bullet = BulletRepository.create(db, {
        ...defaultInput(srcId),
        technologies: ['Kubernetes', 'kubernetes', ' kubernetes '],
      })

      // All three forms resolve to the same normalized value — but the
      // junction table has a composite PK (bullet_id, technology) so
      // duplicates are rejected. The insert helper inserts sequentially,
      // so only the first succeeds; the duplicate UNIQUE violations need
      // to be handled. Let's verify there's exactly 1 unique entry.
      expect(bullet.technologies).toHaveLength(1)
      expect(bullet.technologies[0]).toBe('kubernetes')
    })

    test('create with empty technologies array', () => {
      const srcId = source()
      const bullet = BulletRepository.create(db, {
        ...defaultInput(srcId),
        technologies: [],
      })

      expect(bullet.technologies).toHaveLength(0)
    })
  })

  // ── Technology filter ────────────────────────────────────────────

  describe('technology filter', () => {
    test('list by technology returns matching bullets', () => {
      const srcId = source()

      BulletRepository.create(db, {
        ...defaultInput(srcId),
        content: 'Bullet with K8s',
        technologies: ['kubernetes', 'docker'],
      })

      BulletRepository.create(db, {
        ...defaultInput(srcId),
        content: 'Bullet with Python',
        technologies: ['python', 'fastapi'],
      })

      BulletRepository.create(db, {
        ...defaultInput(srcId),
        content: 'Another K8s bullet',
        technologies: ['kubernetes', 'helm'],
      })

      const result = BulletRepository.list(db, { technology: 'kubernetes' })

      expect(result.total).toBe(2)
      expect(result.data).toHaveLength(2)
      expect(result.data.every(b => b.technologies.includes('kubernetes'))).toBe(true)
    })

    test('technology filter is case-insensitive via normalization', () => {
      const srcId = source()

      BulletRepository.create(db, {
        ...defaultInput(srcId),
        technologies: ['Terraform'],
      })

      // Filter with different case — the filter normalizes too
      const result = BulletRepository.list(db, { technology: 'TERRAFORM' })
      expect(result.total).toBe(1)
    })

    test('combined filters: source_id + technology', () => {
      const srcId1 = source()
      const srcId2 = source()

      BulletRepository.create(db, {
        ...defaultInput(srcId1),
        technologies: ['kubernetes'],
      })

      BulletRepository.create(db, {
        ...defaultInput(srcId2),
        technologies: ['kubernetes'],
      })

      const result = BulletRepository.list(db, {
        source_id: srcId1,
        technology: 'kubernetes',
      })

      expect(result.total).toBe(1)
    })
  })

  // ── List pagination ──────────────────────────────────────────────

  describe('list pagination', () => {
    test('list respects limit and offset', () => {
      const srcId = source()
      for (let i = 0; i < 5; i++) {
        BulletRepository.create(db, {
          ...defaultInput(srcId),
          content: `Bullet ${i}`,
        })
      }

      const page1 = BulletRepository.list(db, {}, 0, 2)
      expect(page1.data).toHaveLength(2)
      expect(page1.total).toBe(5)

      const page2 = BulletRepository.list(db, {}, 2, 2)
      expect(page2.data).toHaveLength(2)
      expect(page2.total).toBe(5)

      const page3 = BulletRepository.list(db, {}, 4, 2)
      expect(page3.data).toHaveLength(1)
      expect(page3.total).toBe(5)
    })

    test('offset >= total returns empty data with correct total', () => {
      const srcId = source()
      BulletRepository.create(db, defaultInput(srcId))
      BulletRepository.create(db, {
        ...defaultInput(srcId),
        content: 'Second bullet',
      })

      const result = BulletRepository.list(db, {}, 100, 10)
      expect(result.data).toHaveLength(0)
      expect(result.total).toBe(2)
    })

    test('list with status filter', () => {
      const srcId = source()
      BulletRepository.create(db, {
        ...defaultInput(srcId),
        status: 'draft',
      })
      BulletRepository.create(db, {
        ...defaultInput(srcId),
        status: 'pending_review',
        content: 'Another bullet',
      })

      const result = BulletRepository.list(db, { status: 'draft' })
      expect(result.total).toBe(1)
      expect(result.data[0].status).toBe('draft')
    })

    test('list with source_id filter', () => {
      const srcId1 = source()
      const srcId2 = source()

      BulletRepository.create(db, defaultInput(srcId1))
      BulletRepository.create(db, defaultInput(srcId2))

      const result = BulletRepository.list(db, { source_id: srcId1 })
      expect(result.total).toBe(1)
      expect(result.data[0].source_id).toBe(srcId1)
    })
  })

  // ── Delete constraints ───────────────────────────────────────────

  describe('delete constraints', () => {
    test('delete throws when bullet has perspectives (FK RESTRICT)', () => {
      const srcId = source()
      const bulletId = seedBullet(db, srcId, {
        technologies: ['kubernetes'],
      })
      seedPerspective(db, bulletId)

      expect(() => BulletRepository.delete(db, bulletId)).toThrow()
    })

    test('delete cascades bullet_technologies', () => {
      const srcId = source()
      const bullet = BulletRepository.create(db, defaultInput(srcId))

      // Verify technologies exist
      const techsBefore = db
        .query('SELECT * FROM bullet_technologies WHERE bullet_id = ?')
        .all(bullet.id)
      expect(techsBefore.length).toBeGreaterThan(0)

      // Delete and verify cascade
      BulletRepository.delete(db, bullet.id)

      const techsAfter = db
        .query('SELECT * FROM bullet_technologies WHERE bullet_id = ?')
        .all(bullet.id)
      expect(techsAfter).toHaveLength(0)
    })
  })

  // ── updateStatus ─────────────────────────────────────────────────

  describe('updateStatus', () => {
    test('sets approved_at and approved_by when approving', () => {
      const srcId = source()
      const bullet = BulletRepository.create(db, defaultInput(srcId))

      const approved = BulletRepository.updateStatus(db, bullet.id, 'approved')

      expect(approved).not.toBeNull()
      expect(approved!.status).toBe('approved')
      expect(approved!.approved_at).toBeTruthy()
      expect(approved!.approved_by).toBe('human')
    })

    test('sets rejection_reason when rejecting', () => {
      const srcId = source()
      const bullet = BulletRepository.create(db, defaultInput(srcId))

      const rejected = BulletRepository.updateStatus(db, bullet.id, 'rejected', {
        rejection_reason: 'Too vague',
      })

      expect(rejected).not.toBeNull()
      expect(rejected!.status).toBe('rejected')
      expect(rejected!.rejection_reason).toBe('Too vague')
    })

    test('rejection without reason sets null rejection_reason', () => {
      const srcId = source()
      const bullet = BulletRepository.create(db, defaultInput(srcId))

      const rejected = BulletRepository.updateStatus(db, bullet.id, 'rejected')

      expect(rejected).not.toBeNull()
      expect(rejected!.status).toBe('rejected')
      expect(rejected!.rejection_reason).toBeNull()
    })

    test('status can be set to pending_review', () => {
      const srcId = source()
      const bullet = BulletRepository.create(db, {
        ...defaultInput(srcId),
        status: 'draft',
      })

      const updated = BulletRepository.updateStatus(db, bullet.id, 'pending_review')

      expect(updated).not.toBeNull()
      expect(updated!.status).toBe('pending_review')
    })

    test('status can be set to draft', () => {
      const srcId = source()
      const bullet = BulletRepository.create(db, defaultInput(srcId))

      const updated = BulletRepository.updateStatus(db, bullet.id, 'draft')

      expect(updated).not.toBeNull()
      expect(updated!.status).toBe('draft')
    })

    test('returns null for nonexistent bullet', () => {
      const result = BulletRepository.updateStatus(db, crypto.randomUUID(), 'approved')
      expect(result).toBeNull()
    })

    test('preserves technologies array on status update', () => {
      const srcId = source()
      const bullet = BulletRepository.create(db, defaultInput(srcId))

      const approved = BulletRepository.updateStatus(db, bullet.id, 'approved')

      expect(approved!.technologies).toHaveLength(3)
      expect(approved!.technologies).toContain('kubernetes')
    })
  })
})
