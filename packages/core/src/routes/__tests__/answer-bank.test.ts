import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createTestApp, apiRequest, type TestContext } from './helpers'

describe('Answer bank routes', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  // -- GET /profile/answers ---------------------------------------------------

  test('GET /profile/answers returns empty array initially', async () => {
    const res = await apiRequest(ctx.app, 'GET', '/profile/answers')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  // -- PUT /profile/answers ---------------------------------------------------

  test('PUT /profile/answers creates a new entry', async () => {
    const res = await apiRequest(ctx.app, 'PUT', '/profile/answers', {
      field_kind: 'work_authorization',
      label: 'Work Authorization',
      value: 'US Citizen',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.field_kind).toBe('work_authorization')
    expect(body.data.label).toBe('Work Authorization')
    expect(body.data.value).toBe('US Citizen')
    expect(body.data.id).toBeDefined()
    expect(body.data.created_at).toBeDefined()
    expect(body.data.updated_at).toBeDefined()
  })

  test('PUT /profile/answers upserts existing entry (same field_kind, new value)', async () => {
    // Create
    await apiRequest(ctx.app, 'PUT', '/profile/answers', {
      field_kind: 'gender',
      label: 'Gender',
      value: 'Male',
    })

    // Upsert with new value
    const res = await apiRequest(ctx.app, 'PUT', '/profile/answers', {
      field_kind: 'gender',
      label: 'Gender Identity',
      value: 'Prefer not to say',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.field_kind).toBe('gender')
    expect(body.data.label).toBe('Gender Identity')
    expect(body.data.value).toBe('Prefer not to say')

    // Should still be only 1 entry
    const listRes = await apiRequest(ctx.app, 'GET', '/profile/answers')
    const listBody = await listRes.json()
    expect(listBody.data).toHaveLength(1)
  })

  test('PUT /profile/answers returns 400 for missing field_kind', async () => {
    const res = await apiRequest(ctx.app, 'PUT', '/profile/answers', {
      label: 'Gender',
      value: 'Male',
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  test('PUT /profile/answers returns 400 for missing label', async () => {
    const res = await apiRequest(ctx.app, 'PUT', '/profile/answers', {
      field_kind: 'gender',
      value: 'Male',
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  // -- DELETE /profile/answers/:field_kind ------------------------------------

  test('DELETE /profile/answers/:field_kind removes entry and returns 204', async () => {
    // Create
    await apiRequest(ctx.app, 'PUT', '/profile/answers', {
      field_kind: 'veteran_status',
      label: 'Veteran Status',
      value: 'Not a veteran',
    })

    // Delete
    const res = await apiRequest(ctx.app, 'DELETE', '/profile/answers/veteran_status')
    expect(res.status).toBe(204)

    // Verify it's gone
    const listRes = await apiRequest(ctx.app, 'GET', '/profile/answers')
    const listBody = await listRes.json()
    expect(listBody.data).toHaveLength(0)
  })

  test('DELETE /profile/answers/:field_kind returns 404 for unknown field_kind', async () => {
    const res = await apiRequest(ctx.app, 'DELETE', '/profile/answers/nonexistent')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  // -- Full CRUD lifecycle ----------------------------------------------------

  test('full CRUD lifecycle: create 3, list, update 1, delete 1, verify', async () => {
    // Create 3 entries
    await apiRequest(ctx.app, 'PUT', '/profile/answers', {
      field_kind: 'disability',
      label: 'Disability Status',
      value: 'No',
    })
    await apiRequest(ctx.app, 'PUT', '/profile/answers', {
      field_kind: 'ethnicity',
      label: 'Ethnicity',
      value: 'Prefer not to say',
    })
    await apiRequest(ctx.app, 'PUT', '/profile/answers', {
      field_kind: 'work_authorization',
      label: 'Work Authorization',
      value: 'US Citizen',
    })

    // List — should have 3, ordered by field_kind
    const listRes = await apiRequest(ctx.app, 'GET', '/profile/answers')
    const listBody = await listRes.json()
    expect(listBody.data).toHaveLength(3)
    expect(listBody.data[0].field_kind).toBe('disability')
    expect(listBody.data[1].field_kind).toBe('ethnicity')
    expect(listBody.data[2].field_kind).toBe('work_authorization')

    // Update 1 (upsert existing)
    const updateRes = await apiRequest(ctx.app, 'PUT', '/profile/answers', {
      field_kind: 'ethnicity',
      label: 'Race/Ethnicity',
      value: 'Two or more races',
    })
    expect(updateRes.status).toBe(200)
    const updateBody = await updateRes.json()
    expect(updateBody.data.label).toBe('Race/Ethnicity')
    expect(updateBody.data.value).toBe('Two or more races')

    // Delete 1
    const delRes = await apiRequest(ctx.app, 'DELETE', '/profile/answers/disability')
    expect(delRes.status).toBe(204)

    // Verify final state: 2 entries
    const finalRes = await apiRequest(ctx.app, 'GET', '/profile/answers')
    const finalBody = await finalRes.json()
    expect(finalBody.data).toHaveLength(2)
    expect(finalBody.data[0].field_kind).toBe('ethnicity')
    expect(finalBody.data[0].value).toBe('Two or more races')
    expect(finalBody.data[1].field_kind).toBe('work_authorization')
  })
})
