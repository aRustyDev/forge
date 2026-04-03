/**
 * Summary routes -- thin HTTP layer over SummaryService.
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'

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
    const filter: Record<string, number> = {}
    if (c.req.query('is_template') !== undefined && c.req.query('is_template') !== null) {
      const tmpl = parseInt(c.req.query('is_template')!, 10)
      if (!isNaN(tmpl)) {
        filter.is_template = tmpl
      }
    }

    const result = services.summaries.list(filter, offset, limit)
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

  app.get('/summaries/:id', (c) => {
    const result = services.summaries.get(c.req.param('id'))
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
