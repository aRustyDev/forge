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

  test('POST /skills with invalid category returns 400', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/skills', {
      name: 'BadSkill',
      category: 'not-a-real-category',
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  test('POST /skills defaults category to "other" when omitted', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/skills', { name: 'Mystery' })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.category).toBe('other')
  })

  test('GET /skills?domain_id=... filters by linked domain', async () => {
    // Create a domain directly via the domain route so we get a real UUID
    const domainRes = await apiRequest(ctx.app, 'POST', '/domains', { name: 'cloud' })
    const domainId = (await domainRes.json()).data.id

    const skillARes = await apiRequest(ctx.app, 'POST', '/skills', { name: 'Terraform', category: 'tool' })
    const skillAId = (await skillARes.json()).data.id
    await apiRequest(ctx.app, 'POST', '/skills', { name: 'Python', category: 'language' })

    // Link skillA to the domain
    const linkRes = await apiRequest(ctx.app, 'POST', `/skills/${skillAId}/domains`, {
      domain_id: domainId,
    })
    expect(linkRes.status).toBe(204)

    // Filter by domain
    const listRes = await apiRequest(ctx.app, 'GET', `/skills?domain_id=${domainId}`)
    expect(listRes.status).toBe(200)
    const listBody = await listRes.json()
    expect(listBody.data.length).toBe(1)
    expect(listBody.data[0].name).toBe('Terraform')
  })

  test('GET /skills/:id?include=domains returns linked domains', async () => {
    const domainRes = await apiRequest(ctx.app, 'POST', '/domains', { name: 'test_sec_domain' })
    const domainId = (await domainRes.json()).data.id

    const skillRes = await apiRequest(ctx.app, 'POST', '/skills', { name: 'OWASP', category: 'methodology' })
    const skillId = (await skillRes.json()).data.id

    await apiRequest(ctx.app, 'POST', `/skills/${skillId}/domains`, { domain_id: domainId })

    const res = await apiRequest(ctx.app, 'GET', `/skills/${skillId}?include=domains`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.domains).toBeArray()
    expect(body.data.domains.length).toBe(1)
    expect(body.data.domains[0].name).toBe('test_sec_domain')
  })

  test('GET /skills/:id/domains lists linked domains', async () => {
    const dom1 = await apiRequest(ctx.app, 'POST', '/domains', { name: 'web' })
    const dom1Id = (await dom1.json()).data.id
    const dom2 = await apiRequest(ctx.app, 'POST', '/domains', { name: 'mobile' })
    const dom2Id = (await dom2.json()).data.id

    const skill = await apiRequest(ctx.app, 'POST', '/skills', { name: 'React', category: 'framework' })
    const skillId = (await skill.json()).data.id

    await apiRequest(ctx.app, 'POST', `/skills/${skillId}/domains`, { domain_id: dom1Id })
    await apiRequest(ctx.app, 'POST', `/skills/${skillId}/domains`, { domain_id: dom2Id })

    const res = await apiRequest(ctx.app, 'GET', `/skills/${skillId}/domains`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.length).toBe(2)
  })

  test('DELETE /skills/:id/domains/:domainId unlinks a domain', async () => {
    const domainRes = await apiRequest(ctx.app, 'POST', '/domains', { name: 'test_ops_domain' })
    const domainId = (await domainRes.json()).data.id

    const skillRes = await apiRequest(ctx.app, 'POST', '/skills', { name: 'Kubernetes', category: 'platform' })
    const skillId = (await skillRes.json()).data.id

    await apiRequest(ctx.app, 'POST', `/skills/${skillId}/domains`, { domain_id: domainId })
    const delRes = await apiRequest(ctx.app, 'DELETE', `/skills/${skillId}/domains/${domainId}`)
    expect(delRes.status).toBe(204)

    const listRes = await apiRequest(ctx.app, 'GET', `/skills/${skillId}/domains`)
    const body = await listRes.json()
    expect(body.data.length).toBe(0)
  })

  test('POST /skills/:id/domains on unknown skill returns 404', async () => {
    const domainRes = await apiRequest(ctx.app, 'POST', '/domains', { name: 'data' })
    const domainId = (await domainRes.json()).data.id

    const res = await apiRequest(
      ctx.app,
      'POST',
      '/skills/00000000-0000-0000-0000-000000000000/domains',
      { domain_id: domainId },
    )
    expect(res.status).toBe(404)
  })

  test('PATCH /skills/:id updates name and category', async () => {
    const createRes = await apiRequest(ctx.app, 'POST', '/skills', { name: 'go', category: 'language' })
    const id = (await createRes.json()).data.id

    const patchRes = await apiRequest(ctx.app, 'PATCH', `/skills/${id}`, {
      name: 'Golang',
      category: 'language',
    })
    expect(patchRes.status).toBe(200)
    const body = await patchRes.json()
    expect(body.data.name).toBe('Golang')
  })

  test('DELETE /skills/:id removes a skill', async () => {
    const createRes = await apiRequest(ctx.app, 'POST', '/skills', { name: 'Tmp', category: 'other' })
    const id = (await createRes.json()).data.id

    const delRes = await apiRequest(ctx.app, 'DELETE', `/skills/${id}`)
    expect(delRes.status).toBe(204)

    const getRes = await apiRequest(ctx.app, 'GET', `/skills/${id}`)
    expect(getRes.status).toBe(404)
  })
})
