import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestApp, apiRequest, type TestContext } from './helpers'

describe('Supporting Routes (Skills)', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  test('POST /skills creates a skill and returns 201', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/skills', {
      name: 'TypeScript',
      category: 'language',
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(body.data.id).toHaveLength(36)
    expect(body.data.name).toBe('TypeScript')
    expect(body.data.category).toBe('language')
  })

  test('POST /skills with empty name returns 400', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/skills', {
      name: '',
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  test('GET /skills returns 200 with all skills', async () => {
    // Create some skills first
    await apiRequest(ctx.app, 'POST', '/skills', { name: 'Python', category: 'language' })
    await apiRequest(ctx.app, 'POST', '/skills', { name: 'Docker', category: 'tool' })

    const res = await apiRequest(ctx.app, 'GET', '/skills')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeArray()
    expect(body.data.length).toBe(2)
  })

  test('GET /skills?category=language filters by category', async () => {
    await apiRequest(ctx.app, 'POST', '/skills', { name: 'Python', category: 'language' })
    await apiRequest(ctx.app, 'POST', '/skills', { name: 'Docker', category: 'tool' })

    const res = await apiRequest(ctx.app, 'GET', '/skills?category=language')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.length).toBe(1)
    expect(body.data[0].name).toBe('Python')
  })
})
