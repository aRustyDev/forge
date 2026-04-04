/**
 * Job description routes -- thin HTTP layer over JobDescriptionService.
 */

import { Hono } from 'hono'
import type { Database } from 'bun:sqlite'
import type { Services } from '../services'
import { mapStatusCode } from './server'
import {
  invokeClaude,
  renderJDSkillExtractionPrompt,
  JD_SKILL_EXTRACTION_TEMPLATE_VERSION,
  validateSkillExtraction,
} from '../ai'
import * as PromptLogRepo from '../db/repositories/prompt-log-repository'

export function jobDescriptionRoutes(services: Services, db: Database) {
  const app = new Hono()

  app.post('/job-descriptions', async (c) => {
    const body = await c.req.json()
    const result = services.jobDescriptions.create(body)
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.get('/job-descriptions', (c) => {
    const offset = Math.max(
      0,
      parseInt(c.req.query('offset') ?? '0', 10) || 0,
    )
    const limit = Math.min(
      200,
      Math.max(1, parseInt(c.req.query('limit') ?? '50', 10) || 50),
    )
    const filter: Record<string, string> = {}
    if (c.req.query('status')) filter.status = c.req.query('status')!
    if (c.req.query('organization_id'))
      filter.organization_id = c.req.query('organization_id')!

    const result = services.jobDescriptions.list(filter, offset, limit)
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data, pagination: result.pagination })
  })

  app.get('/job-descriptions/:id', (c) => {
    const result = services.jobDescriptions.get(c.req.param('id'))
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/job-descriptions/:id', async (c) => {
    const body = await c.req.json()
    const result = services.jobDescriptions.update(c.req.param('id'), body)
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/job-descriptions/:id', (c) => {
    const result = services.jobDescriptions.delete(c.req.param('id'))
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  // ── JD Skills ───────────────────────────────────────────────────────

  app.get('/job-descriptions/:id/skills', (c) => {
    const rows = db.query(
      `SELECT s.* FROM skills s
       JOIN job_description_skills jds ON jds.skill_id = s.id
       WHERE jds.job_description_id = ?
       ORDER BY s.name ASC`
    ).all(c.req.param('id'))
    return c.json({ data: rows })
  })

  app.post('/job-descriptions/:id/skills', async (c) => {
    const body = await c.req.json()
    const jdId = c.req.param('id')

    // If skill_id is provided, link existing skill
    if (body.skill_id) {
      try {
        db.run('INSERT OR IGNORE INTO job_description_skills (job_description_id, skill_id) VALUES (?, ?)',
          [jdId, body.skill_id])
      } catch (err: any) {
        if (err.message?.includes('FOREIGN KEY')) {
          return c.json({ error: { code: 'NOT_FOUND', message: 'Job description or skill not found' } }, 404)
        }
        throw err
      }
      const skill = db.query('SELECT * FROM skills WHERE id = ?').get(body.skill_id)
      return c.json({ data: skill }, 201)
    }

    // If name is provided, create new skill and link it
    if (body.name?.trim()) {
      const raw = body.name.trim()
      const name = raw.charAt(0).toUpperCase() + raw.slice(1)
      let skill = db.query('SELECT * FROM skills WHERE name = ? COLLATE NOCASE').get(name) as any
      if (!skill) {
        const id = crypto.randomUUID()
        skill = db.query(
          `INSERT INTO skills (id, name, category) VALUES (?, ?, ?) RETURNING *`
        ).get(id, name, body.category ?? 'general')
      }
      db.run('INSERT OR IGNORE INTO job_description_skills (job_description_id, skill_id) VALUES (?, ?)',
        [jdId, skill.id])
      return c.json({ data: skill }, 201)
    }

    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'skill_id or name is required' } }, 400)
  })

  app.delete('/job-descriptions/:jdId/skills/:skillId', (c) => {
    db.run(
      'DELETE FROM job_description_skills WHERE job_description_id = ? AND skill_id = ?',
      [c.req.param('jdId'), c.req.param('skillId')]
    )
    return c.body(null, 204)
  })

  // ── JD-Resume Linkage ─────────────────────────────────────────────

  app.get('/job-descriptions/:id/resumes', (c) => {
    const jdId = c.req.param('id')

    // Verify JD exists
    const jd = services.jobDescriptions.get(jdId)
    if (!jd.ok) return c.json({ error: jd.error }, mapStatusCode(jd.error.code))

    const rows = db
      .query(`
        SELECT r.id AS resume_id, r.name AS resume_name, r.target_role,
               r.target_employer, r.archetype, r.status,
               jdr.created_at, r.created_at AS resume_created_at
        FROM job_description_resumes jdr
        JOIN resumes r ON r.id = jdr.resume_id
        WHERE jdr.job_description_id = ?
        ORDER BY jdr.created_at DESC
      `)
      .all(jdId)

    return c.json({ data: rows })
  })

  app.post('/job-descriptions/:id/resumes', async (c) => {
    const jdId = c.req.param('id')
    const body = await c.req.json()
    const resumeId = body.resume_id

    if (!resumeId || typeof resumeId !== 'string') {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'resume_id is required' } },
        400,
      )
    }

    // Verify JD exists
    const jd = services.jobDescriptions.get(jdId)
    if (!jd.ok) return c.json({ error: jd.error }, mapStatusCode(jd.error.code))

    // Verify resume exists
    const resume = services.resumes.getResume(resumeId)
    if (!resume.ok) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } },
        404,
      )
    }

    // INSERT OR IGNORE for idempotent linking.
    // Use result.changes from db.run() return value -- NOT a separate
    // SELECT changes() query, which is unreliable under Bun's SQLite driver.
    const result = db.run(
      `INSERT OR IGNORE INTO job_description_resumes (job_description_id, resume_id) VALUES (?, ?)`,
      [jdId, resumeId],
    )

    // Fetch the link data (whether just created or already existed)
    const link = db
      .query(`
        SELECT r.id AS resume_id, r.name AS resume_name, r.target_role,
               r.target_employer, r.archetype, r.status,
               jdr.created_at, r.created_at AS resume_created_at
        FROM job_description_resumes jdr
        JOIN resumes r ON r.id = jdr.resume_id
        WHERE jdr.job_description_id = ? AND jdr.resume_id = ?
      `)
      .get(jdId, resumeId)

    // Determine status code: 201 if new, 200 if already existed
    const status = result.changes > 0 ? 201 : 200

    return c.json({ data: link }, status as any)
  })

  app.delete('/job-descriptions/:jdId/resumes/:resumeId', (c) => {
    const { jdId, resumeId } = c.req.param()

    db.run(
      `DELETE FROM job_description_resumes WHERE job_description_id = ? AND resume_id = ?`,
      [jdId, resumeId],
    )

    return c.body(null, 204)
  })

  // ── Contact reverse lookup ──────────────────────────────────────────
  app.get('/job-descriptions/:id/contacts', (c) => {
    const result = services.contacts.listByJobDescription(c.req.param('id'))
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  // ── JD Skill Extraction (AI) ──────────────────────────────────────
  // Returns suggested skills for frontend review. No skills are auto-
  // persisted -- the frontend must call POST /:id/skills for each
  // accepted skill individually (human review required).

  app.post('/job-descriptions/:id/extract-skills', async (c) => {
    const { id } = c.req.param()

    // 1. Fetch the JD
    const jdResult = services.jobDescriptions.get(id)
    if (!jdResult.ok) {
      return c.json({ error: jdResult.error }, mapStatusCode(jdResult.error.code))
    }
    const jd = jdResult.data

    // 2. Validate raw_text exists and is non-empty
    if (!jd.raw_text || jd.raw_text.trim().length === 0) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Job description has no text to extract skills from',
          },
        },
        400,
      )
    }

    // 3. Render prompt
    const prompt = renderJDSkillExtractionPrompt(jd.raw_text)

    // 4. Invoke Claude CLI
    const result = await invokeClaude({ prompt })

    // 5. Handle AI errors
    if (!result.ok) {
      // Log the failed attempt (best-effort -- logging failure must not
      // break the extraction response)
      try {
        PromptLogRepo.create(db, {
          entity_type: 'job_description',
          entity_id: id,
          prompt_template: JD_SKILL_EXTRACTION_TEMPLATE_VERSION,
          prompt_input: prompt,
          raw_response: result.rawResponse ?? '',
        })
      } catch (logErr) {
        console.error('[forge] Failed to log prompt error:', logErr)
      }

      return c.json(
        { error: { code: 'AI_ERROR', message: result.message } },
        502,
      )
    }

    // 6. Validate response
    const validated = validateSkillExtraction(result.data)
    if (!validated.ok) {
      try {
        PromptLogRepo.create(db, {
          entity_type: 'job_description',
          entity_id: id,
          prompt_template: JD_SKILL_EXTRACTION_TEMPLATE_VERSION,
          prompt_input: prompt,
          raw_response: result.rawResponse,
        })
      } catch (logErr) {
        console.error('[forge] Failed to log prompt validation error:', logErr)
      }

      return c.json(
        {
          error: {
            code: 'AI_ERROR',
            message: `Invalid AI response: ${validated.error}`,
          },
        },
        502,
      )
    }

    // 7. Log successful extraction (best-effort)
    // rawResponse may be undefined if the AI driver only returns parsed data.
    // Fall back to stringified result.data to satisfy the NOT NULL constraint.
    try {
      PromptLogRepo.create(db, {
        entity_type: 'job_description',
        entity_id: id,
        prompt_template: JD_SKILL_EXTRACTION_TEMPLATE_VERSION,
        prompt_input: prompt,
        raw_response: result.rawResponse ?? JSON.stringify(result.data) ?? '',
      })
    } catch (logErr) {
      console.error('[forge] Failed to log prompt success:', logErr)
    }

    // 8. Return extracted skills (NOT persisted -- user must accept individually)
    return c.json({
      ok: true,
      data: {
        skills: validated.data.skills,
        warnings: validated.warnings,
      },
    })
  })

  return app
}
