/**
 * Job description routes -- thin HTTP layer over JobDescriptionService.
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'

export function jobDescriptionRoutes(services: Services) {
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

  return app
}
