import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestApp, apiRequest, type TestContext } from './helpers'
import {
  seedSource,
  seedBullet,
  seedPerspective,
  seedResume,
  seedResumeEntry,
  seedResumeSection,
  seedOrganization,
  seedJobDescription,
} from '../../db/__tests__/helpers'

describe('API Response Contracts', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  // ── Single Entity Envelope ────────────────────────────────────────

  test('POST returns { data: entity } envelope', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/sources', {
      title: 'Contract Source',
      description: 'Testing response shape.',
      source_type: 'general',
    })
    expect(res.status).toBe(201)
    const body = await res.json()

    expect(body).toHaveProperty('data')
    expect(body.data).toHaveProperty('id')
    expect(body.data).toHaveProperty('title')
    expect(body.data).toHaveProperty('created_at')
    expect(body).not.toHaveProperty('error')
  })

  test('GET single returns { data: entity } envelope', async () => {
    const sourceId = seedSource(ctx.db)

    const res = await apiRequest(ctx.app, 'GET', `/sources/${sourceId}`)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body).toHaveProperty('data')
    expect(body.data).toHaveProperty('id')
    expect(body).not.toHaveProperty('pagination')
    expect(body).not.toHaveProperty('error')
  })

  // ── List Envelope with Pagination ─────────────────────────────────

  test('GET list returns { data: [], pagination: {} } envelope', async () => {
    seedSource(ctx.db)

    const res = await apiRequest(ctx.app, 'GET', '/sources')
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body).toHaveProperty('data')
    expect(body.data).toBeArray()
    expect(body).toHaveProperty('pagination')
    expect(body.pagination).toHaveProperty('total')
    expect(body.pagination).toHaveProperty('offset')
    expect(body.pagination).toHaveProperty('limit')
    expect(typeof body.pagination.total).toBe('number')
    expect(typeof body.pagination.offset).toBe('number')
    expect(typeof body.pagination.limit).toBe('number')
  })

  // ── Error Envelopes ───────────────────────────────────────────────

  test('404 returns { error: { code, message } } envelope', async () => {
    const res = await apiRequest(ctx.app, 'GET', '/sources/00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(404)
    const body = await res.json()

    expect(body).toHaveProperty('error')
    expect(body.error).toHaveProperty('code')
    expect(body.error).toHaveProperty('message')
    expect(body.error.code).toBe('NOT_FOUND')
    expect(typeof body.error.message).toBe('string')
    expect(body).not.toHaveProperty('data')
  })

  test('400 returns { error: { code, message } } envelope', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/sources', {
      title: '',
      description: 'No title',
    })
    expect(res.status).toBe(400)
    const body = await res.json()

    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(typeof body.error.message).toBe('string')
  })

  test('409 returns { error: { code, message } } envelope', async () => {
    const sourceId = seedSource(ctx.db)
    const bulletId = seedBullet(ctx.db, [{ id: sourceId }])
    seedPerspective(ctx.db, bulletId)

    const res = await apiRequest(ctx.app, 'DELETE', `/bullets/${bulletId}`)
    expect(res.status).toBe(409)
    const body = await res.json()

    expect(body.error.code).toBe('CONFLICT')
    expect(typeof body.error.message).toBe('string')
  })

  // ── Delete 204 ────────────────────────────────────────────────────

  test('DELETE returns 204 with no body', async () => {
    const sourceId = seedSource(ctx.db)

    const res = await apiRequest(ctx.app, 'DELETE', `/sources/${sourceId}`)
    expect(res.status).toBe(204)
    // 204 should have no body
    const text = await res.text()
    expect(text).toBe('')
  })

  // ── Nested Chain ──────────────────────────────────────────────────

  test('GET /perspectives/:id returns nested chain shape', async () => {
    const sourceId = seedSource(ctx.db, { title: 'Chain Source' })
    const bulletId = seedBullet(ctx.db, [{ id: sourceId }], { content: 'Chain Bullet' })
    const perspId = seedPerspective(ctx.db, bulletId, { content: 'Chain Perspective' })

    const res = await apiRequest(ctx.app, 'GET', `/perspectives/${perspId}`)
    expect(res.status).toBe(200)
    const body = await res.json()

    // Perspective with chain
    expect(body.data).toHaveProperty('id')
    expect(body.data).toHaveProperty('content')
    expect(body.data).toHaveProperty('bullet')
    expect(body.data.bullet).toHaveProperty('id')
    expect(body.data.bullet).toHaveProperty('content')
    expect(body.data).toHaveProperty('source')
    expect(body.data.source).toHaveProperty('id')
    expect(body.data.source).toHaveProperty('title')
  })

  // ── Review Queue Shape ────────────────────────────────────────────

  test('GET /review/pending returns review queue shape', async () => {
    const res = await apiRequest(ctx.app, 'GET', '/review/pending')
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.data).toHaveProperty('bullets')
    expect(body.data.bullets).toHaveProperty('count')
    expect(body.data.bullets).toHaveProperty('items')
    expect(typeof body.data.bullets.count).toBe('number')
    expect(body.data.bullets.items).toBeArray()

    expect(body.data).toHaveProperty('perspectives')
    expect(body.data.perspectives).toHaveProperty('count')
    expect(body.data.perspectives).toHaveProperty('items')
  })

  // ── Gap Analysis Shape ────────────────────────────────────────────

  test('GET /resumes/:id/gaps returns gap analysis shape', async () => {
    const resumeId = seedResume(ctx.db, { archetype: 'agentic-ai' })

    const res = await apiRequest(ctx.app, 'GET', `/resumes/${resumeId}/gaps`)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.data).toHaveProperty('resume_id')
    expect(body.data).toHaveProperty('archetype')
    expect(body.data).toHaveProperty('target_role')
    expect(body.data).toHaveProperty('target_employer')
    expect(body.data).toHaveProperty('gaps')
    expect(body.data.gaps).toBeArray()
    expect(body.data).toHaveProperty('coverage_summary')
    expect(body.data.coverage_summary).toHaveProperty('perspectives_included')
    expect(body.data.coverage_summary).toHaveProperty('total_approved_perspectives_for_archetype')
    expect(body.data.coverage_summary).toHaveProperty('domains_represented')
    expect(body.data.coverage_summary).toHaveProperty('domains_missing')
  })

  // ── Organization CRUD Shapes ──────────────────────────────────────

  test('POST /organizations returns { data: org } with correct fields', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/organizations', {
      name: 'Acme Corp',
      org_type: 'company',
      industry: 'Tech',
    })
    expect(res.status).toBe(201)
    const body = await res.json()

    expect(body.data).toHaveProperty('id')
    expect(body.data).toHaveProperty('name', 'Acme Corp')
    expect(body.data).toHaveProperty('org_type', 'company')
    expect(body.data).toHaveProperty('created_at')
  })

  test('GET /organizations returns list envelope', async () => {
    seedOrganization(ctx.db)

    const res = await apiRequest(ctx.app, 'GET', '/organizations')
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.data).toBeArray()
    expect(body.pagination).toBeDefined()
  })

  test('GET /organizations/:id returns single entity', async () => {
    const orgId = seedOrganization(ctx.db, { name: 'Test Org' })

    const res = await apiRequest(ctx.app, 'GET', `/organizations/${orgId}`)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.data.id).toBe(orgId)
    expect(body.data.name).toBe('Test Org')
  })

  // ── Note Shapes ───────────────────────────────────────────────────

  test('POST /notes returns { data: note } with correct fields', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/notes', {
      title: 'My Note',
      content: 'Note content here.',
    })
    expect(res.status).toBe(201)
    const body = await res.json()

    expect(body.data).toHaveProperty('id')
    expect(body.data).toHaveProperty('title', 'My Note')
    expect(body.data).toHaveProperty('content', 'Note content here.')
    expect(body.data).toHaveProperty('created_at')
  })

  test('GET /notes returns list envelope', async () => {
    // Create a note via API
    await apiRequest(ctx.app, 'POST', '/notes', { content: 'Test note' })

    const res = await apiRequest(ctx.app, 'GET', '/notes')
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.data).toBeArray()
    expect(body.pagination).toBeDefined()
    expect(body.data.length).toBeGreaterThanOrEqual(1)
  })

  // ── Source with Extension Data ──────────────────────────────────────

  test('GET /sources/:id returns source_type field and extension data', async () => {
    // Create a role source with extension data
    const createRes = await apiRequest(ctx.app, 'POST', '/sources', {
      title: 'Contract Role Source',
      description: 'Testing extension shape.',
      source_type: 'role',
      start_date: '2024-01-01',
      end_date: '2025-12-31',
    })
    expect(createRes.status).toBe(201)
    const created = (await createRes.json()).data

    const res = await apiRequest(ctx.app, 'GET', `/sources/${created.id}`)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.data).toHaveProperty('source_type', 'role')
    expect(body.data).toHaveProperty('extension')
    expect(body.data.extension).toHaveProperty('source_id')
    expect(body.data.extension).toHaveProperty('start_date')
    expect(body.data.extension).toHaveProperty('end_date')
  })

  test('GET /sources/:id for general type has null extension', async () => {
    const sourceId = seedSource(ctx.db, { sourceType: 'general' })
    const res = await apiRequest(ctx.app, 'GET', `/sources/${sourceId}`)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.data).toHaveProperty('source_type', 'general')
    expect(body.data.extension).toBeNull()
  })

  // ── Bullet with Sources Array ──────────────────────────────────────

  test('GET /bullets/:id returns bullet without source_id but with sources accessible', async () => {
    const sourceId = seedSource(ctx.db)
    const bulletId = seedBullet(ctx.db, [{ id: sourceId }])

    const res = await apiRequest(ctx.app, 'GET', `/bullets/${bulletId}`)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.data).toHaveProperty('id')
    expect(body.data).toHaveProperty('content')
    expect(body.data).toHaveProperty('status')
    expect(body.data).toHaveProperty('technologies')
    expect(body.data.technologies).toBeArray()
    // source_id has been removed in v2; sources are in bullet_sources junction
    expect(body.data).not.toHaveProperty('source_id')
  })

  // ── Resume with Entries ────────────────────────────────────────────

  test('GET /resumes/:id returns sections with entries containing id, perspective_id, content', async () => {
    const sourceId = seedSource(ctx.db)
    const bulletId = seedBullet(ctx.db, [{ id: sourceId }])
    const perspId = seedPerspective(ctx.db, bulletId)
    const resumeId = seedResume(ctx.db)
    const secId = seedResumeSection(ctx.db, resumeId, 'Experience', 'experience')
    seedResumeEntry(ctx.db, secId, { perspectiveId: perspId, position: 0 })

    const res = await apiRequest(ctx.app, 'GET', `/resumes/${resumeId}`)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.data).toHaveProperty('sections')
    expect(body.data.sections).toBeArray()
    expect(body.data.sections.length).toBe(1)

    const section = body.data.sections[0]
    expect(section).toHaveProperty('id', secId)
    expect(section).toHaveProperty('title', 'Experience')
    expect(section).toHaveProperty('entry_type', 'experience')
    expect(section).toHaveProperty('entries')
    expect(section.entries).toBeArray()

    const entry = section.entries[0]
    expect(entry).toHaveProperty('id')
    expect(entry).toHaveProperty('perspective_id', perspId)
    expect(entry).toHaveProperty('content')
    expect(entry).toHaveProperty('perspective_content')
    expect(entry).toHaveProperty('perspective_content_snapshot')
    expect(entry).toHaveProperty('section_id', secId)
    expect(entry).toHaveProperty('position', 0)
  })

  // ── Note with References ───────────────────────────────────────────

  test('GET /notes/:id returns references array', async () => {
    const noteRes = await apiRequest(ctx.app, 'POST', '/notes', {
      title: 'Contract Note',
      content: 'Testing reference shape.',
    })
    const note = (await noteRes.json()).data

    const sourceId = seedSource(ctx.db)
    await apiRequest(ctx.app, 'POST', `/notes/${note.id}/references`, {
      entity_type: 'source',
      entity_id: sourceId,
    })

    const res = await apiRequest(ctx.app, 'GET', `/notes/${note.id}`)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.data).toHaveProperty('references')
    expect(body.data.references).toBeArray()
    expect(body.data.references.length).toBe(1)
    expect(body.data.references[0]).toHaveProperty('note_id')
    expect(body.data.references[0]).toHaveProperty('entity_type', 'source')
    expect(body.data.references[0]).toHaveProperty('entity_id', sourceId)
  })

  // ── Drift Report Shape ─────────────────────────────────────────────

  test('GET /integrity/drift returns array of drifted entities', async () => {
    const res = await apiRequest(ctx.app, 'GET', '/integrity/drift')
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.data).toBeArray()
    // Shape check: if items exist, they should have the correct shape
    // Seed a drifted bullet to verify shape
    const sourceId = seedSource(ctx.db, { description: 'Current description' })
    seedBullet(ctx.db, [{ id: sourceId }], { content: 'Derived bullet' })
    // The seedBullet sets source_content_snapshot to 'snapshot of source content'
    // which doesn't match 'Current description', so drift will be detected

    const res2 = await apiRequest(ctx.app, 'GET', '/integrity/drift')
    const body2 = await res2.json()
    expect(body2.data.length).toBeGreaterThanOrEqual(1)

    const driftItem = body2.data[0]
    expect(driftItem).toHaveProperty('entity_type')
    expect(driftItem).toHaveProperty('entity_id')
    expect(driftItem).toHaveProperty('snapshot_field')
    expect(driftItem).toHaveProperty('snapshot_value')
    expect(driftItem).toHaveProperty('current_value')
    expect(['bullet', 'perspective']).toContain(driftItem.entity_type)
  })

  // ── Profile Contract ──────────────────────────────────────────────

  test('GET /profile returns { data: UserProfile } contract shape', async () => {
    const res = await apiRequest(ctx.app, 'GET', '/profile')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(body.data).toHaveProperty('id')
    expect(body.data).toHaveProperty('name')
    expect(body.data).toHaveProperty('email')
    expect(body.data).toHaveProperty('phone')
    expect(body.data).toHaveProperty('location')
    expect(body.data).toHaveProperty('linkedin')
    expect(body.data).toHaveProperty('github')
    expect(body.data).toHaveProperty('website')
    expect(body.data).toHaveProperty('clearance')
    expect(body.data).toHaveProperty('created_at')
    expect(body.data).toHaveProperty('updated_at')
    expect(body).not.toHaveProperty('pagination')
    expect(body).not.toHaveProperty('error')
  })

  test('PATCH /profile returns { data: UserProfile } contract shape', async () => {
    const res = await apiRequest(ctx.app, 'PATCH', '/profile', { name: 'Contract Test' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(body.data.name).toBe('Contract Test')
    expect(body).not.toHaveProperty('error')
  })

  test('PATCH /profile validation error returns { error } contract shape', async () => {
    const res = await apiRequest(ctx.app, 'PATCH', '/profile', { name: '' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toHaveProperty('error')
    expect(body.error).toHaveProperty('code')
    expect(body.error).toHaveProperty('message')
    expect(body).not.toHaveProperty('data')
  })

  // ── Job Descriptions Contract ─────────────────────────────────────────

  test('POST /job-descriptions returns { data: entity } envelope', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/job-descriptions', {
      title: 'Contract JD',
      raw_text: 'Testing contract shape.',
    })
    expect(res.status).toBe(201)
    const body = await res.json()

    expect(body).toHaveProperty('data')
    expect(body.data).toHaveProperty('id')
    expect(body.data).toHaveProperty('title')
    expect(body.data).toHaveProperty('status')
    expect(body.data).toHaveProperty('organization_name')
    expect(body.data).toHaveProperty('created_at')
    expect(body).not.toHaveProperty('error')
  })

  test('GET /job-descriptions returns { data: [], pagination: {} } envelope', async () => {
    seedJobDescription(ctx.db)

    const res = await apiRequest(ctx.app, 'GET', '/job-descriptions')
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body).toHaveProperty('data')
    expect(body.data).toBeArray()
    expect(body).toHaveProperty('pagination')
    expect(body.pagination).toHaveProperty('total')
    expect(body.pagination).toHaveProperty('offset')
    expect(body.pagination).toHaveProperty('limit')
  })
})
