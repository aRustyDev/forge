/**
 * Certification route acceptance tests (Phase 86 T86.2).
 *
 * Acceptance criteria from the phase plan:
 *   [x] All 7 routes implemented
 *   [x] Skill add/remove returns updated certification with skills
 *   [x] Proper cascade behavior (deleting cert removes skill links)
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createTestApp, apiRequest, type TestContext } from './helpers'
import { seedSource, seedSkill, testUuid } from '../../db/__tests__/helpers'

describe('Certification routes', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestApp()
  })

  afterEach(() => {
    ctx.db.close()
  })

  // ────────────────────────────────────────────────────────────────
  // POST /certifications
  // ────────────────────────────────────────────────────────────────

  describe('POST /certifications', () => {
    test('201 + data envelope for minimal valid cert', async () => {
      const res = await apiRequest(ctx.app, 'POST', '/certifications', {
        name: 'CISSP',
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.id).toHaveLength(36)
      expect(body.data.name).toBe('CISSP')
    })

    test('201 with all optional fields', async () => {
      const res = await apiRequest(ctx.app, 'POST', '/certifications', {
        name: 'AWS SA Pro',
        issuer: 'Amazon Web Services',
        date_earned: '2024-01-15',
        expiry_date: '2027-01-15',
        credential_id: 'AWS-123456',
        credential_url: 'https://aws.amazon.com/verify/123456',
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.issuer).toBe('Amazon Web Services')
      expect(body.data.credential_id).toBe('AWS-123456')
    })

    test('400 for empty name', async () => {
      const res = await apiRequest(ctx.app, 'POST', '/certifications', { name: '' })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toContain('name')
    })

    test('400 for whitespace-only name', async () => {
      const res = await apiRequest(ctx.app, 'POST', '/certifications', { name: '   ' })
      expect(res.status).toBe(400)
    })

    test('400 for education_source_id pointing to a non-education source', async () => {
      const roleId = seedSource(ctx.db, { title: 'Engineer', sourceType: 'role' })
      const res = await apiRequest(ctx.app, 'POST', '/certifications', {
        name: 'CISSP',
        education_source_id: roleId,
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toContain('education')
    })

    test('404 for unknown education_source_id', async () => {
      const res = await apiRequest(ctx.app, 'POST', '/certifications', {
        name: 'CISSP',
        education_source_id: testUuid(),
      })
      expect(res.status).toBe(404)
    })

    test('201 with valid education_source_id', async () => {
      const sourceId = seedSource(ctx.db, { title: 'CISSP Bootcamp', sourceType: 'education' })
      const res = await apiRequest(ctx.app, 'POST', '/certifications', {
        name: 'CISSP',
        education_source_id: sourceId,
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.education_source_id).toBe(sourceId)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // GET /certifications (WithSkills variant)
  // ────────────────────────────────────────────────────────────────

  describe('GET /certifications', () => {
    test('returns empty list initially', async () => {
      const res = await apiRequest(ctx.app, 'GET', '/certifications')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toEqual([])
    })

    test('returns all certifications with hydrated skills array', async () => {
      const cisspRes = await apiRequest(ctx.app, 'POST', '/certifications', { name: 'CISSP' })
      const cissp = (await cisspRes.json()).data
      const pmpRes = await apiRequest(ctx.app, 'POST', '/certifications', { name: 'PMP' })
      const pmp = (await pmpRes.json()).data

      // Link skills directly in the DB (skill endpoints tested separately)
      const secSkill = seedSkill(ctx.db, { name: 'Security' })
      const pmSkill = seedSkill(ctx.db, { name: 'Project Management' })
      await apiRequest(ctx.app, 'POST', `/certifications/${cissp.id}/skills`, { skill_id: secSkill })
      await apiRequest(ctx.app, 'POST', `/certifications/${pmp.id}/skills`, { skill_id: pmSkill })

      const res = await apiRequest(ctx.app, 'GET', '/certifications')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      // Every row must have a skills array populated
      for (const cert of body.data) {
        expect(cert.skills).toBeInstanceOf(Array)
      }
      const byName = Object.fromEntries(body.data.map((c: any) => [c.name, c]))
      expect(byName['CISSP'].skills[0].name).toBe('Security')
      expect(byName['PMP'].skills[0].name).toBe('Project Management')
    })
  })

  // ────────────────────────────────────────────────────────────────
  // GET /certifications/:id (WithSkills)
  // ────────────────────────────────────────────────────────────────

  describe('GET /certifications/:id', () => {
    test('200 + WithSkills for existing cert', async () => {
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', { name: 'CISSP' })
      const created = (await createRes.json()).data

      const res = await apiRequest(ctx.app, 'GET', `/certifications/${created.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(created.id)
      expect(body.data.skills).toEqual([])
    })

    test('404 for unknown id', async () => {
      const res = await apiRequest(ctx.app, 'GET', `/certifications/${testUuid()}`)
      expect(res.status).toBe(404)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // PATCH /certifications/:id
  // ────────────────────────────────────────────────────────────────

  describe('PATCH /certifications/:id', () => {
    test('200 + updated data', async () => {
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', { name: 'Old' })
      const created = (await createRes.json()).data

      const res = await apiRequest(ctx.app, 'PATCH', `/certifications/${created.id}`, {
        name: 'New',
        issuer: 'Acme',
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.name).toBe('New')
      expect(body.data.issuer).toBe('Acme')
    })

    test('400 for empty name on update', async () => {
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', { name: 'Keep' })
      const created = (await createRes.json()).data

      const res = await apiRequest(ctx.app, 'PATCH', `/certifications/${created.id}`, {
        name: '   ',
      })
      expect(res.status).toBe(400)
    })

    test('400 for education_source_id pointing to non-education', async () => {
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', { name: 'Cert' })
      const created = (await createRes.json()).data
      const roleId = seedSource(ctx.db, { title: 'R', sourceType: 'role' })

      const res = await apiRequest(ctx.app, 'PATCH', `/certifications/${created.id}`, {
        education_source_id: roleId,
      })
      expect(res.status).toBe(400)
    })

    test('404 for unknown id', async () => {
      const res = await apiRequest(ctx.app, 'PATCH', `/certifications/${testUuid()}`, {
        name: 'x',
      })
      expect(res.status).toBe(404)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // DELETE /certifications/:id (with cascade)
  // ────────────────────────────────────────────────────────────────

  describe('DELETE /certifications/:id', () => {
    test('204 for existing cert', async () => {
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', { name: 'Temp' })
      const created = (await createRes.json()).data

      const res = await apiRequest(ctx.app, 'DELETE', `/certifications/${created.id}`)
      expect(res.status).toBe(204)

      const getRes = await apiRequest(ctx.app, 'GET', `/certifications/${created.id}`)
      expect(getRes.status).toBe(404)
    })

    test('404 for unknown id', async () => {
      const res = await apiRequest(ctx.app, 'DELETE', `/certifications/${testUuid()}`)
      expect(res.status).toBe(404)
    })

    test('cascade: deleting a cert removes its skill junction rows', async () => {
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', { name: 'CISSP' })
      const created = (await createRes.json()).data
      const skillId = seedSkill(ctx.db, { name: 'Security' })
      await apiRequest(ctx.app, 'POST', `/certifications/${created.id}/skills`, { skill_id: skillId })

      // Verify link exists
      const before = ctx.db
        .query('SELECT COUNT(*) AS c FROM certification_skills WHERE certification_id = ?')
        .get(created.id) as { c: number }
      expect(before.c).toBe(1)

      await apiRequest(ctx.app, 'DELETE', `/certifications/${created.id}`)

      const after = ctx.db
        .query('SELECT COUNT(*) AS c FROM certification_skills WHERE certification_id = ?')
        .get(created.id) as { c: number }
      expect(after.c).toBe(0)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // POST /certifications/:id/skills
  // ────────────────────────────────────────────────────────────────

  describe('POST /certifications/:id/skills', () => {
    test('200 + updated cert (with skills array) on valid link', async () => {
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', { name: 'CISSP' })
      const created = (await createRes.json()).data
      const skillId = seedSkill(ctx.db, { name: 'Security' })

      const res = await apiRequest(ctx.app, 'POST', `/certifications/${created.id}/skills`, {
        skill_id: skillId,
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(created.id)
      expect(body.data.skills).toHaveLength(1)
      expect(body.data.skills[0].id).toBe(skillId)
    })

    test('idempotent — second add returns same state', async () => {
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', { name: 'CISSP' })
      const created = (await createRes.json()).data
      const skillId = seedSkill(ctx.db, { name: 'Security' })

      await apiRequest(ctx.app, 'POST', `/certifications/${created.id}/skills`, { skill_id: skillId })
      const res = await apiRequest(ctx.app, 'POST', `/certifications/${created.id}/skills`, { skill_id: skillId })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.skills).toHaveLength(1)
    })

    test('400 when skill_id is missing from body', async () => {
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', { name: 'CISSP' })
      const created = (await createRes.json()).data

      const res = await apiRequest(ctx.app, 'POST', `/certifications/${created.id}/skills`, {})
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    test('404 for unknown certification id', async () => {
      const skillId = seedSkill(ctx.db, { name: 'Security' })
      const res = await apiRequest(ctx.app, 'POST', `/certifications/${testUuid()}/skills`, {
        skill_id: skillId,
      })
      expect(res.status).toBe(404)
    })

    test('404 for unknown skill id', async () => {
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', { name: 'CISSP' })
      const created = (await createRes.json()).data

      const res = await apiRequest(ctx.app, 'POST', `/certifications/${created.id}/skills`, {
        skill_id: testUuid(),
      })
      expect(res.status).toBe(404)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // DELETE /certifications/:id/skills/:skillId
  // ────────────────────────────────────────────────────────────────

  describe('DELETE /certifications/:id/skills/:skillId', () => {
    test('204 on successful unlink', async () => {
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', { name: 'CISSP' })
      const created = (await createRes.json()).data
      const skillId = seedSkill(ctx.db, { name: 'Security' })
      await apiRequest(ctx.app, 'POST', `/certifications/${created.id}/skills`, { skill_id: skillId })

      const res = await apiRequest(ctx.app, 'DELETE', `/certifications/${created.id}/skills/${skillId}`)
      expect(res.status).toBe(204)

      // Verify gone
      const getRes = await apiRequest(ctx.app, 'GET', `/certifications/${created.id}`)
      const body = await getRes.json()
      expect(body.data.skills).toEqual([])
    })

    test('idempotent — 204 when link does not exist', async () => {
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', { name: 'CISSP' })
      const created = (await createRes.json()).data
      const skillId = seedSkill(ctx.db, { name: 'Security' })

      const res = await apiRequest(ctx.app, 'DELETE', `/certifications/${created.id}/skills/${skillId}`)
      expect(res.status).toBe(204)
    })

    test('404 for unknown certification id', async () => {
      const skillId = seedSkill(ctx.db, { name: 'Security' })
      const res = await apiRequest(ctx.app, 'DELETE', `/certifications/${testUuid()}/skills/${skillId}`)
      expect(res.status).toBe(404)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Envelope shape
  // ────────────────────────────────────────────────────────────────

  describe('response envelope shape', () => {
    test('success response is {data: ...}', async () => {
      const res = await apiRequest(ctx.app, 'GET', '/certifications')
      const body = await res.json()
      expect(body).toHaveProperty('data')
      expect(body).not.toHaveProperty('error')
    })

    test('error response is {error: {code, message}}', async () => {
      const res = await apiRequest(ctx.app, 'GET', `/certifications/${testUuid()}`)
      const body = await res.json()
      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('code')
      expect(body.error).toHaveProperty('message')
      expect(body).not.toHaveProperty('data')
    })
  })
})
