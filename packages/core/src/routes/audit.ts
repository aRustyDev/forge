/**
 * Audit routes — chain tracing and integrity checking.
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'

export function auditRoutes(services: Services) {
  const app = new Hono()

  app.get('/audit/chain/:perspectiveId', (c) => {
    const result = services.audit.traceChain(c.req.param('perspectiveId'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.get('/audit/integrity/:perspectiveId', (c) => {
    const result = services.audit.checkIntegrity(c.req.param('perspectiveId'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  return app
}
