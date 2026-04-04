import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestApp, apiRequest, type TestContext } from './helpers'
import { seedSource, seedBullet, seedPerspective } from '../../db/__tests__/helpers'

describe('Bullet Routes', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  // ── GET /bullets ───────────────────────────────────────────────────

  test('GET /bullets returns 200 with pagination', async () => {
    const sourceId = seedSource(ctx.db)
    seedBullet(ctx.db, [{ id: sourceId }], { content: 'Bullet A' })
    seedBullet(ctx.db, [{ id: sourceId }], { content: 'Bullet B' })

    const res = await apiRequest(ctx.app, 'GET', '/bullets')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeArray()
    expect(body.data.length).toBe(2)
    expect(body.pagination).toBeDefined()
    expect(body.pagination.total).toBe(2)
  })

  test('GET /bullets?status=approved filters by status', async () => {
    const sourceId = seedSource(ctx.db)
    seedBullet(ctx.db, [{ id: sourceId }], { status: 'approved' })
    seedBullet(ctx.db, [{ id: sourceId }], { status: 'pending_review' })

    const res = await apiRequest(ctx.app, 'GET', '/bullets?status=approved')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.length).toBe(1)
    expect(body.data[0].status).toBe('approved')
  })

  // ── GET /bullets/:id ──────────────────────────────────────────────

  test('GET /bullets/:id returns 200', async () => {
    const sourceId = seedSource(ctx.db)
    const bulletId = seedBullet(ctx.db, [{ id: sourceId }])

    const res = await apiRequest(ctx.app, 'GET', `/bullets/${bulletId}`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe(bulletId)
  })

  // ── PATCH /bullets/:id/approve ────────────────────────────────────

  test('PATCH /bullets/:id/approve from pending_review returns 200', async () => {
    const sourceId = seedSource(ctx.db)
    const bulletId = seedBullet(ctx.db, [{ id: sourceId }], { status: 'pending_review' })

    const res = await apiRequest(ctx.app, 'PATCH', `/bullets/${bulletId}/approve`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('approved')
  })

  test('PATCH /bullets/:id/approve from draft returns 400', async () => {
    const sourceId = seedSource(ctx.db)
    const bulletId = seedBullet(ctx.db, [{ id: sourceId }], { status: 'draft' })

    const res = await apiRequest(ctx.app, 'PATCH', `/bullets/${bulletId}/approve`)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toContain('Cannot transition')
  })

  // ── PATCH /bullets/:id/reject ─────────────────────────────────────

  test('PATCH /bullets/:id/reject with reason returns 200', async () => {
    const sourceId = seedSource(ctx.db)
    const bulletId = seedBullet(ctx.db, [{ id: sourceId }], { status: 'pending_review' })

    const res = await apiRequest(ctx.app, 'PATCH', `/bullets/${bulletId}/reject`, {
      rejection_reason: 'Too vague',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('rejected')
  })

  test('PATCH /bullets/:id/reject without reason returns 400', async () => {
    const sourceId = seedSource(ctx.db)
    const bulletId = seedBullet(ctx.db, [{ id: sourceId }], { status: 'pending_review' })

    const res = await apiRequest(ctx.app, 'PATCH', `/bullets/${bulletId}/reject`, {
      rejection_reason: '',
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  // ── PATCH /bullets/:id/reopen ─────────────────────────────────────

  test('PATCH /bullets/:id/reopen from rejected returns 200', async () => {
    const sourceId = seedSource(ctx.db)
    const bulletId = seedBullet(ctx.db, [{ id: sourceId }], { status: 'rejected' })

    const res = await apiRequest(ctx.app, 'PATCH', `/bullets/${bulletId}/reopen`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('pending_review')
  })

  // ── DELETE /bullets/:id ───────────────────────────────────────────

  test('DELETE /bullets/:id returns 204', async () => {
    const sourceId = seedSource(ctx.db)
    const bulletId = seedBullet(ctx.db, [{ id: sourceId }])

    const res = await apiRequest(ctx.app, 'DELETE', `/bullets/${bulletId}`)
    expect(res.status).toBe(204)
  })

  test('DELETE /bullets/:id with perspectives returns 409', async () => {
    const sourceId = seedSource(ctx.db)
    const bulletId = seedBullet(ctx.db, [{ id: sourceId }])
    seedPerspective(ctx.db, bulletId)

    const res = await apiRequest(ctx.app, 'DELETE', `/bullets/${bulletId}`)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICT')
  })
})
