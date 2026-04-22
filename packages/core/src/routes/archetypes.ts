/**
 * Archetype routes — CRUD + domain association management.
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'

export function archetypeRoutes(services: Services) {
  const app = new Hono()

  app.post('/archetypes', async (c) => {
    const body = await c.req.json()
    const result = await services.archetypes.create(body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.get('/archetypes', async (c) => {
    const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0', 10) || 0)
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') ?? '50', 10) || 50))
    const result = await services.archetypes.list(offset, limit)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data, pagination: result.pagination })
  })

  app.get('/archetypes/:id', async (c) => {
    const result = await services.archetypes.getWithDomains(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/archetypes/:id', async (c) => {
    const body = await c.req.json()
    const result = await services.archetypes.update(c.req.param('id'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/archetypes/:id', async (c) => {
    const result = await services.archetypes.delete(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  // ── Domain associations ────────────────────────────────────────────

  app.get('/archetypes/:id/domains', async (c) => {
    const result = await services.archetypes.listDomains(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.post('/archetypes/:id/domains', async (c) => {
    const body = await c.req.json<{ domain_id: string }>()
    const result = await services.archetypes.addDomain(c.req.param('id'), body.domain_id)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: null }, 201)
  })

  app.delete('/archetypes/:id/domains/:domainId', async (c) => {
    const result = await services.archetypes.removeDomain(
      c.req.param('id'),
      c.req.param('domainId'),
    )
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  return app
}
