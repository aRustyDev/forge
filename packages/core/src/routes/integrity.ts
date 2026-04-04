/**
 * Integrity routes — content drift detection.
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'

export function integrityRoutes(services: Services) {
  const app = new Hono()

  app.get('/integrity/drift', (c) => {
    const result = services.integrity.getDriftedEntities()
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  return app
}
