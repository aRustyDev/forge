/**
 * Answer bank routes — thin HTTP layer over AnswerBankService.
 *
 * GET    /profile/answers             — list all answer bank entries
 * PUT    /profile/answers             — upsert by field_kind
 * DELETE /profile/answers/:field_kind — delete by field_kind
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './status-codes'

export function answerBankRoutes(services: Services) {
  const app = new Hono()

  app.get('/profile/answers', async (c) => {
    const result = await services.answerBank.list()
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.put('/profile/answers', async (c) => {
    const body = await c.req.json()
    const result = await services.answerBank.upsert(body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/profile/answers/:field_kind', async (c) => {
    const fieldKind = decodeURIComponent(c.req.param('field_kind'))
    const result = await services.answerBank.delete(fieldKind)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  return app
}
