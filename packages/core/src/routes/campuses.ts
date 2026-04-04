/**
 * Campus & Alias routes — sub-resources for organizations.
 */

import { Hono } from 'hono'
import type { Database } from 'bun:sqlite'
import * as CampusRepo from '../db/repositories/campus-repository'

export function campusRoutes(db: Database) {
  const app = new Hono()

  // ── Campuses ──────────────────────────────────────────────────────

  app.get('/organizations/:orgId/campuses', (c) => {
    const campuses = CampusRepo.listByOrg(db, c.req.param('orgId'))
    return c.json({ data: campuses })
  })

  app.post('/organizations/:orgId/campuses', async (c) => {
    const body = await c.req.json()
    const campus = CampusRepo.create(db, {
      organization_id: c.req.param('orgId'),
      name: body.name,
      modality: body.modality,
      address: body.address,
      city: body.city,
      state: body.state,
      zipcode: body.zipcode,
      country: body.country,
      is_headquarters: body.is_headquarters ? 1 : 0,
    })
    return c.json({ data: campus }, 201)
  })

  app.patch('/campuses/:id', async (c) => {
    const body = await c.req.json()
    const updated = CampusRepo.update(db, c.req.param('id'), {
      name: body.name,
      modality: body.modality,
      address: body.address,
      city: body.city,
      state: body.state,
      zipcode: body.zipcode,
      country: body.country,
      is_headquarters: body.is_headquarters !== undefined ? (body.is_headquarters ? 1 : 0) : undefined,
    })
    if (!updated) return c.json({ error: { code: 'NOT_FOUND', message: 'Campus not found' } }, 404)
    return c.json({ data: updated })
  })

  app.delete('/campuses/:id', (c) => {
    const deleted = CampusRepo.del(db, c.req.param('id'))
    if (!deleted) return c.json({ error: { code: 'NOT_FOUND', message: 'Campus not found' } }, 404)
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
