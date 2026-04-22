/**
 * Industry routes — thin HTTP layer over IndustryService.
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'

export function industryRoutes(services: Services) {
  const app = new Hono()

  app.post('/industries', async (c) => {
    const body = await c.req.json()
    const result = await services.industries.create(body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.get('/industries', async (c) => {
    const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0', 10) || 0)
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') ?? '50', 10) || 50))
    const result = await services.industries.list(offset, limit)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data, pagination: result.pagination })
  })

  app.get('/industries/:id', async (c) => {
    const result = await services.industries.get(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/industries/:id', async (c) => {
    const body = await c.req.json()
    const result = await services.industries.update(c.req.param('id'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/industries/:id', async (c) => {
    const result = await services.industries.delete(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  return app
}
