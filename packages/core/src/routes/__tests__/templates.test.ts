import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { createTestDb, seedResume, seedResumeSection, seedResumeTemplate } from '../../db/__tests__/helpers'
import { createServices } from '../../services'
import { createApp } from '../server'
import type { Database } from 'bun:sqlite'

describe('Template Routes', () => {
  let db: Database
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    db = createTestDb()
    const services = createServices(db)
    app = createApp(services, db)
  })

  afterEach(() => db.close())

  const json = (res: Response) => res.json()
  const req = (method: string, path: string, body?: unknown) =>
    app.request(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    })

  describe('GET /api/templates', () => {
    test('returns seeded built-in templates', async () => {
      const res = await req('GET', '/templates')
      expect(res.status).toBe(200)
      const { data } = await json(res)
      expect(data.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('GET /api/templates/:id', () => {
    test('returns template by id', async () => {
      const id = seedResumeTemplate(db, { name: 'Fetch Me' })
      const res = await req('GET', `/templates/${id}`)
      expect(res.status).toBe(200)
      const { data } = await json(res)
      expect(data.name).toBe('Fetch Me')
    })

    test('returns 404 for nonexistent', async () => {
      const res = await req('GET', '/templates/nonexistent')
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/templates', () => {
    test('creates template (201)', async () => {
      const res = await req('POST', '/templates', {
        name: 'New Template',
        sections: [{ title: 'Exp', entry_type: 'experience', position: 0 }],
      })
      expect(res.status).toBe(201)
      const { data } = await json(res)
      expect(data.name).toBe('New Template')
      expect(data.is_builtin).toBe(0)
    })

    test('rejects invalid entry_type (400)', async () => {
      const res = await req('POST', '/templates', {
        name: 'Bad',
        sections: [{ title: 'X', entry_type: 'invalid', position: 0 }],
      })
      expect(res.status).toBe(400)
    })
  })

  describe('PATCH /api/templates/:id', () => {
    test('updates template name', async () => {
      const id = seedResumeTemplate(db, { name: 'Old' })
      const res = await req('PATCH', `/templates/${id}`, { name: 'New' })
      expect(res.status).toBe(200)
      const { data } = await json(res)
      expect(data.name).toBe('New')
    })
  })

  describe('DELETE /api/templates/:id', () => {
    test('deletes user template (204)', async () => {
      const id = seedResumeTemplate(db)
      const res = await req('DELETE', `/templates/${id}`)
      expect(res.status).toBe(204)
    })

    test('rejects deleting built-in template (400)', async () => {
      const id = seedResumeTemplate(db, { isBuiltin: true })
      const res = await req('DELETE', `/templates/${id}`)
      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/resumes/:id/save-as-template', () => {
    test('creates template from resume sections (201)', async () => {
      const resumeId = seedResume(db)
      seedResumeSection(db, resumeId, 'Experience', 'experience', 0)
      seedResumeSection(db, resumeId, 'Skills', 'skills', 1)

      const res = await req('POST', `/resumes/${resumeId}/save-as-template`, {
        name: 'Saved Layout',
      })
      expect(res.status).toBe(201)
      const { data } = await json(res)
      expect(data.sections).toHaveLength(2)
    })
  })

  describe('POST /api/resumes (with template_id)', () => {
    test('creates resume with sections from template (201)', async () => {
      const templateId = seedResumeTemplate(db, {
        sections: [
          { title: 'Summary', entry_type: 'freeform', position: 0 },
          { title: 'Exp', entry_type: 'experience', position: 1 },
        ],
      })

      const res = await req('POST', '/resumes', {
        name: 'Templated Resume',
        target_role: 'Engineer',
        target_employer: 'Acme',
        archetype: 'test-arch',
        template_id: templateId,
      })
      expect(res.status).toBe(201)
      const { data } = await json(res)

      // Verify sections were created
      const sections = db
        .query('SELECT * FROM resume_sections WHERE resume_id = ? ORDER BY position')
        .all(data.id) as Array<{ title: string }>
      expect(sections).toHaveLength(2)
    })

    test('creates resume without template_id (backward compat)', async () => {
      const res = await req('POST', '/resumes', {
        name: 'No Template',
        target_role: 'Engineer',
        target_employer: 'Acme',
        archetype: 'test-arch',
      })
      expect(res.status).toBe(201)
      const { data } = await json(res)

      const sections = db
        .query('SELECT * FROM resume_sections WHERE resume_id = ?')
        .all(data.id) as Array<unknown>
      expect(sections).toHaveLength(0)
    })

    test('returns 404 for nonexistent template_id', async () => {
      const res = await req('POST', '/resumes', {
        name: 'Bad Template',
        target_role: 'Engineer',
        target_employer: 'Acme',
        archetype: 'test-arch',
        template_id: 'nonexistent-id-not-a-real-template',
      })
      expect(res.status).toBe(404)
    })
  })
})
