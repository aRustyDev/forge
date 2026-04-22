/**
 * Credential routes — thin HTTP layer over CredentialService.
 *
 * Introduced by Phase 86 T86.1 as part of the Qualifications track.
 *
 * Endpoints:
 *   GET    /credentials              List all credentials
 *   GET    /credentials?type=clearance  Filter by credential_type
 *   GET    /credentials/:id          Get by ID
 *   POST   /credentials              Create
 *   PATCH  /credentials/:id          Partial update
 *   DELETE /credentials/:id          Delete
 *
 * All responses follow the standard {data} / {error} envelope. The route
 * layer does NO validation of its own — it delegates to
 * services.credentials and maps Result<T> error codes to HTTP statuses.
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'

export function credentialRoutes(services: Services) {
  const app = new Hono()

  app.post('/credentials', async (c) => {
    const body = await c.req.json()
    const result = await services.credentials.create(body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.get('/credentials', async (c) => {
    const typeFilter = c.req.query('type')
    const result = typeFilter
      ? await services.credentials.findByType(typeFilter)
      : await services.credentials.list()
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.get('/credentials/:id', async (c) => {
    const result = await services.credentials.get(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/credentials/:id', async (c) => {
    const body = await c.req.json()
    const result = await services.credentials.update(c.req.param('id'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/credentials/:id', async (c) => {
    const result = await services.credentials.delete(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  return app
}
