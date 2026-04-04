import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestApp, apiRequest, type TestContext } from './helpers'
import { seedSource, seedBullet, seedPerspective, seedResume, seedResumeEntry, seedResumeSection } from '../../db/__tests__/helpers'

describe('Resume Routes', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  // ── POST /resumes ─────────────────────────────────────────────────

  test('POST /resumes creates a resume and returns 201', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/resumes', {
      name: 'AI Engineer Resume',
      target_role: 'AI Engineer',
      target_employer: 'Anthropic',
      archetype: 'agentic-ai',
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(body.data.id).toHaveLength(36)
    expect(body.data.name).toBe('AI Engineer Resume')
    expect(body.data.archetype).toBe('agentic-ai')
  })

  // ── GET /resumes ──────────────────────────────────────────────────

  test('GET /resumes returns 200 with pagination', async () => {
    seedResume(ctx.db, { name: 'Resume A' })
    seedResume(ctx.db, { name: 'Resume B' })

    const res = await apiRequest(ctx.app, 'GET', '/resumes')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeArray()
    expect(body.data.length).toBe(2)
    expect(body.pagination).toBeDefined()
    expect(body.pagination.total).toBe(2)
  })

  // ── GET /resumes/:id ──────────────────────────────────────────────

  test('GET /resumes/:id returns 200 with sections', async () => {
    const resumeId = seedResume(ctx.db)
    const sourceId = seedSource(ctx.db)
    const bulletId = seedBullet(ctx.db, [{ id: sourceId }])
    const perspId = seedPerspective(ctx.db, bulletId)
    const secId = seedResumeSection(ctx.db, resumeId, 'Experience', 'experience')
    seedResumeEntry(ctx.db, secId, { perspectiveId: perspId })

    const res = await apiRequest(ctx.app, 'GET', `/resumes/${resumeId}`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe(resumeId)
    expect(body.data.sections).toBeDefined()
    expect(body.data.sections).toBeArray()
    expect(body.data.sections.length).toBe(1)
    expect(body.data.sections[0].entry_type).toBe('experience')
    expect(body.data.sections[0].entries).toBeArray()
    expect(body.data.sections[0].entries.length).toBe(1)
  })

  // ── POST /resumes/:id/entries ─────────────────────────────────────

  test('POST /resumes/:id/entries with approved perspective returns 201', async () => {
    const resumeId = seedResume(ctx.db)
    const sourceId = seedSource(ctx.db)
    const bulletId = seedBullet(ctx.db, [{ id: sourceId }])
    const perspId = seedPerspective(ctx.db, bulletId, { status: 'approved' })
    const secId = seedResumeSection(ctx.db, resumeId, 'Experience', 'experience')

    const res = await apiRequest(ctx.app, 'POST', `/resumes/${resumeId}/entries`, {
      perspective_id: perspId,
      section_id: secId,
      position: 0,
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(body.data.perspective_id).toBe(perspId)
  })

  test('POST /resumes/:id/entries with non-approved perspective returns 400', async () => {
    const resumeId = seedResume(ctx.db)
    const sourceId = seedSource(ctx.db)
    const bulletId = seedBullet(ctx.db, [{ id: sourceId }])
    const perspId = seedPerspective(ctx.db, bulletId, { status: 'pending_review' })
    const secId = seedResumeSection(ctx.db, resumeId, 'Experience', 'experience')

    const res = await apiRequest(ctx.app, 'POST', `/resumes/${resumeId}/entries`, {
      perspective_id: perspId,
      section_id: secId,
      position: 0,
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toContain('approved')
  })

  // ── GET /resumes/:id/gaps ─────────────────────────────────────────

  test('GET /resumes/:id/gaps returns 200 with gap analysis', async () => {
    const resumeId = seedResume(ctx.db, { archetype: 'agentic-ai' })

    const res = await apiRequest(ctx.app, 'GET', `/resumes/${resumeId}/gaps`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(body.data.resume_id).toBe(resumeId)
    expect(body.data.archetype).toBe('agentic-ai')
    expect(body.data.gaps).toBeArray()
    expect(body.data.coverage_summary).toBeDefined()
  })

  // ── POST /resumes/:id/export (removed) ──────────────────────────

  test('POST /resumes/:id/export returns 404 (legacy stub removed)', async () => {
    const resumeId = seedResume(ctx.db)

    const res = await apiRequest(ctx.app, 'POST', `/resumes/${resumeId}/export`)
    expect(res.status).toBe(404)
  })

  // ── DELETE /resumes/:id ───────────────────────────────────────────

  test('DELETE /resumes/:id returns 204', async () => {
    const resumeId = seedResume(ctx.db)

    const res = await apiRequest(ctx.app, 'DELETE', `/resumes/${resumeId}`)
    expect(res.status).toBe(204)

    // Verify deleted
    const getRes = await apiRequest(ctx.app, 'GET', `/resumes/${resumeId}`)
    expect(getRes.status).toBe(404)
  })
})
