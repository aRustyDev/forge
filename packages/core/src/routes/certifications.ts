/**
 * Certification routes — thin HTTP layer over CertificationService.
 *
 * Introduced by Phase 86 T86.2 as part of the Qualifications track.
 *
 * Endpoints:
 *   GET    /certifications                           List all (with skills)
 *   GET    /certifications/:id                       Get by ID (with skills)
 *   POST   /certifications                           Create
 *   PATCH  /certifications/:id                       Partial update
 *   DELETE /certifications/:id                       Delete (cascades to skill links)
 *   POST   /certifications/:id/skills                Add skill link (body: {skill_id})
 *   DELETE /certifications/:id/skills/:skillId       Remove skill link
 *
 * All list/get responses use the WithSkills variant — callers always get
 * the full populated skills array without having to make a second request.
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'

export function certificationRoutes(services: Services) {
  const app = new Hono()

  app.post('/certifications', async (c) => {
    const body = await c.req.json()
    const result = await services.certifications.create(body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.get('/certifications', async (c) => {
    const result = await services.certifications.listWithSkills()
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  // ── Skill junction endpoints (must be registered BEFORE /:id catch-all) ──

  app.post('/certifications/:id/skills', async (c) => {
    const body = await c.req.json<{ skill_id?: string }>()
    if (!body.skill_id) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'skill_id is required' } },
        400,
      )
    }
    const certId = c.req.param('id')
    const linkResult = await services.certifications.addSkill(certId, body.skill_id)
    if (!linkResult.ok) {
      return c.json({ error: linkResult.error }, mapStatusCode(linkResult.error.code))
    }
    // Return the hydrated cert so callers see the updated skills array
    const result = await services.certifications.getWithSkills(certId)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/certifications/:id/skills/:skillId', async (c) => {
    const result = await services.certifications.removeSkill(
      c.req.param('id'),
      c.req.param('skillId'),
    )
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  app.get('/certifications/:id', async (c) => {
    const result = await services.certifications.getWithSkills(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/certifications/:id', async (c) => {
    const body = await c.req.json()
    const result = await services.certifications.update(c.req.param('id'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/certifications/:id', async (c) => {
    const result = await services.certifications.delete(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  return app
}
