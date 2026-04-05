/**
 * Summary routes -- thin HTTP layer over SummaryService.
 *
 * Phase 91 additions:
 * - GET /summaries accepts ?industry_id, ?role_type_id, ?skill_id filters
 *   and ?sort_by=title|created_at|updated_at&direction=asc|desc
 * - GET /summaries/:id?include=relations hydrates industry/role_type/skills
 * - GET/POST/DELETE /summaries/:id/skills for keyword linkage
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'
import type {
  SummaryFilter,
  SummarySort,
  SummarySortBy,
  SortDirection,
} from '../db/repositories/summary-repository'

export function summaryRoutes(services: Services) {
  const app = new Hono()

  app.post('/summaries', async (c) => {
    const body = await c.req.json()
    const result = services.summaries.create(body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.get('/summaries', (c) => {
    const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0', 10) || 0)
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') ?? '50', 10) || 50))

    const filter: SummaryFilter = {}
    if (c.req.query('is_template') !== undefined && c.req.query('is_template') !== null) {
      const tmpl = parseInt(c.req.query('is_template')!, 10)
      if (!isNaN(tmpl)) {
        filter.is_template = tmpl
      }
    }
    if (c.req.query('industry_id')) filter.industry_id = c.req.query('industry_id')!
    if (c.req.query('role_type_id')) filter.role_type_id = c.req.query('role_type_id')!
    if (c.req.query('skill_id')) filter.skill_id = c.req.query('skill_id')!

    const sort: SummarySort = {}
    if (c.req.query('sort_by')) sort.sort_by = c.req.query('sort_by') as SummarySortBy
    if (c.req.query('direction')) sort.direction = c.req.query('direction') as SortDirection

    const result = services.summaries.list(filter, sort, offset, limit)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data, pagination: result.pagination })
  })

  // Toggle template — must be registered BEFORE /:id catch-all
  app.post('/summaries/:id/toggle-template', (c) => {
    const result = services.summaries.toggleTemplate(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  // Linked resumes — must be registered BEFORE /:id catch-all
  app.get('/summaries/:id/linked-resumes', (c) => {
    const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0', 10) || 0)
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') ?? '50', 10) || 50))

    const result = services.summaries.getLinkedResumes(c.req.param('id'), offset, limit)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data, pagination: result.pagination })
  })

  // ── Skill keyword junction (Phase 91) ───────────────────────────────
  // Registered BEFORE /:id catch-all.

  app.get('/summaries/:id/skills', (c) => {
    const result = services.summaries.getSkills(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.post('/summaries/:id/skills', async (c) => {
    const body = await c.req.json<{ skill_id: string }>()
    if (!body.skill_id) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'skill_id is required' } }, 400)
    }
    const result = services.summaries.addSkill(c.req.param('id'), body.skill_id)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  app.delete('/summaries/:id/skills/:skillId', (c) => {
    const result = services.summaries.removeSkill(c.req.param('id'), c.req.param('skillId'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  app.get('/summaries/:id', (c) => {
    const includeRelations = c.req.query('include') === 'relations'
    const result = includeRelations
      ? services.summaries.getWithRelations(c.req.param('id'))
      : services.summaries.get(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/summaries/:id', async (c) => {
    const body = await c.req.json()
    const result = services.summaries.update(c.req.param('id'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/summaries/:id', (c) => {
    const result = services.summaries.delete(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  app.post('/summaries/:id/clone', (c) => {
    const result = services.summaries.clone(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  return app
}
