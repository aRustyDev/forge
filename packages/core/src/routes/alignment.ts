/**
 * Alignment routes — JD↔Resume scoring and requirement matching.
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './status-codes'
import { STRONG_THRESHOLD_DEFAULT, ADJACENT_THRESHOLD_DEFAULT } from '../types'

export function alignmentRoutes(services: Services) {
  const app = new Hono()

  // GET /alignment/score?jd_id=X&resume_id=Y&strong_threshold=0.75&adjacent_threshold=0.50
  app.get('/alignment/score', async (c) => {
    if (!services.embedding) {
      return c.json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Embedding service is not available',
        },
      }, 503)
    }

    const jdId = c.req.query('jd_id')
    const resumeId = c.req.query('resume_id')

    if (!jdId || !resumeId) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Both jd_id and resume_id query parameters are required',
        },
      }, 400)
    }

    const strongThreshold = parseFloat(
      c.req.query('strong_threshold') ?? String(STRONG_THRESHOLD_DEFAULT),
    )
    const adjacentThreshold = parseFloat(
      c.req.query('adjacent_threshold') ?? String(ADJACENT_THRESHOLD_DEFAULT),
    )

    // Validate thresholds
    if (isNaN(strongThreshold) || isNaN(adjacentThreshold)) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Thresholds must be valid numbers',
        },
      }, 400)
    }

    if (strongThreshold < 0 || strongThreshold > 1 || adjacentThreshold < 0 || adjacentThreshold > 1) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Thresholds must be between 0.0 and 1.0',
        },
      }, 400)
    }

    if (strongThreshold <= adjacentThreshold) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `strong_threshold (${strongThreshold}) must be greater than adjacent_threshold (${adjacentThreshold})`,
        },
      }, 400)
    }

    const result = await services.embedding.alignResume(jdId, resumeId, {
      strong_threshold: strongThreshold,
      adjacent_threshold: adjacentThreshold,
    })

    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  // GET /alignment/match?jd_id=X&entity_type=perspective&threshold=0.50&limit=10
  app.get('/alignment/match', async (c) => {
    if (!services.embedding) {
      return c.json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Embedding service is not available',
        },
      }, 503)
    }

    const jdId = c.req.query('jd_id')
    const entityType = c.req.query('entity_type')

    if (!jdId) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'jd_id query parameter is required',
        },
      }, 400)
    }

    if (!entityType || !['bullet', 'perspective'].includes(entityType)) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'entity_type must be "bullet" or "perspective"',
        },
      }, 400)
    }

    const threshold = parseFloat(c.req.query('threshold') ?? '0.50')
    const limit = parseInt(c.req.query('limit') ?? '10', 10)

    if (isNaN(threshold) || threshold < 0 || threshold > 1) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'threshold must be a number between 0.0 and 1.0',
        },
      }, 400)
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'limit must be an integer between 1 and 100',
        },
      }, 400)
    }

    const result = await services.embedding.matchRequirements(
      jdId,
      entityType as 'bullet' | 'perspective',
      { threshold, limit },
    )

    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  return app
}
