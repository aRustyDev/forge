import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { PerspectiveService } from '../perspective-service'
import { createTestDb, seedSource, seedBullet, seedPerspective, seedResume, seedResumeEntry, seedResumeSection } from '../../db/__tests__/helpers'

describe('PerspectiveService', () => {
  let db: Database
  let service: PerspectiveService

  beforeEach(() => {
    db = createTestDb()
    service = new PerspectiveService(db)
  })

  afterEach(() => db.close())

  // ── getPerspective ────────────────────────────────────────────────

  test('getPerspective returns existing perspective', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId)

    const result = service.getPerspective(perspId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.id).toBe(perspId)
  })

  test('getPerspective returns NOT_FOUND for missing ID', () => {
    const result = service.getPerspective('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── getPerspectiveWithChain ───────────────────────────────────────

  test('getPerspectiveWithChain returns full chain', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId)

    const result = service.getPerspectiveWithChain(perspId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.id).toBe(perspId)
    expect(result.data.bullet.id).toBe(bulletId)
    expect(result.data.source.id).toBe(srcId)
  })

  test('getPerspectiveWithChain returns NOT_FOUND for missing ID', () => {
    const result = service.getPerspectiveWithChain('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── listPerspectives ──────────────────────────────────────────────

  test('listPerspectives returns all perspectives', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    seedPerspective(db, bulletId)
    seedPerspective(db, bulletId, { domain: 'security' })

    const result = service.listPerspectives()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.length).toBe(2)
  })

  test('listPerspectives filters by bullet_id', () => {
    const srcId = seedSource(db)
    const b1 = seedBullet(db, [{ id: srcId }])
    const b2 = seedBullet(db, [{ id: srcId }], { content: 'Other bullet' })
    seedPerspective(db, b1)
    seedPerspective(db, b2)

    const result = service.listPerspectives({ bullet_id: b1 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.length).toBe(1)
  })

  test('listPerspectives filters by archetype and status', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    seedPerspective(db, bulletId, { archetype: 'agentic-ai', status: 'approved' })
    seedPerspective(db, bulletId, { archetype: 'infrastructure', status: 'approved' })
    seedPerspective(db, bulletId, { archetype: 'agentic-ai', status: 'draft' })

    const result = service.listPerspectives({ target_archetype: 'agentic-ai', status: 'approved' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.length).toBe(1)
  })

  // ── updatePerspective ─────────────────────────────────────────────

  test('updatePerspective with valid content succeeds', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId)

    const result = service.updatePerspective(perspId, { content: 'Updated perspective' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.content).toBe('Updated perspective')
  })

  test('updatePerspective rejects empty content', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId)

    const result = service.updatePerspective(perspId, { content: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('updatePerspective returns NOT_FOUND for missing ID', () => {
    const result = service.updatePerspective('nonexistent', { content: 'New' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── deletePerspective ─────────────────────────────────────────────

  test('deletePerspective removes perspective', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId)

    const result = service.deletePerspective(perspId)
    expect(result.ok).toBe(true)

    const check = service.getPerspective(perspId)
    expect(check.ok).toBe(false)
  })

  test('deletePerspective returns NOT_FOUND for missing ID', () => {
    const result = service.deletePerspective('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('deletePerspective returns CONFLICT when in a resume', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId)
    const resumeId = seedResume(db)
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience')
    seedResumeEntry(db, secId, { perspectiveId: perspId })

    const result = service.deletePerspective(perspId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CONFLICT')
  })

  // ── Status transitions ────────────────────────────────────────────

  test('approvePerspective transitions from pending_review to approved', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId, { status: 'pending_review' })

    const result = service.approvePerspective(perspId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.status).toBe('approved')
    expect(result.data.approved_at).not.toBeNull()
    expect(result.data.approved_by).toBe('human')
  })

  test('approvePerspective rejects transition from draft', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId, { status: 'draft' })

    const result = service.approvePerspective(perspId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('rejectPerspective transitions from pending_review to rejected', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId, { status: 'pending_review' })

    const result = service.rejectPerspective(perspId, 'Does not match domain')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.status).toBe('rejected')
    expect(result.data.rejection_reason).toBe('Does not match domain')
  })

  test('rejectPerspective requires non-empty reason', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId, { status: 'pending_review' })

    const result = service.rejectPerspective(perspId, '')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('reopenPerspective transitions from rejected to pending_review', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    const perspId = seedPerspective(db, bulletId, { status: 'pending_review' })

    // First reject
    service.rejectPerspective(perspId, 'reason')

    // Then reopen
    const result = service.reopenPerspective(perspId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.status).toBe('pending_review')
  })

  test('approvePerspective returns NOT_FOUND for missing ID', () => {
    const result = service.approvePerspective('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })
})
