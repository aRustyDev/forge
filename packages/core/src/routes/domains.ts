/**
 * Domain routes — thin HTTP layer over DomainService.
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'

export function domainRoutes(services: Services) {
  const app = new Hono()

  app.post('/domains', async (c) => {
    const body = await c.req.json()
    const result = await services.domains.create(body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.get('/domains', async (c) => {
    const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0', 10) || 0)
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') ?? '50', 10) || 50))
    const result = await services.domains.list(offset, limit)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data, pagination: result.pagination })
  })

  app.get('/domains/:id', async (c) => {
    const result = await services.domains.get(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/domains/:id', async (c) => {
    const body = await c.req.json()
    const result = await services.domains.update(c.req.param('id'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/domains/:id', async (c) => {
    const result = await services.domains.delete(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  return app
}
