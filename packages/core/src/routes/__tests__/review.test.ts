import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestApp, apiRequest, type TestContext } from './helpers'
import { seedSource, seedBullet, seedPerspective } from '../../db/__tests__/helpers'

describe('Review Routes', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  test('GET /review/pending returns 200 with empty queue', async () => {
    const res = await apiRequest(ctx.app, 'GET', '/review/pending')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(body.data.bullets.count).toBe(0)
    expect(body.data.bullets.items).toEqual([])
    expect(body.data.perspectives.count).toBe(0)
    expect(body.data.perspectives.items).toEqual([])
  })

  test('GET /review/pending returns 200 with pending items', async () => {
    const sourceId = seedSource(ctx.db, { title: 'Review Source' })
    seedBullet(ctx.db, [{ id: sourceId }], {
      status: 'in_review',
      content: 'Pending bullet',
    })

    const bulletId2 = seedBullet(ctx.db, [{ id: sourceId }], {
      status: 'approved',
      content: 'Approved bullet (not pending)',
    })
    seedPerspective(ctx.db, bulletId2, {
      status: 'in_review',
      content: 'Pending perspective',
    })

    const res = await apiRequest(ctx.app, 'GET', '/review/pending')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.bullets.count).toBe(1)
    expect(body.data.bullets.items[0].content).toBe('Pending bullet')
    expect(body.data.bullets.items[0].source_title).toBe('Review Source')
    expect(body.data.perspectives.count).toBe(1)
    expect(body.data.perspectives.items[0].content).toBe('Pending perspective')
    expect(body.data.perspectives.items[0].source_title).toBe('Review Source')
  })
})
