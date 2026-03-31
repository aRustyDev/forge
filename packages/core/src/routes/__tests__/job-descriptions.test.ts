/**
 * Tests for job description API routes.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createTestApp, apiRequest, type TestContext } from './helpers'
import { seedOrganization, seedJobDescription } from '../../db/__tests__/helpers'

let ctx: TestContext

beforeEach(() => {
  ctx = createTestApp()
})

afterEach(() => {
  ctx.db.close()
})

describe('Job Description Routes', () => {
  // ── POST /job-descriptions ──────────────────────────────────────────

  test('POST creates a job description and returns 201', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/job-descriptions', {
      title: 'Security Engineer',
      raw_text: 'Full job description text...',
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.title).toBe('Security Engineer')
    expect(body.data.status).toBe('interested')
    expect(body.data.id).toHaveLength(36)
  })

  test('POST with organization includes organization_name', async () => {
    const orgId = seedOrganization(ctx.db, { name: 'Anthropic' })
    const res = await apiRequest(ctx.app, 'POST', '/job-descriptions', {
      title: 'ML Engineer',
      raw_text: 'text',
      organization_id: orgId,
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.organization_name).toBe('Anthropic')
  })

  test('POST rejects empty title with 400', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/job-descriptions', {
      title: '',
      raw_text: 'text',
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  test('POST rejects empty raw_text with 400', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/job-descriptions', {
      title: 'Valid',
      raw_text: '',
    })
    expect(res.status).toBe(400)
  })

  // ── GET /job-descriptions ───────────────────────────────────────────

  test('GET list returns paginated envelope', async () => {
    seedJobDescription(ctx.db, { title: 'JD1' })
    seedJobDescription(ctx.db, { title: 'JD2' })

    const res = await apiRequest(ctx.app, 'GET', '/job-descriptions')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeArray()
    expect(body.data).toHaveLength(2)
    expect(body.pagination.total).toBe(2)
    expect(body.pagination.offset).toBe(0)
    expect(body.pagination.limit).toBe(50)
  })

  test('GET list filters by status', async () => {
    seedJobDescription(ctx.db, { title: 'A', status: 'applied' })
    seedJobDescription(ctx.db, { title: 'B', status: 'interested' })

    const res = await apiRequest(
      ctx.app,
      'GET',
      '/job-descriptions?status=applied',
    )
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('A')
  })

  test('GET list filters by organization_id', async () => {
    const orgId = seedOrganization(ctx.db, { name: 'FilterOrg' })
    seedJobDescription(ctx.db, {
      title: 'Match',
      organizationId: orgId,
    })
    seedJobDescription(ctx.db, { title: 'NoMatch' })

    const res = await apiRequest(
      ctx.app,
      'GET',
      `/job-descriptions?organization_id=${orgId}`,
    )
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('Match')
  })

  test('GET list includes organization_name per item', async () => {
    const orgId = seedOrganization(ctx.db, { name: 'OrgName' })
    seedJobDescription(ctx.db, {
      title: 'With Org',
      organizationId: orgId,
    })
    seedJobDescription(ctx.db, { title: 'No Org' })

    const res = await apiRequest(ctx.app, 'GET', '/job-descriptions')
    const body = await res.json()
    const withOrg = body.data.find(
      (jd: any) => jd.title === 'With Org',
    )
    const noOrg = body.data.find(
      (jd: any) => jd.title === 'No Org',
    )
    expect(withOrg.organization_name).toBe('OrgName')
    expect(noOrg.organization_name).toBeNull()
  })

  // ── GET /job-descriptions/:id ───────────────────────────────────────

  test('GET single returns job description with org name', async () => {
    const orgId = seedOrganization(ctx.db, { name: 'TestCorp' })
    const jdId = seedJobDescription(ctx.db, {
      title: 'Target JD',
      organizationId: orgId,
    })

    const res = await apiRequest(
      ctx.app,
      'GET',
      `/job-descriptions/${jdId}`,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.title).toBe('Target JD')
    expect(body.data.organization_name).toBe('TestCorp')
  })

  test('GET single returns 404 for nonexistent id', async () => {
    const res = await apiRequest(
      ctx.app,
      'GET',
      `/job-descriptions/${crypto.randomUUID()}`,
    )
    expect(res.status).toBe(404)
  })

  // ── PATCH /job-descriptions/:id ─────────────────────────────────────

  test('PATCH updates fields and returns updated JD', async () => {
    const jdId = seedJobDescription(ctx.db, { title: 'Old' })

    const res = await apiRequest(
      ctx.app,
      'PATCH',
      `/job-descriptions/${jdId}`,
      { title: 'New', status: 'applied' },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.title).toBe('New')
    expect(body.data.status).toBe('applied')
  })

  test('PATCH returns 404 for nonexistent id', async () => {
    const res = await apiRequest(
      ctx.app,
      'PATCH',
      `/job-descriptions/${crypto.randomUUID()}`,
      { title: 'X' },
    )
    expect(res.status).toBe(404)
  })

  test('PATCH with organization_id: null clears the organization', async () => {
    const orgId = seedOrganization(ctx.db, { name: 'ClearMe' })
    const jdId = seedJobDescription(ctx.db, {
      title: 'Has Org',
      organizationId: orgId,
    })

    const res = await apiRequest(
      ctx.app,
      'PATCH',
      `/job-descriptions/${jdId}`,
      { organization_id: null },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.organization_id).toBeNull()
  })

  test('PATCH rejects invalid status with 400', async () => {
    const jdId = seedJobDescription(ctx.db)

    const res = await apiRequest(
      ctx.app,
      'PATCH',
      `/job-descriptions/${jdId}`,
      { status: 'invalid' },
    )
    expect(res.status).toBe(400)
  })

  // ── DELETE /job-descriptions/:id ────────────────────────────────────

  test('DELETE returns 204', async () => {
    const jdId = seedJobDescription(ctx.db)

    const res = await apiRequest(
      ctx.app,
      'DELETE',
      `/job-descriptions/${jdId}`,
    )
    expect(res.status).toBe(204)

    // Verify deleted
    const get = await apiRequest(
      ctx.app,
      'GET',
      `/job-descriptions/${jdId}`,
    )
    expect(get.status).toBe(404)
  })

  test('DELETE returns 404 for nonexistent id', async () => {
    const res = await apiRequest(
      ctx.app,
      'DELETE',
      `/job-descriptions/${crypto.randomUUID()}`,
    )
    expect(res.status).toBe(404)
  })
})
