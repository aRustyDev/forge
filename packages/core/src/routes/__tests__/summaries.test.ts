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
      description: 'Security engineer with 8+ years...',
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.title).toBe('Security Engineer - Cloud')
    expect(body.data.role).toBe('Senior Security Engineer')
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
      description: 'New description',
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.title).toBe('Updated')
    expect(body.data.description).toBe('New description')
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
      description: 'Builds things',
    })

    const res = await apiRequest(ctx.app, 'POST', `/summaries/${id}/clone`)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.title).toBe('Copy of Original')
    expect(body.data.role).toBe('Engineer')
    expect(body.data.description).toBe('Builds things')
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

  // ────────────────────────────────────────────────────────────────
  // Phase 91 — structured filters, sort, ?include=relations, skills
  // ────────────────────────────────────────────────────────────────

  describe('structured fields + skill keywords (Phase 91)', () => {
    async function createIndustry(name: string): Promise<string> {
      const res = await apiRequest(ctx.app, 'POST', '/industries', { name })
      return (await res.json()).data.id
    }
    async function createRoleType(name: string): Promise<string> {
      const res = await apiRequest(ctx.app, 'POST', '/role-types', { name })
      return (await res.json()).data.id
    }
    async function createSkill(name: string): Promise<string> {
      const res = await apiRequest(ctx.app, 'POST', '/skills', { name, category: 'other' })
      return (await res.json()).data.id
    }

    test('POST /summaries accepts industry_id and role_type_id', async () => {
      const industryId = await createIndustry('FinTech')
      const roleTypeId = await createRoleType('IC')

      const res = await apiRequest(ctx.app, 'POST', '/summaries', {
        title: 'Structured',
        industry_id: industryId,
        role_type_id: roleTypeId,
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.industry_id).toBe(industryId)
      expect(body.data.role_type_id).toBe(roleTypeId)
    })

    test('GET /summaries?industry_id filters by industry', async () => {
      const finId = await createIndustry('Finance')
      const healthId = await createIndustry('Health')

      await apiRequest(ctx.app, 'POST', '/summaries', { title: 'FinA', industry_id: finId })
      await apiRequest(ctx.app, 'POST', '/summaries', { title: 'FinB', industry_id: finId })
      await apiRequest(ctx.app, 'POST', '/summaries', { title: 'HealthOne', industry_id: healthId })

      const res = await apiRequest(ctx.app, 'GET', `/summaries?industry_id=${finId}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.data.every((s: any) => s.industry_id === finId)).toBe(true)
    })

    test('GET /summaries?role_type_id filters by role type', async () => {
      const iC = await createRoleType('IC-filter')
      const mgr = await createRoleType('Manager-filter')

      await apiRequest(ctx.app, 'POST', '/summaries', { title: 'A', role_type_id: iC })
      await apiRequest(ctx.app, 'POST', '/summaries', { title: 'B', role_type_id: mgr })

      const res = await apiRequest(ctx.app, 'GET', `/summaries?role_type_id=${iC}`)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].title).toBe('A')
    })

    test('GET /summaries?sort_by=title&direction=asc sorts ascending', async () => {
      // Seed out of order
      seedSummary(ctx.db, { title: 'Zeta' })
      seedSummary(ctx.db, { title: 'Alpha' })
      seedSummary(ctx.db, { title: 'Mu' })

      const res = await apiRequest(ctx.app, 'GET', '/summaries?sort_by=title&direction=asc')
      const body = await res.json()
      expect(body.data.map((s: any) => s.title)).toEqual(['Alpha', 'Mu', 'Zeta'])
    })

    test('GET /summaries?sort_by=title&direction=desc sorts descending', async () => {
      seedSummary(ctx.db, { title: 'Zeta' })
      seedSummary(ctx.db, { title: 'Alpha' })
      seedSummary(ctx.db, { title: 'Mu' })

      const res = await apiRequest(ctx.app, 'GET', '/summaries?sort_by=title&direction=desc')
      const body = await res.json()
      expect(body.data.map((s: any) => s.title)).toEqual(['Zeta', 'Mu', 'Alpha'])
    })

    test('GET /summaries?sort_by=invalid returns 400', async () => {
      const res = await apiRequest(ctx.app, 'GET', '/summaries?sort_by=bogus')
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    test('GET /summaries/:id?include=relations hydrates industry, role_type, skills', async () => {
      const industryId = await createIndustry('Aero')
      const roleTypeId = await createRoleType('Tech Lead-hydrate')
      const skillId = await createSkill('RustLang')

      const createRes = await apiRequest(ctx.app, 'POST', '/summaries', {
        title: 'Hydrated',
        industry_id: industryId,
        role_type_id: roleTypeId,
      })
      const summaryId = (await createRes.json()).data.id

      // Link a skill keyword
      const linkRes = await apiRequest(ctx.app, 'POST', `/summaries/${summaryId}/skills`, { skill_id: skillId })
      expect(linkRes.status).toBe(204)

      const res = await apiRequest(ctx.app, 'GET', `/summaries/${summaryId}?include=relations`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.industry?.name).toBe('Aero')
      expect(body.data.role_type?.name).toBe('Tech Lead-hydrate')
      expect(body.data.skills).toHaveLength(1)
      expect(body.data.skills[0].name).toBe('RustLang')
    })

    test('GET /summaries/:id without include does NOT hydrate relations', async () => {
      const id = seedSummary(ctx.db, { title: 'Plain' })
      const res = await apiRequest(ctx.app, 'GET', `/summaries/${id}`)
      const body = await res.json()
      expect(body.data.industry).toBeUndefined()
      expect(body.data.role_type).toBeUndefined()
      expect(body.data.skills).toBeUndefined()
    })

    test('POST /summaries/:id/skills links a skill keyword', async () => {
      const summaryId = seedSummary(ctx.db)
      const skillId = await createSkill('Python')

      const res = await apiRequest(ctx.app, 'POST', `/summaries/${summaryId}/skills`, { skill_id: skillId })
      expect(res.status).toBe(204)

      const listRes = await apiRequest(ctx.app, 'GET', `/summaries/${summaryId}/skills`)
      expect(listRes.status).toBe(200)
      const body = await listRes.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].id).toBe(skillId)
    })

    test('POST /summaries/:id/skills without skill_id returns 400', async () => {
      const summaryId = seedSummary(ctx.db)
      const res = await apiRequest(ctx.app, 'POST', `/summaries/${summaryId}/skills`, {})
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    test('POST /summaries/:id/skills on missing summary returns 404', async () => {
      const skillId = await createSkill('Missing')
      const res = await apiRequest(
        ctx.app,
        'POST',
        '/summaries/00000000-0000-0000-0000-000000000000/skills',
        { skill_id: skillId },
      )
      expect(res.status).toBe(404)
    })

    test('DELETE /summaries/:id/skills/:skillId unlinks', async () => {
      const summaryId = seedSummary(ctx.db)
      const skillId = await createSkill('Temporary')

      await apiRequest(ctx.app, 'POST', `/summaries/${summaryId}/skills`, { skill_id: skillId })
      const del = await apiRequest(ctx.app, 'DELETE', `/summaries/${summaryId}/skills/${skillId}`)
      expect(del.status).toBe(204)

      const listRes = await apiRequest(ctx.app, 'GET', `/summaries/${summaryId}/skills`)
      const body = await listRes.json()
      expect(body.data).toHaveLength(0)
    })

    test('GET /summaries?skill_id filters through summary_skills', async () => {
      const k8sId = await createSkill('K8s-filter')
      const pgId = await createSkill('PG-filter')

      const aRes = await apiRequest(ctx.app, 'POST', '/summaries', { title: 'Infra' })
      const bRes = await apiRequest(ctx.app, 'POST', '/summaries', { title: 'DB' })
      const aId = (await aRes.json()).data.id
      const bId = (await bRes.json()).data.id

      await apiRequest(ctx.app, 'POST', `/summaries/${aId}/skills`, { skill_id: k8sId })
      await apiRequest(ctx.app, 'POST', `/summaries/${bId}/skills`, { skill_id: pgId })

      const filterRes = await apiRequest(ctx.app, 'GET', `/summaries?skill_id=${k8sId}`)
      const body = await filterRes.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].title).toBe('Infra')
    })
  })
})
