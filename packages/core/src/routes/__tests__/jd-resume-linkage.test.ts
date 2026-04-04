/**
 * Tests for JD-resume linkage API endpoints.
 * Covers migration, JD-side endpoints, resume-side endpoint, cascades, and bidirectional verification.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createTestApp, apiRequest, type TestContext } from './helpers'
import {
  seedOrganization,
  seedJobDescription,
  seedResume,
} from '../../db/__tests__/helpers'

let ctx: TestContext

beforeEach(() => {
  ctx = createTestApp()
})

afterEach(() => {
  ctx.db.close()
})

describe('JD-Resume Linkage', () => {
  // ── Migration Tests ──────────────────────────────────────────────────

  describe('Migration 026', () => {
    test('creates job_description_resumes table', () => {
      const row = ctx.db
        .query(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='job_description_resumes'",
        )
        .get() as any
      expect(row).not.toBeNull()
      expect(row.name).toBe('job_description_resumes')
    })

    test('inserts valid link', () => {
      const jdId = seedJobDescription(ctx.db)
      const resumeId = seedResume(ctx.db)

      ctx.db.run(
        'INSERT INTO job_description_resumes (job_description_id, resume_id) VALUES (?, ?)',
        [jdId, resumeId],
      )

      const row = ctx.db
        .query(
          'SELECT * FROM job_description_resumes WHERE job_description_id = ? AND resume_id = ?',
        )
        .get(jdId, resumeId) as any
      expect(row).not.toBeNull()
      expect(row.job_description_id).toBe(jdId)
      expect(row.resume_id).toBe(resumeId)
    })

    test('rejects duplicate link with PRIMARY KEY error', () => {
      const jdId = seedJobDescription(ctx.db)
      const resumeId = seedResume(ctx.db)

      ctx.db.run(
        'INSERT INTO job_description_resumes (job_description_id, resume_id) VALUES (?, ?)',
        [jdId, resumeId],
      )

      expect(() =>
        ctx.db.run(
          'INSERT INTO job_description_resumes (job_description_id, resume_id) VALUES (?, ?)',
          [jdId, resumeId],
        ),
      ).toThrow()
    })

    test('INSERT OR IGNORE on duplicate does not error, changes = 0', () => {
      const jdId = seedJobDescription(ctx.db)
      const resumeId = seedResume(ctx.db)

      ctx.db.run(
        'INSERT INTO job_description_resumes (job_description_id, resume_id) VALUES (?, ?)',
        [jdId, resumeId],
      )

      const result = ctx.db.run(
        'INSERT OR IGNORE INTO job_description_resumes (job_description_id, resume_id) VALUES (?, ?)',
        [jdId, resumeId],
      )
      expect(result.changes).toBe(0)
    })

    test('cascade on JD delete removes junction rows, resume survives', () => {
      const jdId = seedJobDescription(ctx.db)
      const resumeId = seedResume(ctx.db)

      ctx.db.run(
        'INSERT INTO job_description_resumes (job_description_id, resume_id) VALUES (?, ?)',
        [jdId, resumeId],
      )

      ctx.db.run('DELETE FROM job_descriptions WHERE id = ?', [jdId])

      const junctionRow = ctx.db
        .query(
          'SELECT COUNT(*) AS cnt FROM job_description_resumes WHERE job_description_id = ?',
        )
        .get(jdId) as any
      expect(junctionRow.cnt).toBe(0)

      // Resume still exists
      const resumeRow = ctx.db
        .query('SELECT id FROM resumes WHERE id = ?')
        .get(resumeId) as any
      expect(resumeRow).not.toBeNull()
    })

    test('cascade on resume delete removes junction rows, JD survives', () => {
      const jdId = seedJobDescription(ctx.db)
      const resumeId = seedResume(ctx.db)

      ctx.db.run(
        'INSERT INTO job_description_resumes (job_description_id, resume_id) VALUES (?, ?)',
        [jdId, resumeId],
      )

      ctx.db.run('DELETE FROM resumes WHERE id = ?', [resumeId])

      const junctionRow = ctx.db
        .query(
          'SELECT COUNT(*) AS cnt FROM job_description_resumes WHERE resume_id = ?',
        )
        .get(resumeId) as any
      expect(junctionRow.cnt).toBe(0)

      // JD still exists
      const jdRow = ctx.db
        .query('SELECT id FROM job_descriptions WHERE id = ?')
        .get(jdId) as any
      expect(jdRow).not.toBeNull()
    })

    test('created_at defaults to UTC ISO-8601 timestamp', () => {
      const jdId = seedJobDescription(ctx.db)
      const resumeId = seedResume(ctx.db)

      ctx.db.run(
        'INSERT INTO job_description_resumes (job_description_id, resume_id) VALUES (?, ?)',
        [jdId, resumeId],
      )

      const row = ctx.db
        .query(
          'SELECT created_at FROM job_description_resumes WHERE job_description_id = ? AND resume_id = ?',
        )
        .get(jdId, resumeId) as any
      expect(row.created_at).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
      )
    })
  })

  // ── GET /job-descriptions/:id/resumes ────────────────────────────────

  describe('GET /job-descriptions/:id/resumes', () => {
    test('returns empty array for JD with no links', async () => {
      const jdId = seedJobDescription(ctx.db)
      const res = await apiRequest(
        ctx.app,
        'GET',
        `/job-descriptions/${jdId}/resumes`,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeArray()
      expect(body.data).toHaveLength(0)
    })

    test('returns linked resumes with JOINed fields', async () => {
      const jdId = seedJobDescription(ctx.db)
      const resumeId = seedResume(ctx.db, {
        name: 'My Resume',
        targetRole: 'Security Engineer',
        targetEmployer: 'Acme',
        archetype: 'devsecops',
      })

      ctx.db.run(
        'INSERT INTO job_description_resumes (job_description_id, resume_id) VALUES (?, ?)',
        [jdId, resumeId],
      )

      const res = await apiRequest(
        ctx.app,
        'GET',
        `/job-descriptions/${jdId}/resumes`,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].resume_id).toBe(resumeId)
      expect(body.data[0].resume_name).toBe('My Resume')
      expect(body.data[0].target_role).toBe('Security Engineer')
      expect(body.data[0].target_employer).toBe('Acme')
      expect(body.data[0].archetype).toBe('devsecops')
      expect(body.data[0].status).toBe('draft')
      expect(body.data[0].created_at).toBeTruthy()
      expect(body.data[0].resume_created_at).toBeTruthy()
    })

    test('results ordered by created_at DESC', async () => {
      const jdId = seedJobDescription(ctx.db)
      const r1 = seedResume(ctx.db, { name: 'First' })
      const r2 = seedResume(ctx.db, { name: 'Second' })

      // Insert r1 first, then r2
      ctx.db.run(
        "INSERT INTO job_description_resumes (job_description_id, resume_id, created_at) VALUES (?, ?, '2026-01-01T00:00:00Z')",
        [jdId, r1],
      )
      ctx.db.run(
        "INSERT INTO job_description_resumes (job_description_id, resume_id, created_at) VALUES (?, ?, '2026-01-02T00:00:00Z')",
        [jdId, r2],
      )

      const res = await apiRequest(
        ctx.app,
        'GET',
        `/job-descriptions/${jdId}/resumes`,
      )
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.data[0].resume_name).toBe('Second')
      expect(body.data[1].resume_name).toBe('First')
    })

    test('returns 404 for nonexistent JD', async () => {
      const res = await apiRequest(
        ctx.app,
        'GET',
        `/job-descriptions/${crypto.randomUUID()}/resumes`,
      )
      expect(res.status).toBe(404)
    })
  })

  // ── POST /job-descriptions/:id/resumes ───────────────────────────────

  describe('POST /job-descriptions/:id/resumes', () => {
    test('returns 201 on new link with ResumeLink data', async () => {
      const jdId = seedJobDescription(ctx.db)
      const resumeId = seedResume(ctx.db, { name: 'Linked Resume' })

      const res = await apiRequest(
        ctx.app,
        'POST',
        `/job-descriptions/${jdId}/resumes`,
        { resume_id: resumeId },
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.resume_id).toBe(resumeId)
      expect(body.data.resume_name).toBe('Linked Resume')
      expect(body.data.created_at).toBeTruthy()
    })

    test('returns 200 on duplicate link (idempotent)', async () => {
      const jdId = seedJobDescription(ctx.db)
      const resumeId = seedResume(ctx.db)

      await apiRequest(ctx.app, 'POST', `/job-descriptions/${jdId}/resumes`, {
        resume_id: resumeId,
      })

      const res = await apiRequest(
        ctx.app,
        'POST',
        `/job-descriptions/${jdId}/resumes`,
        { resume_id: resumeId },
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.resume_id).toBe(resumeId)
    })

    test('returns 400 when resume_id is missing', async () => {
      const jdId = seedJobDescription(ctx.db)

      const res = await apiRequest(
        ctx.app,
        'POST',
        `/job-descriptions/${jdId}/resumes`,
        {},
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    test('returns 404 for nonexistent resume', async () => {
      const jdId = seedJobDescription(ctx.db)

      const res = await apiRequest(
        ctx.app,
        'POST',
        `/job-descriptions/${jdId}/resumes`,
        { resume_id: crypto.randomUUID() },
      )
      expect(res.status).toBe(404)
    })

    test('returns 404 for nonexistent JD', async () => {
      const resumeId = seedResume(ctx.db)

      const res = await apiRequest(
        ctx.app,
        'POST',
        `/job-descriptions/${crypto.randomUUID()}/resumes`,
        { resume_id: resumeId },
      )
      expect(res.status).toBe(404)
    })
  })

  // ── DELETE /job-descriptions/:jdId/resumes/:resumeId ─────────────────

  describe('DELETE /job-descriptions/:jdId/resumes/:resumeId', () => {
    test('returns 204 for existing link', async () => {
      const jdId = seedJobDescription(ctx.db)
      const resumeId = seedResume(ctx.db)

      ctx.db.run(
        'INSERT INTO job_description_resumes (job_description_id, resume_id) VALUES (?, ?)',
        [jdId, resumeId],
      )

      const res = await apiRequest(
        ctx.app,
        'DELETE',
        `/job-descriptions/${jdId}/resumes/${resumeId}`,
      )
      expect(res.status).toBe(204)

      // Verify removed
      const row = ctx.db
        .query(
          'SELECT COUNT(*) AS cnt FROM job_description_resumes WHERE job_description_id = ? AND resume_id = ?',
        )
        .get(jdId, resumeId) as any
      expect(row.cnt).toBe(0)
    })

    test('returns 204 for nonexistent link (idempotent)', async () => {
      const res = await apiRequest(
        ctx.app,
        'DELETE',
        `/job-descriptions/${crypto.randomUUID()}/resumes/${crypto.randomUUID()}`,
      )
      expect(res.status).toBe(204)
    })
  })

  // ── GET /resumes/:id/job-descriptions ────────────────────────────────

  describe('GET /resumes/:id/job-descriptions', () => {
    test('returns empty array for resume with no links', async () => {
      const resumeId = seedResume(ctx.db)
      const res = await apiRequest(
        ctx.app,
        'GET',
        `/resumes/${resumeId}/job-descriptions`,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeArray()
      expect(body.data).toHaveLength(0)
    })

    test('returns linked JDs with JOINed fields', async () => {
      const orgId = seedOrganization(ctx.db, { name: 'Anthropic' })
      const jdId = seedJobDescription(ctx.db, {
        title: 'Security Engineer',
        organizationId: orgId,
        location: 'Remote',
        salaryRange: '$150k-$200k',
      })
      const resumeId = seedResume(ctx.db)

      ctx.db.run(
        'INSERT INTO job_description_resumes (job_description_id, resume_id) VALUES (?, ?)',
        [jdId, resumeId],
      )

      const res = await apiRequest(
        ctx.app,
        'GET',
        `/resumes/${resumeId}/job-descriptions`,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].job_description_id).toBe(jdId)
      expect(body.data[0].title).toBe('Security Engineer')
      expect(body.data[0].organization_name).toBe('Anthropic')
      expect(body.data[0].status).toBe('interested')
      expect(body.data[0].location).toBe('Remote')
      expect(body.data[0].salary_range).toBe('$150k-$200k')
      expect(body.data[0].created_at).toBeTruthy()
      expect(body.data[0].jd_created_at).toBeTruthy()
    })

    test('organization_name is null when JD has no org (LEFT JOIN)', async () => {
      const jdId = seedJobDescription(ctx.db, { title: 'No Org JD' })
      const resumeId = seedResume(ctx.db)

      ctx.db.run(
        'INSERT INTO job_description_resumes (job_description_id, resume_id) VALUES (?, ?)',
        [jdId, resumeId],
      )

      const res = await apiRequest(
        ctx.app,
        'GET',
        `/resumes/${resumeId}/job-descriptions`,
      )
      const body = await res.json()
      expect(body.data[0].organization_name).toBeNull()
    })

    test('results ordered by created_at DESC', async () => {
      const resumeId = seedResume(ctx.db)
      const jd1 = seedJobDescription(ctx.db, { title: 'First JD' })
      const jd2 = seedJobDescription(ctx.db, { title: 'Second JD' })

      ctx.db.run(
        "INSERT INTO job_description_resumes (job_description_id, resume_id, created_at) VALUES (?, ?, '2026-01-01T00:00:00Z')",
        [jd1, resumeId],
      )
      ctx.db.run(
        "INSERT INTO job_description_resumes (job_description_id, resume_id, created_at) VALUES (?, ?, '2026-01-02T00:00:00Z')",
        [jd2, resumeId],
      )

      const res = await apiRequest(
        ctx.app,
        'GET',
        `/resumes/${resumeId}/job-descriptions`,
      )
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.data[0].title).toBe('Second JD')
      expect(body.data[1].title).toBe('First JD')
    })

    test('returns 404 for nonexistent resume', async () => {
      const res = await apiRequest(
        ctx.app,
        'GET',
        `/resumes/${crypto.randomUUID()}/job-descriptions`,
      )
      expect(res.status).toBe(404)
    })
  })

  // ── Integration / Bidirectional Tests ────────────────────────────────

  describe('Bidirectional verification', () => {
    test('link via JD side appears on both sides', async () => {
      const jdId = seedJobDescription(ctx.db, { title: 'Target JD' })
      const resumeId = seedResume(ctx.db, { name: 'Target Resume' })

      // Link via JD side
      const linkRes = await apiRequest(
        ctx.app,
        'POST',
        `/job-descriptions/${jdId}/resumes`,
        { resume_id: resumeId },
      )
      expect(linkRes.status).toBe(201)

      // Verify on JD side
      const jdSide = await apiRequest(
        ctx.app,
        'GET',
        `/job-descriptions/${jdId}/resumes`,
      )
      const jdBody = await jdSide.json()
      expect(jdBody.data).toHaveLength(1)
      expect(jdBody.data[0].resume_id).toBe(resumeId)

      // Verify on resume side
      const resumeSide = await apiRequest(
        ctx.app,
        'GET',
        `/resumes/${resumeId}/job-descriptions`,
      )
      const resumeBody = await resumeSide.json()
      expect(resumeBody.data).toHaveLength(1)
      expect(resumeBody.data[0].job_description_id).toBe(jdId)
    })

    test('unlink removes from both sides', async () => {
      const jdId = seedJobDescription(ctx.db)
      const resumeId = seedResume(ctx.db)

      // Link
      await apiRequest(
        ctx.app,
        'POST',
        `/job-descriptions/${jdId}/resumes`,
        { resume_id: resumeId },
      )

      // Unlink
      const unlinkRes = await apiRequest(
        ctx.app,
        'DELETE',
        `/job-descriptions/${jdId}/resumes/${resumeId}`,
      )
      expect(unlinkRes.status).toBe(204)

      // Verify removed from JD side
      const jdSide = await apiRequest(
        ctx.app,
        'GET',
        `/job-descriptions/${jdId}/resumes`,
      )
      const jdBody = await jdSide.json()
      expect(jdBody.data).toHaveLength(0)

      // Verify removed from resume side
      const resumeSide = await apiRequest(
        ctx.app,
        'GET',
        `/resumes/${resumeId}/job-descriptions`,
      )
      const resumeBody = await resumeSide.json()
      expect(resumeBody.data).toHaveLength(0)
    })

    test('cascade on JD delete cleans up links, resume survives', async () => {
      const jdId = seedJobDescription(ctx.db)
      const resumeId = seedResume(ctx.db)

      await apiRequest(
        ctx.app,
        'POST',
        `/job-descriptions/${jdId}/resumes`,
        { resume_id: resumeId },
      )

      // Delete JD
      await apiRequest(ctx.app, 'DELETE', `/job-descriptions/${jdId}`)

      // Resume still exists
      const resumeRes = await apiRequest(
        ctx.app,
        'GET',
        `/resumes/${resumeId}`,
      )
      expect(resumeRes.status).toBe(200)

      // No linked JDs
      const linkedJds = await apiRequest(
        ctx.app,
        'GET',
        `/resumes/${resumeId}/job-descriptions`,
      )
      const body = await linkedJds.json()
      expect(body.data).toHaveLength(0)
    })

    test('cascade on resume delete cleans up links, JD survives', async () => {
      const jdId = seedJobDescription(ctx.db)
      const resumeId = seedResume(ctx.db)

      await apiRequest(
        ctx.app,
        'POST',
        `/job-descriptions/${jdId}/resumes`,
        { resume_id: resumeId },
      )

      // Delete resume
      await apiRequest(ctx.app, 'DELETE', `/resumes/${resumeId}`)

      // JD still exists
      const jdRes = await apiRequest(
        ctx.app,
        'GET',
        `/job-descriptions/${jdId}`,
      )
      expect(jdRes.status).toBe(200)

      // No linked resumes
      const linkedResumes = await apiRequest(
        ctx.app,
        'GET',
        `/job-descriptions/${jdId}/resumes`,
      )
      const body = await linkedResumes.json()
      expect(body.data).toHaveLength(0)
    })
  })
})
