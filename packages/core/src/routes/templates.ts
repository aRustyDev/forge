/**
 * Template routes -- thin HTTP layer over TemplateService.
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'

export function templateRoutes(services: Services) {
  const app = new Hono()

  // -- Template CRUD --------------------------------------------------------

  app.get('/templates', async (c) => {
    const result = await services.templates.list()
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.get('/templates/:id', async (c) => {
    const result = await services.templates.get(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.post('/templates', async (c) => {
    const body = await c.req.json()
    const result = await services.templates.create(body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.patch('/templates/:id', async (c) => {
    const body = await c.req.json()
    const result = await services.templates.update(c.req.param('id'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/templates/:id', async (c) => {
    const result = await services.templates.delete(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  return app
}
