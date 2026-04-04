/**
 * Bullet routes — thin HTTP layer over BulletService and DerivationService.
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'

export function bulletRoutes(services: Services) {
  const app = new Hono()

  app.get('/bullets', (c) => {
    const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0', 10) || 0)
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') ?? '50', 10) || 50))
    const filter: Record<string, string> = {}
    if (c.req.query('source_id')) filter.source_id = c.req.query('source_id')!
    if (c.req.query('status')) filter.status = c.req.query('status')!
    if (c.req.query('technology')) filter.technology = c.req.query('technology')!

    const result = services.bullets.listBullets(filter, offset, limit)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data, pagination: result.pagination })
  })

  app.get('/bullets/:id', (c) => {
    const result = services.bullets.getBullet(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/bullets/:id', async (c) => {
    const body = await c.req.json()
    const result = services.bullets.updateBullet(c.req.param('id'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/bullets/:id', (c) => {
    const result = services.bullets.deleteBullet(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  app.patch('/bullets/:id/approve', (c) => {
    const result = services.bullets.approveBullet(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/bullets/:id/reject', async (c) => {
    const body = await c.req.json<{ rejection_reason?: string }>()
    const result = services.bullets.rejectBullet(c.req.param('id'), body.rejection_reason ?? '')
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/bullets/:id/reopen', (c) => {
    const result = services.bullets.reopenBullet(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.post('/bullets/:id/derive-perspectives', async (c) => {
    const body = await c.req.json<{ archetype: string; domain: string; framing: string }>()
    const result = await services.derivation.derivePerspectivesFromBullet(c.req.param('id'), {
      archetype: body.archetype,
      domain: body.domain,
      framing: body.framing as any,
    })
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  return app
}
