/**
 * Route-level tests for /api/archetypes.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createTestApp, apiRequest, type TestContext } from './helpers'
import {
  seedArchetype,
  seedDomain,
  seedArchetypeDomain,
  seedSource,
  seedBullet,
  seedPerspective,
  seedResume,
} from '../../db/__tests__/helpers'

describe('Archetype routes', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  // -- POST /archetypes -----------------------------------------------------

  test('POST /archetypes with valid body returns 201', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/archetypes', {
      name: 'new-archetype',
      description: 'A test archetype',
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe('new-archetype')
    expect(body.data.description).toBe('A test archetype')
    expect(body.data.id).toHaveLength(36)
  })

  test('POST /archetypes with empty name returns 400', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/archetypes', { name: '' })
    expect(res.status).toBe(400)
  })

  test('POST /archetypes with duplicate name returns 409', async () => {
    await apiRequest(ctx.app, 'POST', '/archetypes', { name: 'dup-test' })
    const res = await apiRequest(ctx.app, 'POST', '/archetypes', { name: 'dup-test' })
    expect(res.status).toBe(409)
  })

  // -- GET /archetypes ------------------------------------------------------

  test('GET /archetypes returns array with pagination', async () => {
    const res = await apiRequest(ctx.app, 'GET', '/archetypes')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeArray()
    expect(body.pagination).toBeDefined()
  })

  test('GET /archetypes items include usage counts', async () => {
    const res = await apiRequest(ctx.app, 'GET', '/archetypes')
    const body = await res.json()
    if (body.data.length > 0) {
      expect(typeof body.data[0].resume_count).toBe('number')
      expect(typeof body.data[0].perspective_count).toBe('number')
      expect(typeof body.data[0].domain_count).toBe('number')
    }
  })

  // -- GET /archetypes/:id --------------------------------------------------

  test('GET /archetypes/:id returns archetype with domains array', async () => {
    const archId = seedArchetype(ctx.db, { name: 'get-detail' })
    const domId = seedDomain(ctx.db, { name: 'detail_dom' })
    seedArchetypeDomain(ctx.db, archId, domId)

    const res = await apiRequest(ctx.app, 'GET', `/archetypes/${archId}`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('get-detail')
    expect(body.data.domains).toBeArray()
    expect(body.data.domains).toHaveLength(1)
    expect(body.data.domains[0].name).toBe('detail_dom')
  })

  test('GET /archetypes/:id with invalid id returns 404', async () => {
    const res = await apiRequest(ctx.app, 'GET', '/archetypes/nonexistent')
    expect(res.status).toBe(404)
  })

  // -- PATCH /archetypes/:id ------------------------------------------------

  test('PATCH /archetypes/:id updates archetype', async () => {
    const archId = seedArchetype(ctx.db, { name: 'patch-test' })
    const res = await apiRequest(ctx.app, 'PATCH', `/archetypes/${archId}`, {
      description: 'Updated desc',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.description).toBe('Updated desc')
  })

  // -- DELETE /archetypes/:id -----------------------------------------------

  test('DELETE /archetypes/:id with no references returns 204', async () => {
    const archId = seedArchetype(ctx.db, { name: 'delete-ok' })
    const res = await apiRequest(ctx.app, 'DELETE', `/archetypes/${archId}`)
    expect(res.status).toBe(204)
  })

  test('DELETE /archetypes/:id with resume references returns 409', async () => {
    const archId = seedArchetype(ctx.db, { name: 'resume-block' })
    seedResume(ctx.db, { archetype: 'resume-block' })

    const res = await apiRequest(ctx.app, 'DELETE', `/archetypes/${archId}`)
    expect(res.status).toBe(409)
  })

  test('DELETE /archetypes/:id with perspective references returns 409', async () => {
    const archId = seedArchetype(ctx.db, { name: 'persp-block' })
    const sourceId = seedSource(ctx.db)
    const bulletId = seedBullet(ctx.db, [{ id: sourceId }])
    seedPerspective(ctx.db, bulletId, { archetype: 'persp-block' })

    const res = await apiRequest(ctx.app, 'DELETE', `/archetypes/${archId}`)
    expect(res.status).toBe(409)
  })

  // -- Domain association routes --------------------------------------------

  test('GET /archetypes/:id/domains returns domain list', async () => {
    const archId = seedArchetype(ctx.db, { name: 'list-dom' })
    const domId = seedDomain(ctx.db, { name: 'listed_dom' })
    seedArchetypeDomain(ctx.db, archId, domId)

    const res = await apiRequest(ctx.app, 'GET', `/archetypes/${archId}/domains`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeArray()
    expect(body.data).toHaveLength(1)
  })

  test('POST /archetypes/:id/domains with valid domain_id returns 201', async () => {
    const archId = seedArchetype(ctx.db, { name: 'add-dom' })
    const domId = seedDomain(ctx.db, { name: 'added_dom' })

    const res = await apiRequest(ctx.app, 'POST', `/archetypes/${archId}/domains`, {
      domain_id: domId,
    })
    expect(res.status).toBe(201)
  })

  test('POST /archetypes/:id/domains duplicate returns 409', async () => {
    const archId = seedArchetype(ctx.db, { name: 'dup-dom' })
    const domId = seedDomain(ctx.db, { name: 'duped_dom' })

    await apiRequest(ctx.app, 'POST', `/archetypes/${archId}/domains`, { domain_id: domId })
    const res = await apiRequest(ctx.app, 'POST', `/archetypes/${archId}/domains`, { domain_id: domId })
    expect(res.status).toBe(409)
  })

  test('DELETE /archetypes/:id/domains/:domainId returns 204', async () => {
    const archId = seedArchetype(ctx.db, { name: 'rm-dom' })
    const domId = seedDomain(ctx.db, { name: 'rmd_dom' })
    seedArchetypeDomain(ctx.db, archId, domId)

    const res = await apiRequest(ctx.app, 'DELETE', `/archetypes/${archId}/domains/${domId}`)
    expect(res.status).toBe(204)
  })

  test('DELETE /archetypes/:id/domains/:domainId nonexistent returns 404', async () => {
    const archId = seedArchetype(ctx.db, { name: 'no-rm-dom' })
    const res = await apiRequest(ctx.app, 'DELETE', `/archetypes/${archId}/domains/nonexistent`)
    expect(res.status).toBe(404)
  })
})
