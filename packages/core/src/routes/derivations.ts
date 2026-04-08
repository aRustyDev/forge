/**
 * Derivation routes — prepare/commit protocol for AI-driven bullet and perspective derivation.
 *
 * POST /derivations/prepare        — acquire lock, render prompt, return derivation context
 * POST /derivations/:id/commit     — validate LLM response, write entities, release lock
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './status-codes'

export function derivationRoutes(services: Services) {
  const app = new Hono()

  /**
   * POST /derivations/prepare
   *
   * Body: { entity_type: "source"|"bullet", entity_id: string, client_id: string, params?: {archetype, domain, framing} }
   * Response: { data: { derivation_id, prompt, snapshot, instructions, expires_at } }
   */
  app.post('/derivations/prepare', async (c) => {
    const body = await c.req.json<{
      entity_type: string
      entity_id: string
      client_id: string
      params?: { archetype: string; domain: string; framing: string }
    }>()

    const { entity_type, entity_id, client_id, params } = body

    // Validate required fields
    if (!entity_type || !['source', 'bullet'].includes(entity_type)) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'entity_type must be "source" or "bullet"',
        },
      }, 400)
    }

    if (!entity_id?.trim()) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'entity_id is required',
        },
      }, 400)
    }

    if (!client_id?.trim()) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'client_id is required',
        },
      }, 400)
    }

    if (entity_type === 'source') {
      const result = await services.derivation.prepareBulletDerivation(entity_id, client_id)
      if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
      return c.json({ data: result.data }, 201)
    }

    // entity_type === 'bullet'
    if (!params || !params.archetype?.trim() || !params.domain?.trim() || !params.framing?.trim()) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'params (archetype, domain, framing) are required for entity_type "bullet"',
        },
      }, 400)
    }

    const result = await services.derivation.preparePerspectiveDerivation(entity_id, params as any, client_id)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  /**
   * POST /derivations/:id/commit
   *
   * Body (bullet derivation):      { bullets: [{content, technologies, metrics}] }
   * Body (perspective derivation):  { content: string, reasoning: string }
   */
  app.post('/derivations/:id/commit', async (c) => {
    const derivationId = c.req.param('id')
    const body = await c.req.json<Record<string, unknown>>()

    if ('bullets' in body) {
      // Bullet derivation commit
      const result = await services.derivation.commitBulletDerivation(derivationId, body as any)
      if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
      return c.json({ data: result.data }, 201)
    }

    if ('content' in body && 'reasoning' in body) {
      // Perspective derivation commit
      const result = await services.derivation.commitPerspectiveDerivation(derivationId, body as any)
      if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
      return c.json({ data: result.data }, 201)
    }

    return c.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Body must contain either "bullets" (for bullet derivation) or "content" + "reasoning" (for perspective derivation)',
      },
    }, 400)
  })

  return app
}
