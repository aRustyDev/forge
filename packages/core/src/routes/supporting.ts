/**
 * Supporting entity routes — skills (thin HTTP layer over SkillService).
 *
 * As of Phase 89, the skill routes are serviced through `services.skills`,
 * which validates the SkillCategory enum and manages the skill_domains
 * junction for many-to-many skill↔domain linkage.
 */

import { Hono } from 'hono'
import type { Database } from 'bun:sqlite'
import type { Services } from '../services'
import { mapStatusCode } from './status-codes'

export function supportingRoutes(services: Services, _db?: Database) {
  const app = new Hono()

  app.post('/skills', async (c) => {
    const body = await c.req.json<{ name: string; category?: string; notes?: string | null }>()
    const result = services.skills.create(body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.get('/skills', (c) => {
    const filter: { category?: string; domain_id?: string } = {}
    if (c.req.query('category')) filter.category = c.req.query('category')!
    if (c.req.query('domain_id')) filter.domain_id = c.req.query('domain_id')!
    const result = services.skills.list(filter)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.get('/skills/:id', (c) => {
    const includeDomains = c.req.query('include') === 'domains'
    const result = includeDomains
      ? services.skills.getWithDomains(c.req.param('id'))
      : services.skills.get(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/skills/:id', async (c) => {
    const body = await c.req.json<{ name?: string; category?: string; notes?: string | null }>()
    const result = services.skills.update(c.req.param('id'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/skills/:id', (c) => {
    const result = services.skills.delete(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  // ── Skill ↔ Domain junction ─────────────────────────────────────────

  app.get('/skills/:id/domains', (c) => {
    const result = services.skills.getDomains(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.post('/skills/:id/domains', async (c) => {
    const body = await c.req.json<{ domain_id: string }>()
    if (!body.domain_id) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'domain_id is required' } }, 400)
    }
    const result = services.skills.addDomain(c.req.param('id'), body.domain_id)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  app.delete('/skills/:id/domains/:domainId', (c) => {
    const result = services.skills.removeDomain(c.req.param('id'), c.req.param('domainId'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  return app
}
