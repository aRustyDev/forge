/**
 * Profile routes — thin HTTP layer over ProfileService.
 *
 * GET  /profile    — returns the single user profile
 * PATCH /profile   — updates profile fields (partial patch)
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'

export function profileRoutes(services: Services) {
  const app = new Hono()

  app.get('/profile', async (c) => {
    const result = await services.profile.getProfile()
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  // Note: c.req.json() will throw if the request body is empty or not valid JSON.
  // This is consistent with the existing pattern across all PATCH routes in the codebase.
  app.patch('/profile', async (c) => {
    const body = await c.req.json()
    const result = await services.profile.updateProfile(body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  return app
}
