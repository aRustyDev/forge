import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import type { Hono } from 'hono'
import { createTestApp, apiRequest } from './helpers'
import {
  seedSource,
  seedBullet,
  seedPerspective,
  seedResume,
  seedResumeSection,
  seedResumeEntry,
  seedOrganization,
} from '../../db/__tests__/helpers'

describe('Export Routes', () => {
  let app: Hono
  let db: Database

  beforeEach(() => {
    const ctx = createTestApp()
    app = ctx.app
    db = ctx.db
  })

  afterEach(() => db.close())

  // ── Resume Export ─────────────────────────────────────────────────

  test('GET /api/export/resume/:id?format=json returns IR envelope', async () => {
    const resumeId = seedResume(db, { name: 'My Resume' })
    seedResumeSection(db, resumeId, 'Experience', 'experience')

    const res = await app.request(
      `http://localhost/api/export/resume/${resumeId}?format=json`,
    )
    expect(res.status).toBe(200)

    const json = await res.json() as any
    expect(json.data).toBeDefined()
    expect(json.data.resume_id).toBe(resumeId)

    // Content-Disposition: attachment
    const disposition = res.headers.get('Content-Disposition')
    expect(disposition).toContain('attachment')
    expect(disposition).toContain('.json')
  })

  test('GET /api/export/resume/:id?format=markdown returns text/markdown', async () => {
    const resumeId = seedResume(db, { name: 'Markdown Resume' })
    seedResumeSection(db, resumeId, 'Experience', 'experience')

    const res = await app.request(
      `http://localhost/api/export/resume/${resumeId}?format=markdown`,
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/markdown')
    expect(res.headers.get('Content-Disposition')).toContain('attachment')
    expect(res.headers.get('Content-Disposition')).toContain('.md')
  })

  test('GET /api/export/resume/:id?format=latex returns application/x-latex', async () => {
    const resumeId = seedResume(db, { name: 'LaTeX Resume' })
    seedResumeSection(db, resumeId, 'Experience', 'experience')

    const res = await app.request(
      `http://localhost/api/export/resume/${resumeId}?format=latex`,
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('application/x-latex')
    expect(res.headers.get('Content-Disposition')).toContain('attachment')
    expect(res.headers.get('Content-Disposition')).toContain('.tex')
  })

  test('GET /api/export/resume/:id?format=json with missing resume returns 404', async () => {
    const res = await app.request(
      'http://localhost/api/export/resume/nonexistent?format=json',
    )
    expect(res.status).toBe(404)
    const json = await res.json() as any
    expect(json.error.code).toBe('NOT_FOUND')
  })

  test('GET /api/export/resume/:id without format returns 400', async () => {
    const resumeId = seedResume(db)
    const res = await app.request(
      `http://localhost/api/export/resume/${resumeId}`,
    )
    expect(res.status).toBe(400)
    const json = await res.json() as any
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  test('GET /api/export/resume/:id?format=invalid returns 400', async () => {
    const resumeId = seedResume(db)
    const res = await app.request(
      `http://localhost/api/export/resume/${resumeId}?format=invalid`,
    )
    expect(res.status).toBe(400)
    const json = await res.json() as any
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  test('Content-Disposition filename matches slug-date pattern', async () => {
    const resumeId = seedResume(db, { name: 'Agentic AI Engineer' })
    seedResumeSection(db, resumeId, 'Experience', 'experience')

    const res = await app.request(
      `http://localhost/api/export/resume/${resumeId}?format=json`,
    )
    expect(res.status).toBe(200)

    const disposition = res.headers.get('Content-Disposition')!
    // Expected pattern: attachment; filename="agentic-ai-engineer-YYYY-MM-DD.json"
    expect(disposition).toMatch(/agentic-ai-engineer-\d{4}-\d{2}-\d{2}\.json/)
  })

  // ── Data Export ───────────────────────────────────────────────────

  test('GET /api/export/data?entities=sources,skills returns bundle', async () => {
    seedSource(db)
    db.run("INSERT INTO skills (id, name, category) VALUES (?, ?, ?)", [
      crypto.randomUUID(), 'TypeScript', 'language',
    ])

    const res = await app.request(
      'http://localhost/api/export/data?entities=sources,skills',
    )
    expect(res.status).toBe(200)

    const json = await res.json() as any
    expect(json.data).toBeDefined()
    expect(json.data.forge_export).toBeDefined()
    expect(json.data.forge_export.entities).toContain('sources')
    expect(json.data.forge_export.entities).toContain('skills')
    expect(json.data.sources).toHaveLength(1)
    expect(json.data.skills).toHaveLength(1)
  })

  test('GET /api/export/data without entities returns 400', async () => {
    const res = await app.request('http://localhost/api/export/data')
    expect(res.status).toBe(400)
    const json = await res.json() as any
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  test('GET /api/export/data?entities= (empty) returns 400', async () => {
    const res = await app.request(
      'http://localhost/api/export/data?entities=',
    )
    expect(res.status).toBe(400)
    const json = await res.json() as any
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  // ── Legacy Removal ────────────────────────────────────────────────

  test('POST /api/resumes/:id/export returns 404 (route removed)', async () => {
    const resumeId = seedResume(db)
    const res = await apiRequest(app, 'POST', `/resumes/${resumeId}/export`)
    expect(res.status).toBe(404)
  })

  // ── Existing PDF endpoint contract ────────────────────────────────

  test('POST /api/resumes/:id/pdf still returns Content-Disposition: inline', async () => {
    const resumeId = seedResume(db, { name: 'PDF Test' })
    seedResumeSection(db, resumeId, 'Experience', 'experience')

    // Set a latex override so PDF generation has something to work with
    db.run(
      `UPDATE resumes SET latex_override = ? WHERE id = ?`,
      ['\\documentclass{article}\\begin{document}Hello\\end{document}', resumeId],
    )

    // The PDF endpoint may fail if tectonic is not installed,
    // but we can check the route exists and processes the request
    const res = await apiRequest(app, 'POST', `/resumes/${resumeId}/pdf`)
    // If tectonic is installed, status is 200 with inline disposition
    // If not installed, status is 501 (TECTONIC_NOT_AVAILABLE)
    if (res.status === 200) {
      const disposition = res.headers.get('Content-Disposition')
      expect(disposition).toContain('inline')
    } else {
      // Acceptable: tectonic not available in test environment
      expect([501, 422]).toContain(res.status)
    }
  })
})
