import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { BulletService } from '../bullet-service'
import { createTestDb, seedSource, seedBullet, seedPerspective } from '../../db/__tests__/helpers'

describe('BulletService', () => {
  let db: Database
  let service: BulletService

  beforeEach(() => {
    db = createTestDb()
    service = new BulletService(db)
  })

  afterEach(() => db.close())

  // ── getBullet ─────────────────────────────────────────────────────

  test('getBullet returns existing bullet', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])

    const result = service.getBullet(bulletId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.id).toBe(bulletId)
  })

  test('getBullet returns NOT_FOUND for missing ID', () => {
    const result = service.getBullet('nonexistent-id')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── listBullets ───────────────────────────────────────────────────

  test('listBullets returns all bullets', () => {
    const srcId = seedSource(db)
    seedBullet(db, [{ id: srcId }])
    seedBullet(db, [{ id: srcId }], { content: 'Second bullet' })

    const result = service.listBullets()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.length).toBe(2)
  })

  test('listBullets filters by source_id via junction', () => {
    const src1 = seedSource(db)
    const src2 = seedSource(db, { title: 'Source 2' })
    seedBullet(db, [{ id: src1 }])
    seedBullet(db, [{ id: src2 }])

    const result = service.listBullets({ source_id: src1 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.length).toBe(1)
  })

  test('listBullets filters by status', () => {
    const srcId = seedSource(db)
    seedBullet(db, [{ id: srcId }], { status: 'approved' })
    seedBullet(db, [{ id: srcId }], { status: 'draft' })

    const result = service.listBullets({ status: 'approved' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.length).toBe(1)
  })

  test('listBullets supports pagination', () => {
    const srcId = seedSource(db)
    for (let i = 0; i < 5; i++) {
      seedBullet(db, [{ id: srcId }], { content: `Bullet ${i}` })
    }

    const result = service.listBullets({}, 0, 2)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.length).toBe(2)
    expect(result.pagination.total).toBe(5)
  })

  // ── updateBullet ──────────────────────────────────────────────────

  test('updateBullet with valid content succeeds', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])

    const result = service.updateBullet(bulletId, { content: 'Updated content' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.content).toBe('Updated content')
  })

  test('updateBullet rejects empty content', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])

    const result = service.updateBullet(bulletId, { content: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('updateBullet returns NOT_FOUND for missing ID', () => {
    const result = service.updateBullet('nonexistent', { content: 'New' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── deleteBullet ──────────────────────────────────────────────────

  test('deleteBullet removes bullet', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])

    const result = service.deleteBullet(bulletId)
    expect(result.ok).toBe(true)

    const check = service.getBullet(bulletId)
    expect(check.ok).toBe(false)
  })

  test('deleteBullet returns NOT_FOUND for missing ID', () => {
    const result = service.deleteBullet('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  test('deleteBullet returns CONFLICT when bullet has perspectives', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }])
    seedPerspective(db, bulletId)

    const result = service.deleteBullet(bulletId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CONFLICT')
  })

  // ── Status transitions ────────────────────────────────────────────

  test('approveBullet transitions from in_review to approved', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }], { status: 'in_review' })

    const result = service.approveBullet(bulletId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.status).toBe('approved')
    expect(result.data.approved_at).not.toBeNull()
    expect(result.data.approved_by).toBe('human')
  })

  test('approveBullet rejects transition from draft', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }], { status: 'draft' })

    const result = service.approveBullet(bulletId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('draft')
  })

  test('rejectBullet transitions from in_review to rejected', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }], { status: 'in_review' })

    const result = service.rejectBullet(bulletId, 'Too vague')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.status).toBe('rejected')
    expect(result.data.rejection_reason).toBe('Too vague')
  })

  test('rejectBullet requires non-empty reason', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }], { status: 'in_review' })

    const result = service.rejectBullet(bulletId, '')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('reopenBullet transitions from rejected to in_review', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }], { status: 'in_review' })

    // First reject
    service.rejectBullet(bulletId, 'reason')

    // Then reopen
    const result = service.reopenBullet(bulletId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.status).toBe('in_review')
  })

  test('approveBullet returns NOT_FOUND for missing ID', () => {
    const result = service.approveBullet('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  // ── submitBullet ───────────────────────────────────────────────────

  test('submitBullet transitions draft to in_review', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }], { status: 'draft' })

    const result = service.submitBullet(bulletId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.status).toBe('in_review')
  })

  test('submitBullet rejects non-draft bullet (in_review)', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }], { status: 'in_review' })

    const result = service.submitBullet(bulletId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('Only draft bullets')
  })

  test('submitBullet rejects approved bullet', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }], { status: 'approved' })

    const result = service.submitBullet(bulletId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('submitBullet rejects rejected bullet', () => {
    const srcId = seedSource(db)
    const bulletId = seedBullet(db, [{ id: srcId }], { status: 'rejected' })

    const result = service.submitBullet(bulletId)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  test('submitBullet returns NOT_FOUND for missing ID', () => {
    const result = service.submitBullet('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })
})
