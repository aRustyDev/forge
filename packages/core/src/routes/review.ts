/**
 * Review queue route — pending bullets and perspectives.
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'

export function reviewRoutes(services: Services) {
  const app = new Hono()

  app.get('/review/pending', async (c) => {
    const result = await services.review.getPendingReview()
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  return app
}
