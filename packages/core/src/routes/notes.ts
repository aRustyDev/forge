/**
 * Note routes — thin HTTP layer over NoteService.
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'

export function noteRoutes(services: Services) {
  const app = new Hono()

  app.post('/notes', async (c) => {
    const body = await c.req.json<{ title?: string; content: string }>()
    const result = await services.notes.create(body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.get('/notes', async (c) => {
    const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0', 10) || 0)
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') ?? '50', 10) || 50))
    const search = c.req.query('search')

    const result = await services.notes.list(search, offset, limit)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data, pagination: result.pagination })
  })

  app.get('/notes/:id', async (c) => {
    const result = await services.notes.get(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/notes/:id', async (c) => {
    const body = await c.req.json<{ title?: string; content?: string }>()
    const result = await services.notes.update(c.req.param('id'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/notes/:id', async (c) => {
    const result = await services.notes.delete(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  app.get('/notes/by-entity/:entityType/:entityId', async (c) => {
    const result = await services.notes.getNotesForEntity(
      c.req.param('entityType'),
      c.req.param('entityId'),
    )
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.post('/notes/:id/references', async (c) => {
    const body = await c.req.json<{ entity_type: string; entity_id: string }>()
    const result = await services.notes.addReference(c.req.param('id'), body.entity_type, body.entity_id)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: null }, 201)
  })

  app.delete('/notes/:id/references/:entityType/:entityId', async (c) => {
    const result = await services.notes.removeReference(
      c.req.param('id'),
      c.req.param('entityType'),
      c.req.param('entityId'),
    )
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  return app
}
