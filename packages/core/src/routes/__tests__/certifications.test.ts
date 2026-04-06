/**
 * Certification route acceptance tests (Phase 86 T86.2, updated for migration 041).
 *
 * Acceptance criteria from the phase plan:
 *   [x] All 7 routes implemented
 *   [x] Skill add/remove returns updated certification with skills
 *   [x] Proper cascade behavior (deleting cert removes skill links)
 *   [x] New fields: short_name, long_name, cert_id, issuer_id, credly_url, in_progress
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createTestApp, apiRequest, type TestContext } from './helpers'
import { seedSkill, testUuid } from '../../db/__tests__/helpers'

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
        short_name: 'CISSP',
        long_name: 'Certified Information Systems Security Professional',
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.id).toHaveLength(36)
      expect(body.data.short_name).toBe('CISSP')
      expect(body.data.long_name).toBe('Certified Information Systems Security Professional')
    })

    test('201 with all optional fields', async () => {
      const orgId = crypto.randomUUID()
      ctx.db.run('INSERT INTO organizations (id, name, org_type) VALUES (?, ?, ?)', [orgId, 'AWS', 'company'])

      const res = await apiRequest(ctx.app, 'POST', '/certifications', {
        short_name: 'AWS SA Pro',
        long_name: 'AWS Solutions Architect Professional',
        cert_id: 'SAA-C03',
        issuer_id: orgId,
        date_earned: '2024-01-15',
        expiry_date: '2027-01-15',
        credential_id: 'AWS-123456',
        credential_url: 'https://aws.amazon.com/verify/123456',
        credly_url: 'https://credly.com/badges/abc',
        in_progress: false,
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.issuer_id).toBe(orgId)
      expect(body.data.credential_id).toBe('AWS-123456')
      expect(body.data.credly_url).toBe('https://credly.com/badges/abc')
      expect(body.data.in_progress).toBe(false)
    })

    test('400 for empty short_name', async () => {
      const res = await apiRequest(ctx.app, 'POST', '/certifications', { short_name: '', long_name: 'Something' })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toContain('short_name')
    })

    test('400 for empty long_name', async () => {
      const res = await apiRequest(ctx.app, 'POST', '/certifications', { short_name: 'X', long_name: '' })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toContain('long_name')
    })

    test('400 for whitespace-only short_name', async () => {
      const res = await apiRequest(ctx.app, 'POST', '/certifications', { short_name: '   ', long_name: 'Something' })
      expect(res.status).toBe(400)
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
      const cisspRes = await apiRequest(ctx.app, 'POST', '/certifications', {
        short_name: 'CISSP',
        long_name: 'Certified Information Systems Security Professional',
      })
      const cissp = (await cisspRes.json()).data
      const pmpRes = await apiRequest(ctx.app, 'POST', '/certifications', {
        short_name: 'PMP',
        long_name: 'Project Management Professional',
      })
      const pmp = (await pmpRes.json()).data

      // Link skills
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
      const byName = Object.fromEntries(body.data.map((c: any) => [c.short_name, c]))
      expect(byName['CISSP'].skills[0].name).toBe('Security')
      expect(byName['PMP'].skills[0].name).toBe('Project Management')
    })
  })

  // ────────────────────────────────────────────────────────────────
  // GET /certifications/:id (WithSkills)
  // ────────────────────────────────────────────────────────────────

  describe('GET /certifications/:id', () => {
    test('200 + WithSkills for existing cert', async () => {
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', {
        short_name: 'CISSP',
        long_name: 'Certified Information Systems Security Professional',
      })
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
      const orgId = crypto.randomUUID()
      ctx.db.run('INSERT INTO organizations (id, name, org_type) VALUES (?, ?, ?)', [orgId, 'Acme', 'company'])

      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', {
        short_name: 'Old',
        long_name: 'Old Long Name',
      })
      const created = (await createRes.json()).data

      const res = await apiRequest(ctx.app, 'PATCH', `/certifications/${created.id}`, {
        short_name: 'New',
        issuer_id: orgId,
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.short_name).toBe('New')
      expect(body.data.issuer_id).toBe(orgId)
    })

    test('400 for empty short_name on update', async () => {
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', {
        short_name: 'Keep',
        long_name: 'Keep Long',
      })
      const created = (await createRes.json()).data

      const res = await apiRequest(ctx.app, 'PATCH', `/certifications/${created.id}`, {
        short_name: '   ',
      })
      expect(res.status).toBe(400)
    })

    test('404 for unknown id', async () => {
      const res = await apiRequest(ctx.app, 'PATCH', `/certifications/${testUuid()}`, {
        short_name: 'x',
      })
      expect(res.status).toBe(404)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // DELETE /certifications/:id (with cascade)
  // ────────────────────────────────────────────────────────────────

  describe('DELETE /certifications/:id', () => {
    test('204 for existing cert', async () => {
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', {
        short_name: 'Temp',
        long_name: 'Temporary',
      })
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
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', {
        short_name: 'CISSP',
        long_name: 'Certified Information Systems Security Professional',
      })
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
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', {
        short_name: 'CISSP',
        long_name: 'Certified Information Systems Security Professional',
      })
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
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', {
        short_name: 'CISSP',
        long_name: 'Certified Information Systems Security Professional',
      })
      const created = (await createRes.json()).data
      const skillId = seedSkill(ctx.db, { name: 'Security' })

      await apiRequest(ctx.app, 'POST', `/certifications/${created.id}/skills`, { skill_id: skillId })
      const res = await apiRequest(ctx.app, 'POST', `/certifications/${created.id}/skills`, { skill_id: skillId })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.skills).toHaveLength(1)
    })

    test('400 when skill_id is missing from body', async () => {
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', {
        short_name: 'CISSP',
        long_name: 'Certified Information Systems Security Professional',
      })
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
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', {
        short_name: 'CISSP',
        long_name: 'Certified Information Systems Security Professional',
      })
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
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', {
        short_name: 'CISSP',
        long_name: 'Certified Information Systems Security Professional',
      })
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
      const createRes = await apiRequest(ctx.app, 'POST', '/certifications', {
        short_name: 'CISSP',
        long_name: 'Certified Information Systems Security Professional',
      })
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
