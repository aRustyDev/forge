/**
 * Organization routes — thin HTTP layer over OrganizationService.
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'

export function organizationRoutes(services: Services) {
  const app = new Hono()

  app.post('/organizations', async (c) => {
    const body = await c.req.json()
    const result = services.organizations.create(body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.get('/organizations', (c) => {
    const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0', 10) || 0)
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') ?? '50', 10) || 50))
    const filter: Record<string, string | number> = {}
    if (c.req.query('org_type')) filter.org_type = c.req.query('org_type')!
    if (c.req.query('tag')) filter.tag = c.req.query('tag')!
    if (c.req.query('worked') !== undefined && c.req.query('worked') !== null) {
      filter.worked = parseInt(c.req.query('worked')!, 10)
    }
    if (c.req.query('search')) filter.search = c.req.query('search')!
    if (c.req.query('status')) filter.status = c.req.query('status')!

    const result = services.organizations.list(filter, offset, limit)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data, pagination: result.pagination })
  })

  app.get('/organizations/:id', (c) => {
    const result = services.organizations.get(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/organizations/:id', async (c) => {
    const body = await c.req.json()
    const result = services.organizations.update(c.req.param('id'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/organizations/:id', (c) => {
    const result = services.organizations.delete(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  return app
}
