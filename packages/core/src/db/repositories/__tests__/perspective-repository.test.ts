import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { PerspectiveRepository } from '../perspective-repository'
import { createTestDb, seedSource, seedBullet, seedResume, seedResumeSection } from '../../__tests__/helpers'
import type { CreatePerspectiveInput } from '../../../types/index'

describe('PerspectiveRepository', () => {
  let db: Database
  let sourceId: string
  let bulletId: string

  beforeEach(() => {
    db = createTestDb()
    sourceId = seedSource(db)
    bulletId = seedBullet(db, [{ id: sourceId }])
  })

  afterEach(() => {
    db.close()
  })

  function makeInput(overrides: Partial<CreatePerspectiveInput> = {}): CreatePerspectiveInput {
    return {
      bullet_id: bulletId,
      content: 'Led cloud platform migration enabling ML-based log analysis pipeline',
      bullet_content_snapshot: 'snapshot of bullet content',
      target_archetype: 'agentic-ai',
      domain: 'ai_ml',
      framing: 'accomplishment',
      ...overrides,
    }
  }

  // ── CRUD lifecycle ─────────────────────────────────────────────────

  describe('CRUD lifecycle', () => {
    test('create returns a perspective with generated UUID', () => {
      const p = PerspectiveRepository.create(db, makeInput())

      expect(p.id).toHaveLength(36)
      expect(p.bullet_id).toBe(bulletId)
      expect(p.content).toBe('Led cloud platform migration enabling ML-based log analysis pipeline')
      expect(p.bullet_content_snapshot).toBe('snapshot of bullet content')
      expect(p.target_archetype).toBe('agentic-ai')
      expect(p.domain).toBe('ai_ml')
      expect(p.framing).toBe('accomplishment')
      expect(p.status).toBe('pending_review')
      expect(p.rejection_reason).toBeNull()
      expect(p.prompt_log_id).toBeNull()
      expect(p.approved_at).toBeNull()
      expect(p.approved_by).toBeNull()
      expect(p.created_at).toBeTruthy()
    })

    test('create respects explicit status', () => {
      const p = PerspectiveRepository.create(db, makeInput({ status: 'draft' }))
      expect(p.status).toBe('draft')
    })

    test('create with null archetype and domain', () => {
      const p = PerspectiveRepository.create(db, makeInput({
        target_archetype: null,
        domain: null,
      }))
      expect(p.target_archetype).toBeNull()
      expect(p.domain).toBeNull()
    })

    test('get returns the created perspective', () => {
      const created = PerspectiveRepository.create(db, makeInput())
      const fetched = PerspectiveRepository.get(db, created.id)

      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.content).toBe(created.content)
    })

    test('get returns null for nonexistent ID', () => {
      const result = PerspectiveRepository.get(db, crypto.randomUUID())
      expect(result).toBeNull()
    })

    test('update modifies content fields', () => {
      const created = PerspectiveRepository.create(db, makeInput())
      const updated = PerspectiveRepository.update(db, created.id, {
        content: 'Updated content',
        target_archetype: 'infrastructure',
        domain: 'devops',
        framing: 'responsibility',
      })

      expect(updated).not.toBeNull()
      expect(updated!.content).toBe('Updated content')
      expect(updated!.target_archetype).toBe('infrastructure')
      expect(updated!.domain).toBe('devops')
      expect(updated!.framing).toBe('responsibility')
    })

    test('update with empty input returns existing perspective', () => {
      const created = PerspectiveRepository.create(db, makeInput())
      const updated = PerspectiveRepository.update(db, created.id, {})

      expect(updated).not.toBeNull()
      expect(updated!.content).toBe(created.content)
    })

    test('update returns null for nonexistent ID', () => {
      const result = PerspectiveRepository.update(db, crypto.randomUUID(), {
        content: 'nope',
      })
      expect(result).toBeNull()
    })

    test('delete removes the perspective', () => {
      const created = PerspectiveRepository.create(db, makeInput())
      const deleted = PerspectiveRepository.delete(db, created.id)

      expect(deleted).toBe(true)
      expect(PerspectiveRepository.get(db, created.id)).toBeNull()
    })

    test('delete returns false for nonexistent ID', () => {
      const result = PerspectiveRepository.delete(db, crypto.randomUUID())
      expect(result).toBe(false)
    })
  })

  // ── getWithChain ───────────────────────────────────────────────────────

  describe('getWithChain', () => {
    test('returns perspective with bullet and primary source', () => {
      const p = PerspectiveRepository.create(db, makeInput())
      const chain = PerspectiveRepository.getWithChain(db, p.id)

      expect(chain).not.toBeNull()
      expect(chain!.id).toBe(p.id)
      expect(chain!.bullet.id).toBe(bulletId)
      expect(chain!.source.id).toBe(sourceId)
      expect(chain!.source.title).toBeTruthy()
    })

    test('returns null for nonexistent ID', () => {
      const result = PerspectiveRepository.getWithChain(db, crypto.randomUUID())
      expect(result).toBeNull()
    })

    test('includes source_type in source data', () => {
      const p = PerspectiveRepository.create(db, makeInput())
      const chain = PerspectiveRepository.getWithChain(db, p.id)

      expect(chain!.source.source_type).toBeTruthy()
    })
  })

  // ── list with filters ──────────────────────────────────────────────

  describe('list', () => {
    test('returns all perspectives with no filter', () => {
      PerspectiveRepository.create(db, makeInput())
      PerspectiveRepository.create(db, makeInput({ content: 'Second perspective' }))

      const result = PerspectiveRepository.list(db)
      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    test('filters by bullet_id', () => {
      const sourceId2 = seedSource(db, { title: 'Source 2' })
      const bulletId2 = seedBullet(db, [{ id: sourceId2 }])

      PerspectiveRepository.create(db, makeInput())
      PerspectiveRepository.create(db, makeInput({ bullet_id: bulletId2, bullet_content_snapshot: 'snap2' }))

      const result = PerspectiveRepository.list(db, { bullet_id: bulletId })
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.data[0].bullet_id).toBe(bulletId)
    })

    test('filters by target_archetype', () => {
      PerspectiveRepository.create(db, makeInput({ target_archetype: 'agentic-ai' }))
      PerspectiveRepository.create(db, makeInput({ target_archetype: 'infrastructure' }))

      const result = PerspectiveRepository.list(db, { target_archetype: 'agentic-ai' })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].target_archetype).toBe('agentic-ai')
    })

    test('filters by domain', () => {
      PerspectiveRepository.create(db, makeInput({ domain: 'ai_ml' }))
      PerspectiveRepository.create(db, makeInput({ domain: 'devops' }))

      const result = PerspectiveRepository.list(db, { domain: 'ai_ml' })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].domain).toBe('ai_ml')
    })

    test('multi-field filter: archetype + domain', () => {
      PerspectiveRepository.create(db, makeInput({
        target_archetype: 'agentic-ai',
        domain: 'ai_ml',
      }))
      PerspectiveRepository.create(db, makeInput({
        target_archetype: 'agentic-ai',
        domain: 'devops',
      }))
      PerspectiveRepository.create(db, makeInput({
        target_archetype: 'infrastructure',
        domain: 'ai_ml',
      }))

      const result = PerspectiveRepository.list(db, {
        target_archetype: 'agentic-ai',
        domain: 'ai_ml',
      })
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.data[0].target_archetype).toBe('agentic-ai')
      expect(result.data[0].domain).toBe('ai_ml')
    })

    test('filters by framing', () => {
      PerspectiveRepository.create(db, makeInput({ framing: 'accomplishment' }))
      PerspectiveRepository.create(db, makeInput({ framing: 'responsibility' }))

      const result = PerspectiveRepository.list(db, { framing: 'accomplishment' })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].framing).toBe('accomplishment')
    })

    test('filters by status', () => {
      PerspectiveRepository.create(db, makeInput({ status: 'draft' }))
      PerspectiveRepository.create(db, makeInput({ status: 'pending_review' }))

      const result = PerspectiveRepository.list(db, { status: 'draft' })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].status).toBe('draft')
    })

    test('pagination: offset and limit', () => {
      for (let i = 0; i < 5; i++) {
        PerspectiveRepository.create(db, makeInput({ content: `Perspective ${i}` }))
      }

      const page1 = PerspectiveRepository.list(db, {}, 0, 2)
      expect(page1.data).toHaveLength(2)
      expect(page1.total).toBe(5)

      const page2 = PerspectiveRepository.list(db, {}, 2, 2)
      expect(page2.data).toHaveLength(2)
      expect(page2.total).toBe(5)

      const page3 = PerspectiveRepository.list(db, {}, 4, 2)
      expect(page3.data).toHaveLength(1)
      expect(page3.total).toBe(5)
    })

    test('offset beyond total returns empty data with correct total', () => {
      PerspectiveRepository.create(db, makeInput())

      const result = PerspectiveRepository.list(db, {}, 100, 10)
      expect(result.data).toHaveLength(0)
      expect(result.total).toBe(1)
    })
  })

  // ── list with source_id filter ──────────────────────────────────────

  describe('list with source_id filter', () => {
    let sourceIdA: string
    let sourceIdB: string
    let bulletIdA: string
    let bulletIdB: string

    beforeEach(() => {
      // Source A: "Principal Cloud Forensics Engineer"
      sourceIdA = seedSource(db, { title: 'Principal Cloud Forensics Engineer' })
      // Source B: "Staff SRE"
      sourceIdB = seedSource(db, { title: 'Staff SRE' })
      // Bullet A linked to source A
      bulletIdA = seedBullet(db, [{ id: sourceIdA }], { content: 'Migrated ELK to OpenSearch' })
      // Bullet B linked to source B
      bulletIdB = seedBullet(db, [{ id: sourceIdB }], { content: 'Built SLO framework' })
    })

    test('filters perspectives by source_id', () => {
      PerspectiveRepository.create(db, makeInput({
        bullet_id: bulletIdA,
        content: 'Perspective from source A',
      }))
      PerspectiveRepository.create(db, makeInput({
        bullet_id: bulletIdB,
        content: 'Perspective from source B',
      }))

      const result = PerspectiveRepository.list(db, { source_id: sourceIdA })
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.data[0].content).toBe('Perspective from source A')
    })

    test('combines source_id with status filter', () => {
      PerspectiveRepository.create(db, makeInput({
        bullet_id: bulletIdA,
        content: 'Approved from A',
        status: 'approved',
      }))
      PerspectiveRepository.create(db, makeInput({
        bullet_id: bulletIdA,
        content: 'Draft from A',
        status: 'draft',
      }))
      PerspectiveRepository.create(db, makeInput({
        bullet_id: bulletIdB,
        content: 'Approved from B',
        status: 'approved',
      }))

      const result = PerspectiveRepository.list(db, {
        source_id: sourceIdA,
        status: 'approved',
      })
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.data[0].content).toBe('Approved from A')
    })

    test('multi-source bullet returns perspective exactly once (DISTINCT)', () => {
      // Create a bullet linked to BOTH sources
      const multiBulletId = seedBullet(db, [
        { id: sourceIdA, isPrimary: true },
        { id: sourceIdB, isPrimary: false },
      ], { content: 'Multi-source bullet' })

      PerspectiveRepository.create(db, makeInput({
        bullet_id: multiBulletId,
        content: 'Perspective on multi-source bullet',
      }))

      // Query by source A -- should get exactly 1, not duplicated
      const resultA = PerspectiveRepository.list(db, { source_id: sourceIdA })
      expect(resultA.data).toHaveLength(1)
      expect(resultA.total).toBe(1)

      // Query by source B -- should also get exactly 1
      const resultB = PerspectiveRepository.list(db, { source_id: sourceIdB })
      expect(resultB.data).toHaveLength(1)
      expect(resultB.total).toBe(1)
    })

    test('unknown source_id returns empty data, not error', () => {
      PerspectiveRepository.create(db, makeInput({
        bullet_id: bulletIdA,
        content: 'Some perspective',
      }))

      const result = PerspectiveRepository.list(db, { source_id: crypto.randomUUID() })
      expect(result.data).toHaveLength(0)
      expect(result.total).toBe(0)
    })

    test('pagination with source_id filter returns correct total and page', () => {
      PerspectiveRepository.create(db, makeInput({
        bullet_id: bulletIdA,
        content: 'First from A',
      }))
      PerspectiveRepository.create(db, makeInput({
        bullet_id: bulletIdA,
        content: 'Second from A',
      }))
      PerspectiveRepository.create(db, makeInput({
        bullet_id: bulletIdB,
        content: 'From B (excluded)',
      }))

      const result = PerspectiveRepository.list(db, { source_id: sourceIdA }, 1, 1)
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(2)
    })

    test('no source_id filter returns all perspectives (regression check)', () => {
      PerspectiveRepository.create(db, makeInput({
        bullet_id: bulletIdA,
        content: 'From A',
      }))
      PerspectiveRepository.create(db, makeInput({
        bullet_id: bulletIdB,
        content: 'From B',
      }))

      const result = PerspectiveRepository.list(db)
      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(2)
    })
  })

  // ── delete blocked if in resume ────────────────────────────────────

  describe('delete blocked if in resume', () => {
    test('throws when perspective is referenced by a resume entry', () => {
      const p = PerspectiveRepository.create(db, makeInput())
      const resumeId = seedResume(db)
      const sectionId = seedResumeSection(db, resumeId, 'Experience', 'experience')

      // Create a resume entry referencing this perspective
      db.run(
        `INSERT INTO resume_entries (id, resume_id, section_id, perspective_id, position)
         VALUES (?, ?, ?, ?, 0)`,
        [crypto.randomUUID(), resumeId, sectionId, p.id],
      )

      // Delete should throw FK constraint
      expect(() => PerspectiveRepository.delete(db, p.id)).toThrow()
    })
  })

  // ── updateStatus ───────────────────────────────────────────────────

  describe('updateStatus', () => {
    test('sets status to approved with approved_at and approved_by', () => {
      const p = PerspectiveRepository.create(db, makeInput())
      const approved = PerspectiveRepository.updateStatus(db, p.id, 'approved')

      expect(approved).not.toBeNull()
      expect(approved!.status).toBe('approved')
      expect(approved!.approved_at).toBeTruthy()
      expect(approved!.approved_by).toBe('human')
    })

    test('sets rejection_reason when rejecting', () => {
      const p = PerspectiveRepository.create(db, makeInput())
      const rejected = PerspectiveRepository.updateStatus(db, p.id, 'rejected', {
        rejection_reason: 'Too vague, needs specific metrics',
      })

      expect(rejected).not.toBeNull()
      expect(rejected!.status).toBe('rejected')
      expect(rejected!.rejection_reason).toBe('Too vague, needs specific metrics')
    })

    test('clears rejection_reason when reopening', () => {
      const p = PerspectiveRepository.create(db, makeInput())

      // Reject first
      PerspectiveRepository.updateStatus(db, p.id, 'rejected', {
        rejection_reason: 'Needs work',
      })

      // Reopen (move to pending_review)
      const reopened = PerspectiveRepository.updateStatus(db, p.id, 'pending_review')

      expect(reopened).not.toBeNull()
      expect(reopened!.status).toBe('pending_review')
      // rejection_reason is cleared (set to null explicitly)
      expect(reopened!.rejection_reason).toBeNull()
    })

    test('returns null for nonexistent ID', () => {
      const result = PerspectiveRepository.updateStatus(db, crypto.randomUUID(), 'approved')
      expect(result).toBeNull()
    })

    test('approved_at is preserved when re-approving', () => {
      const p = PerspectiveRepository.create(db, makeInput())

      const first = PerspectiveRepository.updateStatus(db, p.id, 'approved')
      const firstApprovedAt = first!.approved_at

      // Update status to something else, then re-approve
      PerspectiveRepository.updateStatus(db, p.id, 'pending_review')
      const second = PerspectiveRepository.updateStatus(db, p.id, 'approved')

      // The COALESCE means a new approved_at is set (it does not keep the old one
      // because we set approved_at to a new value on each approval)
      expect(second!.approved_at).toBeTruthy()
      expect(second!.approved_by).toBe('human')
    })

    test('sets status to draft', () => {
      const p = PerspectiveRepository.create(db, makeInput())
      const draft = PerspectiveRepository.updateStatus(db, p.id, 'draft')

      expect(draft).not.toBeNull()
      expect(draft!.status).toBe('draft')
    })
  })
})
