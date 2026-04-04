/**
 * Supporting entity routes — organizations, skills.
 *
 * Employer and project routes removed in Phase 11: those tables were
 * replaced by the organizations table and source_projects extension.
 * Full organization/note routes will be added in Phase 12.
 */

import { Hono } from 'hono'
import type { Database } from 'bun:sqlite'
import type { Services } from '../services'
import * as SkillRepo from '../db/repositories/skill-repository'

export function supportingRoutes(services: Services, db?: Database) {
  const app = new Hono()

  // Skills

  /** Capitalize first character only, preserve rest (SAFe stays SAFe, foo→Foo). */
  function capitalizeFirst(s: string): string {
    if (!s) return s
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  app.post('/skills', async (c) => {
    const body = await c.req.json<{ name: string; category?: string }>()
    if (!body.name || body.name.trim().length === 0) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }, 400)
    }
    const skill = SkillRepo.create(getDb(), {
      ...body,
      name: capitalizeFirst(body.name.trim()),
    })
    return c.json({ data: skill }, 201)
  })

  app.get('/skills', (c) => {
    const filter: Record<string, string> = {}
    if (c.req.query('category')) filter.category = c.req.query('category')!
    const skills = SkillRepo.list(getDb(), filter)
    return c.json({ data: skills })
  })

  app.get('/skills/:id', (c) => {
    const skill = SkillRepo.get(getDb(), c.req.param('id'))
    if (!skill) return c.json({ error: { code: 'NOT_FOUND', message: 'Skill not found' } }, 404)
    return c.json({ data: skill })
  })

  app.patch('/skills/:id', async (c) => {
    const body = await c.req.json<{ name?: string; category?: string }>()
    const input: { name?: string; category?: string } = {}
    if (body.name !== undefined) {
      if (body.name.trim().length === 0) {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }, 400)
      }
      input.name = capitalizeFirst(body.name.trim())
    }
    if (body.category !== undefined) input.category = body.category
    const skill = SkillRepo.update(getDb(), c.req.param('id'), input)
    if (!skill) return c.json({ error: { code: 'NOT_FOUND', message: 'Skill not found' } }, 404)
    return c.json({ data: skill })
  })

  app.delete('/skills/:id', (c) => {
    SkillRepo.del(getDb(), c.req.param('id'))
    return c.body(null, 204)
  })

  return app

  // Helper to get db — uses the db passed into the factory, or extracts from env
  function getDb(): Database {
    if (db) return db
    // Fallback: this should never happen if createAppWithDb is used
    throw new Error('Database not available in supporting routes')
  }
}
