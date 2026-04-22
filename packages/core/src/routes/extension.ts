/**
 * Extension routes — config + error logging for the browser extension.
 *
 * GET    /extension/config  — get full config
 * PUT    /extension/config  — update config keys
 * POST   /extension/log     — append error log
 * GET    /extension/logs    — list logs (paginated, filterable)
 * DELETE /extension/logs    — clear all logs
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './status-codes'

export function extensionRoutes(services: Services) {
  const app = new Hono()

  // -- Config ---------------------------------------------------------------

  app.get('/extension/config', (c) => {
    const result = services.extensionConfig.getAll()
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.put('/extension/config', async (c) => {
    const body = await c.req.json()
    if (!body.updates || typeof body.updates !== 'object') {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Body must contain an "updates" object' } },
        400,
      )
    }
    const result = services.extensionConfig.setMany(body.updates)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  // -- Logs -----------------------------------------------------------------

  app.post('/extension/log', async (c) => {
    const body = await c.req.json()
    const result = await services.extensionLogs.append(body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.get('/extension/logs', async (c) => {
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : undefined
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!, 10) : undefined
    const error_code = c.req.query('error_code') ?? undefined
    const layer = c.req.query('layer') ?? undefined

    const result = await services.extensionLogs.list({ limit, offset, error_code, layer })
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/extension/logs', async (c) => {
    const result = await services.extensionLogs.clear()
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  return app
}
