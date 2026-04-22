/**
 * Address routes — CRUD for shared address entities.
 *
 * GET    /addresses      — list all addresses
 * GET    /addresses/:id  — get single address
 * POST   /addresses      — create address
 * PATCH  /addresses/:id  — update address
 * DELETE /addresses/:id  — delete address (blocked if referenced)
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'

export function addressRoutes(services: Services) {
  const app = new Hono()

  app.get('/addresses', async (c) => {
    const offset = parseInt(c.req.query('offset') ?? '0', 10)
    const limit = parseInt(c.req.query('limit') ?? '50', 10)
    const result = await services.addresses.list(offset, limit)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data, pagination: result.pagination })
  })

  app.get('/addresses/:id', async (c) => {
    const result = await services.addresses.get(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.post('/addresses', async (c) => {
    const body = await c.req.json()
    const result = await services.addresses.create(body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.patch('/addresses/:id', async (c) => {
    const body = await c.req.json()
    const result = await services.addresses.update(c.req.param('id'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/addresses/:id', async (c) => {
    const result = await services.addresses.delete(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  return app
}
