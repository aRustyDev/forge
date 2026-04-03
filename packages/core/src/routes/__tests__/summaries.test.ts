import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestApp, apiRequest, type TestContext } from './helpers'
import { seedSummary, seedResume } from '../../db/__tests__/helpers'

describe('Summaries API', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  // ── POST /summaries ───────────────────────────────────────────────

  test('POST /summaries creates a summary', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/summaries', {
      title: 'Security Engineer - Cloud',
      role: 'Senior Security Engineer',
      tagline: 'Cloud + DevSecOps',
      description: 'Security engineer with 8+ years...',
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.title).toBe('Security Engineer - Cloud')
    expect(body.data.role).toBe('Senior Security Engineer')
    expect(body.data.tagline).toBe('Cloud + DevSecOps')
    expect(body.data.description).toBe('Security engineer with 8+ years...')
    expect(body.data.is_template).toBe(0)
    expect(body.data.id).toHaveLength(36)
  })

  test('POST /summaries with empty title returns 400', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/summaries', { title: '' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  test('POST /summaries with is_template=1 creates template', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/summaries', {
      title: 'Template',
      is_template: 1,
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.is_template).toBe(1)
  })

  // ── GET /summaries ────────────────────────────────────────────────

  test('GET /summaries returns list with pagination', async () => {
    seedSummary(ctx.db, { title: 'One' })
    seedSummary(ctx.db, { title: 'Two' })

    const res = await apiRequest(ctx.app, 'GET', '/summaries')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.pagination.total).toBe(2)
    expect(body.pagination.offset).toBe(0)
    expect(body.pagination.limit).toBe(50)
  })

  test('GET /summaries?is_template=1 filters to templates', async () => {
    seedSummary(ctx.db, { title: 'Instance', isTemplate: 0 })
    seedSummary(ctx.db, { title: 'Template', isTemplate: 1 })

    const res = await apiRequest(ctx.app, 'GET', '/summaries?is_template=1')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('Template')
  })

  test('GET /summaries without filter returns all', async () => {
    seedSummary(ctx.db, { isTemplate: 0 })
    seedSummary(ctx.db, { isTemplate: 1 })

    const res = await apiRequest(ctx.app, 'GET', '/summaries')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
  })

  test('GET /summaries?is_template=invalid returns 200 (param ignored)', async () => {
    seedSummary(ctx.db, { isTemplate: 0 })
    seedSummary(ctx.db, { isTemplate: 1 })

    const res = await apiRequest(ctx.app, 'GET', '/summaries?is_template=invalid')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2) // no filter applied, returns all
  })

  // ── GET /summaries/:id ────────────────────────────────────────────

  test('GET /summaries/:id returns summary', async () => {
    const id = seedSummary(ctx.db, { title: 'Findable' })

    const res = await apiRequest(ctx.app, 'GET', `/summaries/${id}`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.title).toBe('Findable')
  })

  test('GET /summaries/:id returns 404 for missing id', async () => {
    const res = await apiRequest(ctx.app, 'GET', '/summaries/00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  // ── PATCH /summaries/:id ──────────────────────────────────────────

  test('PATCH /summaries/:id updates fields', async () => {
    const id = seedSummary(ctx.db, { title: 'Original' })

    const res = await apiRequest(ctx.app, 'PATCH', `/summaries/${id}`, {
      title: 'Updated',
      tagline: 'New tagline',
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.title).toBe('Updated')
    expect(body.data.tagline).toBe('New tagline')
  })

  test('PATCH /summaries/:id returns 404 for missing id', async () => {
    const res = await apiRequest(ctx.app, 'PATCH', '/summaries/00000000-0000-0000-0000-000000000000', { title: 'Nope' })
    expect(res.status).toBe(404)
  })

  // ── DELETE /summaries/:id ─────────────────────────────────────────

  test('DELETE /summaries/:id removes summary', async () => {
    const id = seedSummary(ctx.db)

    const res = await apiRequest(ctx.app, 'DELETE', `/summaries/${id}`)
    expect(res.status).toBe(204)

    // Verify it's gone
    const get = await apiRequest(ctx.app, 'GET', `/summaries/${id}`)
    expect(get.status).toBe(404)
  })

  test('DELETE /summaries/:id returns 404 for missing id', async () => {
    const res = await apiRequest(ctx.app, 'DELETE', '/summaries/00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(404)
  })

  // ── POST /summaries/:id/clone ─────────────────────────────────────

  test('POST /summaries/:id/clone returns 201 with cloned summary', async () => {
    const id = seedSummary(ctx.db, {
      title: 'Original',
      role: 'Engineer',
      tagline: 'Builds things',
    })

    const res = await apiRequest(ctx.app, 'POST', `/summaries/${id}/clone`)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.title).toBe('Copy of Original')
    expect(body.data.role).toBe('Engineer')
    expect(body.data.tagline).toBe('Builds things')
    expect(body.data.is_template).toBe(0)
    expect(body.data.id).not.toBe(id)
  })

  test('POST /summaries/:id/clone of template always sets is_template=0', async () => {
    const id = seedSummary(ctx.db, { title: 'Template', isTemplate: 1 })

    const res = await apiRequest(ctx.app, 'POST', `/summaries/${id}/clone`)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.is_template).toBe(0)
  })

  test('POST /summaries/:id/clone returns 404 for non-existent id', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/summaries/00000000-0000-0000-0000-000000000000/clone')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('SUMMARY_NOT_FOUND')
  })

  // ── POST /summaries/:id/toggle-template ─────────────────────────────

  test('POST /summaries/:id/toggle-template returns 200 with toggled summary', async () => {
    const id = seedSummary(ctx.db, { isTemplate: 0 })

    const res = await apiRequest(ctx.app, 'POST', `/summaries/${id}/toggle-template`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.is_template).toBe(1)
    expect(body.data.linked_resume_count).toBe(0)
  })

  test('POST /summaries/:id/toggle-template toggles back to 0', async () => {
    const id = seedSummary(ctx.db, { isTemplate: 1 })

    const res = await apiRequest(ctx.app, 'POST', `/summaries/${id}/toggle-template`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.is_template).toBe(0)
  })

  test('POST /summaries/:id/toggle-template returns 404 for missing id', async () => {
    const res = await apiRequest(ctx.app, 'POST', '/summaries/00000000-0000-0000-0000-000000000000/toggle-template')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  // ── GET /summaries/:id/linked-resumes ──────────────────────────────

  test('GET /summaries/:id/linked-resumes returns 200 with paginated data', async () => {
    const sId = seedSummary(ctx.db)
    const rId = seedResume(ctx.db, { name: 'Linked Resume' })
    ctx.db.run('UPDATE resumes SET summary_id = ? WHERE id = ?', [sId, rId])

    const res = await apiRequest(ctx.app, 'GET', `/summaries/${sId}/linked-resumes`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe('Linked Resume')
    expect(body.pagination.total).toBe(1)
    expect(body.pagination.offset).toBe(0)
    expect(body.pagination.limit).toBe(50)
  })

  test('GET /summaries/:id/linked-resumes returns 404 for missing id', async () => {
    const res = await apiRequest(ctx.app, 'GET', '/summaries/00000000-0000-0000-0000-000000000000/linked-resumes')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  test('GET /summaries/:id/linked-resumes respects pagination params', async () => {
    const sId = seedSummary(ctx.db)
    for (let i = 0; i < 5; i++) {
      const rId = seedResume(ctx.db, { name: `Resume ${i}` })
      ctx.db.run('UPDATE resumes SET summary_id = ? WHERE id = ?', [sId, rId])
    }

    const res = await apiRequest(ctx.app, 'GET', `/summaries/${sId}/linked-resumes?limit=2&offset=0`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.pagination.total).toBe(5)
    expect(body.pagination.limit).toBe(2)
    expect(body.pagination.offset).toBe(0)
  })

  // ── GET /summaries with linked_resume_count ────────────────────────

  test('GET /summaries returns summaries with linked_resume_count', async () => {
    const sId = seedSummary(ctx.db, { title: 'Has Resumes' })
    const rId = seedResume(ctx.db)
    ctx.db.run('UPDATE resumes SET summary_id = ? WHERE id = ?', [sId, rId])
    seedSummary(ctx.db, { title: 'No Resumes' })

    const res = await apiRequest(ctx.app, 'GET', '/summaries')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    const hasResumes = body.data.find((s: any) => s.title === 'Has Resumes')
    const noResumes = body.data.find((s: any) => s.title === 'No Resumes')
    expect(hasResumes.linked_resume_count).toBe(1)
    expect(noResumes.linked_resume_count).toBe(0)
  })

  test('GET /summaries/:id returns summary with linked_resume_count', async () => {
    const sId = seedSummary(ctx.db, { title: 'Has Resumes' })
    const rId = seedResume(ctx.db)
    ctx.db.run('UPDATE resumes SET summary_id = ? WHERE id = ?', [sId, rId])

    const res = await apiRequest(ctx.app, 'GET', `/summaries/${sId}`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.linked_resume_count).toBe(1)
  })

  // ── Resume-Summary linking ────────────────────────────────────────

  test('PATCH /resumes/:id with summary_id links summary', async () => {
    const summaryId = seedSummary(ctx.db)

    // Create a resume
    const createRes = await apiRequest(ctx.app, 'POST', '/resumes', {
      name: 'Test Resume',
      target_role: 'Engineer',
      target_employer: 'Corp',
      archetype: 'general',
    })
    const resumeId = (await createRes.json()).data.id

    // Link summary
    const patchRes = await apiRequest(ctx.app, 'PATCH', `/resumes/${resumeId}`, {
      summary_id: summaryId,
    })
    expect(patchRes.status).toBe(200)
    const body = await patchRes.json()
    expect(body.data.summary_id).toBe(summaryId)
  })

  test('PATCH /resumes/:id with summary_id=null detaches summary', async () => {
    const summaryId = seedSummary(ctx.db)

    // Create resume with summary
    const createRes = await apiRequest(ctx.app, 'POST', '/resumes', {
      name: 'Test Resume',
      target_role: 'Engineer',
      target_employer: 'Corp',
      archetype: 'general',
    })
    const resumeId = (await createRes.json()).data.id

    // Link then detach
    await apiRequest(ctx.app, 'PATCH', `/resumes/${resumeId}`, { summary_id: summaryId })
    const detachRes = await apiRequest(ctx.app, 'PATCH', `/resumes/${resumeId}`, { summary_id: null })
    expect(detachRes.status).toBe(200)
    const body = await detachRes.json()
    expect(body.data.summary_id).toBeNull()
  })
})
