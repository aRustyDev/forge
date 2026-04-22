/**
 * Org location & alias routes — sub-resources for organizations.
 *
 * Migration 047 renamed org_campuses → org_locations. Route paths are
 * updated to /organizations/:orgId/locations but campus paths are kept
 * as aliases for backward compatibility with existing SDK calls.
 */

import { Hono } from 'hono'
import type { Database } from 'bun:sqlite'
import type { Services } from '../services'
import { mapStatusCode } from './status-codes'

export function campusRoutes(services: Services, db: Database) {
  const app = new Hono()

  // ── Org Locations (formerly Campuses) ──────────────────────────────

  app.get('/organizations/:orgId/locations', async (c) => {
    const result = await services.orgLocations.listByOrg(c.req.param('orgId'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.post('/organizations/:orgId/locations', async (c) => {
    const body = await c.req.json()
    const result = await services.orgLocations.create({
      organization_id: c.req.param('orgId'),
      name: body.name,
      modality: body.modality,
      address_id: body.address_id,
      is_headquarters: body.is_headquarters,
    })
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.patch('/locations/:id', async (c) => {
    const body = await c.req.json()
    const result = await services.orgLocations.update(c.req.param('id'), {
      name: body.name,
      modality: body.modality,
      address_id: body.address_id,
      is_headquarters: body.is_headquarters,
    })
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/locations/:id', async (c) => {
    const result = await services.orgLocations.delete(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  // Backward-compat aliases (old /campuses paths)
  app.get('/organizations/:orgId/campuses', async (c) => {
    const result = await services.orgLocations.listByOrg(c.req.param('orgId'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.post('/organizations/:orgId/campuses', async (c) => {
    const body = await c.req.json()
    const result = await services.orgLocations.create({
      organization_id: c.req.param('orgId'),
      name: body.name,
      modality: body.modality,
      address_id: body.address_id,
      is_headquarters: body.is_headquarters,
    })
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.patch('/campuses/:id', async (c) => {
    const body = await c.req.json()
    const result = await services.orgLocations.update(c.req.param('id'), {
      name: body.name,
      modality: body.modality,
      address_id: body.address_id,
      is_headquarters: body.is_headquarters,
    })
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/campuses/:id', async (c) => {
    const result = await services.orgLocations.delete(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  // ── Aliases ───────────────────────────────────────────────────────

  app.get('/organizations/:orgId/aliases', (c) => {
    const rows = db.query('SELECT * FROM org_aliases WHERE organization_id = ? ORDER BY alias')
      .all(c.req.param('orgId')) as { id: string; organization_id: string; alias: string }[]
    return c.json({ data: rows })
  })

  app.post('/organizations/:orgId/aliases', async (c) => {
    const body = await c.req.json()
    if (!body.alias?.trim()) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Alias is required' } }, 400)
    const id = crypto.randomUUID()
    try {
      db.run('INSERT INTO org_aliases (id, organization_id, alias) VALUES (?, ?, ?)',
        [id, c.req.param('orgId'), body.alias.trim()])
      const row = db.query('SELECT * FROM org_aliases WHERE id = ?').get(id)
      return c.json({ data: row }, 201)
    } catch (err: any) {
      if (err.message?.includes('UNIQUE constraint')) {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Alias already exists for this organization' } }, 400)
      }
      throw err
    }
  })

  app.delete('/aliases/:id', (c) => {
    const result = db.run('DELETE FROM org_aliases WHERE id = ?', [c.req.param('id')])
    if (result.changes === 0) return c.json({ error: { code: 'NOT_FOUND', message: 'Alias not found' } }, 404)
    return c.body(null, 204)
  })

  return app
}
