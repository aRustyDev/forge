/**
 * Job description routes -- thin HTTP layer over JobDescriptionService.
 */

import { Hono } from 'hono'
import type { Database } from 'bun:sqlite'
import type { Services } from '../services'
import { mapStatusCode } from './server'

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

  // ── Contact reverse lookup ──────────────────────────────────────────
  app.get('/job-descriptions/:id/contacts', (c) => {
    const result = services.contacts.listByJobDescription(c.req.param('id'))
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  return app
}
