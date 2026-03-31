import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { ForgeClient } from '../client'
import { createTestDb, seedResumeTemplate, seedResume, seedResumeSection } from '../../../core/src/db/__tests__/helpers'
import { createServices } from '../../../core/src/services'
import { createApp } from '../../../core/src/routes/server'
import type { Database } from 'bun:sqlite'

describe('SDK TemplatesResource', () => {
  let db: Database
  let client: ForgeClient
  let server: ReturnType<typeof Bun.serve>

  beforeEach(async () => {
    db = createTestDb()
    const services = createServices(db)
    const app = createApp(services, db)
    server = Bun.serve({ port: 0, fetch: app.fetch })
    client = new ForgeClient({ baseUrl: `http://localhost:${server.port}` })
  })

  afterEach(() => { server.stop(); db.close() })

  test('list returns built-in templates with is_builtin as boolean', async () => {
    const result = await client.templates.list()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.length).toBeGreaterThanOrEqual(3)
      const builtin = result.data.find(t => t.name === 'Standard Tech Resume')
      expect(builtin).toBeDefined()
      expect(builtin!.is_builtin).toBe(true)
      expect(typeof builtin!.is_builtin).toBe('boolean')
    }
  })

  test('create returns template with is_builtin = false', async () => {
    const result = await client.templates.create({
      name: 'SDK Test',
      sections: [{ title: 'Exp', entry_type: 'experience', position: 0 }],
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.is_builtin).toBe(false)
      expect(typeof result.data.is_builtin).toBe('boolean')
    }
  })

  test('get returns template with parsed sections', async () => {
    const id = seedResumeTemplate(db, {
      sections: [{ title: 'Skills', entry_type: 'skills', position: 0 }],
    })
    const result = await client.templates.get(id)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.sections).toHaveLength(1)
      expect(result.data.sections[0].entry_type).toBe('skills')
    }
  })

  test('delete returns ok for user templates', async () => {
    const id = seedResumeTemplate(db)
    const result = await client.templates.delete(id)
    expect(result.ok).toBe(true)
  })

  test('delete returns error for built-in templates', async () => {
    const id = seedResumeTemplate(db, { isBuiltin: true })
    const result = await client.templates.delete(id)
    expect(result.ok).toBe(false)
  })

  test('saveAsTemplate creates template from resume', async () => {
    const resumeId = seedResume(db)
    seedResumeSection(db, resumeId, 'Experience', 'experience', 0)

    const result = await client.resumes.saveAsTemplate(resumeId, {
      name: 'From SDK',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.name).toBe('From SDK')
      expect(result.data.sections).toHaveLength(1)
    }
  })
})
