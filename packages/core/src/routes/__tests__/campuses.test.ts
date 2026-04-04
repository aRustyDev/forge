/**
 * Tests for Campus routes — PATCH /campuses/:id
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createTestApp, apiRequest, type TestContext } from './helpers'
import * as OrgRepo from '../../db/repositories/organization-repository'
import * as CampusRepo from '../../db/repositories/campus-repository'

describe('Campus routes', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  // -- PATCH /campuses/:id ---------------------------------------------------

  test('PATCH /campuses/:id updates provided fields and returns 200', async () => {
    const org = OrgRepo.create(ctx.db, { name: 'Test Org' })
    const campus = CampusRepo.create(ctx.db, {
      organization_id: org.id,
      name: 'Main Campus',
      modality: 'in_person',
      city: 'Portland',
      state: 'OR',
    })

    const res = await apiRequest(ctx.app, 'PATCH', `/campuses/${campus.id}`, {
      name: 'Online Campus',
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('Online Campus')
    // Unchanged fields
    expect(body.data.modality).toBe('in_person')
    expect(body.data.city).toBe('Portland')
    expect(body.data.state).toBe('OR')
  })

  test('PATCH /campuses/:id with nonexistent ID returns 404', async () => {
    const res = await apiRequest(ctx.app, 'PATCH', '/campuses/nonexistent', {
      name: 'New Name',
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  test('PATCH /campuses/:id with partial body updates only specified fields', async () => {
    const org = OrgRepo.create(ctx.db, { name: 'Test Org' })
    const campus = CampusRepo.create(ctx.db, {
      organization_id: org.id,
      name: 'Main Campus',
      modality: 'in_person',
      city: 'Portland',
      state: 'OR',
    })

    const res = await apiRequest(ctx.app, 'PATCH', `/campuses/${campus.id}`, {
      city: 'Austin',
      state: 'TX',
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('Main Campus')
    expect(body.data.city).toBe('Austin')
    expect(body.data.state).toBe('TX')
  })

  test('PATCH /campuses/:id converts is_headquarters boolean to integer', async () => {
    const org = OrgRepo.create(ctx.db, { name: 'Test Org' })
    const campus = CampusRepo.create(ctx.db, {
      organization_id: org.id,
      name: 'Main Campus',
      modality: 'in_person',
    })

    const res = await apiRequest(ctx.app, 'PATCH', `/campuses/${campus.id}`, {
      is_headquarters: true,
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.is_headquarters).toBe(1)
  })

  test('PATCH /campuses/:id with is_headquarters false stores as 0', async () => {
    const org = OrgRepo.create(ctx.db, { name: 'Test Org' })
    const campus = CampusRepo.create(ctx.db, {
      organization_id: org.id,
      name: 'HQ',
      modality: 'in_person',
      is_headquarters: 1,
    })

    const res = await apiRequest(ctx.app, 'PATCH', `/campuses/${campus.id}`, {
      is_headquarters: false,
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.is_headquarters).toBe(0)
  })
})
