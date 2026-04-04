/**
 * Perspective routes — thin HTTP layer over PerspectiveService.
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'

export function perspectiveRoutes(services: Services) {
  const app = new Hono()

  app.get('/perspectives', (c) => {
    const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0', 10) || 0)
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') ?? '50', 10) || 50))
    const filter: Record<string, string> = {}
    if (c.req.query('bullet_id')) filter.bullet_id = c.req.query('bullet_id')!
    if (c.req.query('target_archetype')) filter.target_archetype = c.req.query('target_archetype')!
    if (c.req.query('domain')) filter.domain = c.req.query('domain')!
    if (c.req.query('framing')) filter.framing = c.req.query('framing')!
    if (c.req.query('status')) filter.status = c.req.query('status')!
    if (c.req.query('source_id')) filter.source_id = c.req.query('source_id')!

    const result = services.perspectives.listPerspectives(filter, offset, limit)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data, pagination: result.pagination })
  })

  app.get('/perspectives/:id', (c) => {
    const result = services.perspectives.getPerspectiveWithChain(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/perspectives/:id', async (c) => {
    const body = await c.req.json()
    const result = services.perspectives.updatePerspective(c.req.param('id'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/perspectives/:id', (c) => {
    const result = services.perspectives.deletePerspective(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  app.patch('/perspectives/:id/approve', (c) => {
    const result = services.perspectives.approvePerspective(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/perspectives/:id/reject', async (c) => {
    const body = await c.req.json<{ rejection_reason?: string }>()
    const result = services.perspectives.rejectPerspective(c.req.param('id'), body.rejection_reason ?? '')
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/perspectives/:id/reopen', (c) => {
    const result = services.perspectives.reopenPerspective(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  return app
}
