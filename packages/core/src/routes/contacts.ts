/**
 * Contact routes -- CRUD, relationship management, and reverse lookups.
 */

import { Hono } from 'hono'
import type { Database } from 'bun:sqlite'
import type { Services } from '../services'
import { mapStatusCode } from './server'

export function contactRoutes(services: Services, _db: Database) {
  const app = new Hono()

  // ── CRUD ──────────────────────────────────────────────────────────

  app.post('/contacts', async (c) => {
    const body = await c.req.json()
    const result = await services.contacts.create(body)
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.get('/contacts', async (c) => {
    const offset = Math.max(
      0,
      parseInt(c.req.query('offset') ?? '0', 10) || 0,
    )
    const limit = Math.min(
      200,
      Math.max(1, parseInt(c.req.query('limit') ?? '50', 10) || 50),
    )
    const filter: Record<string, string> = {}
    if (c.req.query('search')) filter.search = c.req.query('search')!
    if (c.req.query('organization_id'))
      filter.organization_id = c.req.query('organization_id')!

    const result = await services.contacts.list(filter, offset, limit)
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data, pagination: result.pagination })
  })

  app.get('/contacts/:id', async (c) => {
    const result = await services.contacts.get(c.req.param('id'))
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/contacts/:id', async (c) => {
    const body = await c.req.json()
    const result = await services.contacts.update(c.req.param('id'), body)
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/contacts/:id', async (c) => {
    const result = await services.contacts.delete(c.req.param('id'))
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  // ── Organization relationships ────────────────────────────────────

  app.get('/contacts/:id/organizations', async (c) => {
    const result = await services.contacts.listOrganizations(c.req.param('id'))
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.post('/contacts/:id/organizations', async (c) => {
    const body = await c.req.json()
    const result = await services.contacts.linkOrganization(
      c.req.param('id'),
      body.organization_id,
      body.relationship,
    )
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 201)
  })

  app.delete('/contacts/:contactId/organizations/:orgId/:relationship', async (c) => {
    const result = await services.contacts.unlinkOrganization(
      c.req.param('contactId'),
      c.req.param('orgId'),
      c.req.param('relationship'),
    )
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  // ── Job Description relationships ─────────────────────────────────

  app.get('/contacts/:id/job-descriptions', async (c) => {
    const result = await services.contacts.listJobDescriptions(c.req.param('id'))
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.post('/contacts/:id/job-descriptions', async (c) => {
    const body = await c.req.json()
    const result = await services.contacts.linkJobDescription(
      c.req.param('id'),
      body.job_description_id,
      body.relationship,
    )
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 201)
  })

  app.delete('/contacts/:contactId/job-descriptions/:jdId/:relationship', async (c) => {
    const result = await services.contacts.unlinkJobDescription(
      c.req.param('contactId'),
      c.req.param('jdId'),
      c.req.param('relationship'),
    )
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  // ── Resume relationships ──────────────────────────────────────────

  app.get('/contacts/:id/resumes', async (c) => {
    const result = await services.contacts.listResumes(c.req.param('id'))
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.post('/contacts/:id/resumes', async (c) => {
    const body = await c.req.json()
    const result = await services.contacts.linkResume(
      c.req.param('id'),
      body.resume_id,
      body.relationship,
    )
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 201)
  })

  app.delete('/contacts/:contactId/resumes/:resumeId/:relationship', async (c) => {
    const result = await services.contacts.unlinkResume(
      c.req.param('contactId'),
      c.req.param('resumeId'),
      c.req.param('relationship'),
    )
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  return app
}
