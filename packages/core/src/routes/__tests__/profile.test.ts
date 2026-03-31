import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createTestApp, apiRequest, type TestContext } from './helpers'
import { seedProfile } from '../../db/__tests__/helpers'

describe('Profile routes', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  // -- GET /profile ---------------------------------------------------------

  test('GET /profile returns the profile', async () => {
    const res = await apiRequest(ctx.app, 'GET', '/profile')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(body.data.id).toHaveLength(36)
    expect(body.data.name).toBe('User')
    expect(body.data.created_at).toBeDefined()
    expect(body.data.updated_at).toBeDefined()
  })

  test('GET /profile returns seeded profile data', async () => {
    seedProfile(ctx.db, { name: 'Adam', email: 'adam@test.com', clearance: 'TS/SCI' })
    const res = await apiRequest(ctx.app, 'GET', '/profile')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('Adam')
    expect(body.data.email).toBe('adam@test.com')
    expect(body.data.clearance).toBe('TS/SCI')
  })

  // -- PATCH /profile -------------------------------------------------------

  test('PATCH /profile updates provided fields', async () => {
    const res = await apiRequest(ctx.app, 'PATCH', '/profile', {
      name: 'Adam',
      email: 'adam@example.com',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('Adam')
    expect(body.data.email).toBe('adam@example.com')
  })

  test('PATCH /profile with empty name returns 400', async () => {
    const res = await apiRequest(ctx.app, 'PATCH', '/profile', { name: '' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  test('PATCH /profile with whitespace-only name returns 400', async () => {
    const res = await apiRequest(ctx.app, 'PATCH', '/profile', { name: '   ' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  test('PATCH /profile with empty body returns 200 unchanged', async () => {
    const getRes = await apiRequest(ctx.app, 'GET', '/profile')
    const before = (await getRes.json()).data

    const res = await apiRequest(ctx.app, 'PATCH', '/profile', {})
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe(before.name)
  })

  test('PATCH /profile updates all fields at once', async () => {
    const res = await apiRequest(ctx.app, 'PATCH', '/profile', {
      name: 'Adam',
      email: 'adam@example.com',
      phone: '+1-555-0123',
      location: 'Washington, DC',
      linkedin: 'linkedin.com/in/adam',
      github: 'github.com/adam',
      website: 'adam.dev',
      clearance: 'TS/SCI with CI Polygraph - Active',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('Adam')
    expect(body.data.email).toBe('adam@example.com')
    expect(body.data.phone).toBe('+1-555-0123')
    expect(body.data.location).toBe('Washington, DC')
    expect(body.data.linkedin).toBe('linkedin.com/in/adam')
    expect(body.data.github).toBe('github.com/adam')
    expect(body.data.website).toBe('adam.dev')
    expect(body.data.clearance).toBe('TS/SCI with CI Polygraph - Active')
  })

  test('PATCH /profile refreshes updated_at', async () => {
    const getRes = await apiRequest(ctx.app, 'GET', '/profile')
    const before = (await getRes.json()).data

    const res = await apiRequest(ctx.app, 'PATCH', '/profile', { name: 'Updated' })
    const body = await res.json()
    expect(body.data.updated_at >= before.updated_at).toBe(true)
  })

  test('PATCH /profile ignores unknown fields', async () => {
    const res = await apiRequest(ctx.app, 'PATCH', '/profile', {
      name: 'Safe',
      evil_field: 'should be ignored',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('Safe')
    expect(body.data.evil_field).toBeUndefined()
  })

  // -- Contract shape -------------------------------------------------------

  test('GET /profile follows { data: entity } contract', async () => {
    const res = await apiRequest(ctx.app, 'GET', '/profile')
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(body).not.toHaveProperty('error')
    expect(body).not.toHaveProperty('pagination')
    expect(body.data).toHaveProperty('id')
    expect(body.data).toHaveProperty('name')
    expect(body.data).toHaveProperty('created_at')
    expect(body.data).toHaveProperty('updated_at')
  })
})
