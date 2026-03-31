/**
 * Resume routes — thin HTTP layer over ResumeService.
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'
import type { CreateResume, UpdateResume, AddResumeEntry } from '../types'

export function resumeRoutes(services: Services) {
  const app = new Hono()

  app.post('/resumes', async (c) => {
    const body = await c.req.json<CreateResume & { template_id?: string }>()

    if (body.template_id) {
      const result = services.templates.createResumeFromTemplate({
        ...body,
        template_id: body.template_id,
      })
      if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
      return c.json({ data: result.data }, 201)
    }

    const result = services.resumes.createResume(body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.get('/resumes', (c) => {
    const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0', 10) || 0)
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') ?? '50', 10) || 50))

    const result = services.resumes.listResumes(offset, limit)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data, pagination: result.pagination })
  })

  app.get('/resumes/:id', (c) => {
    const result = services.resumes.getResume(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/resumes/:id', async (c) => {
    const body = await c.req.json<UpdateResume>()
    const result = services.resumes.updateResume(c.req.param('id'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/resumes/:id', (c) => {
    const result = services.resumes.deleteResume(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  app.post('/resumes/:id/entries', async (c) => {
    const body = await c.req.json<AddResumeEntry>()
    const result = services.resumes.addEntry(c.req.param('id'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.patch('/resumes/:id/entries/:entryId', async (c) => {
    const body = await c.req.json<{ content?: string | null; section_id?: string; position?: number; notes?: string | null }>()
    const result = services.resumes.updateEntry(c.req.param('id'), c.req.param('entryId'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/resumes/:id/entries/:entryId', (c) => {
    const result = services.resumes.removeEntry(c.req.param('id'), c.req.param('entryId'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  app.patch('/resumes/:id/entries/reorder', async (c) => {
    const body = await c.req.json<{ entries: Array<{ id: string; section_id: string; position: number }> }>()
    const result = services.resumes.reorderEntries(c.req.param('id'), body.entries)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: null })
  })

  // ── Section CRUD ────────────────────────────────────────────────────

  app.post('/resumes/:id/sections', async (c) => {
    const body = await c.req.json<{ title: string; entry_type: string; position?: number }>()
    const result = services.resumes.createSection(c.req.param('id'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.get('/resumes/:id/sections', (c) => {
    const result = services.resumes.listSections(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/resumes/:id/sections/:sectionId', async (c) => {
    const body = await c.req.json<{ title?: string; position?: number }>()
    const result = services.resumes.updateSection(c.req.param('id'), c.req.param('sectionId'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/resumes/:id/sections/:sectionId', (c) => {
    const result = services.resumes.deleteSection(c.req.param('id'), c.req.param('sectionId'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  // ── Resume Skills (within a section) ───────────────────────────────

  app.post('/resumes/:id/sections/:sectionId/skills', async (c) => {
    const body = await c.req.json<{ skill_id: string }>()
    const result = services.resumes.addSkill(c.req.param('id'), c.req.param('sectionId'), body.skill_id)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.get('/resumes/:id/sections/:sectionId/skills', (c) => {
    const result = services.resumes.listSkillsForSection(c.req.param('id'), c.req.param('sectionId'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.delete('/resumes/:id/sections/:sectionId/skills/:skillId', (c) => {
    const result = services.resumes.removeSkill(c.req.param('id'), c.req.param('sectionId'), c.req.param('skillId'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.body(null, 204)
  })

  app.patch('/resumes/:id/sections/:sectionId/skills/reorder', async (c) => {
    const body = await c.req.json<{ skills: Array<{ skill_id: string; position: number }> }>()
    const result = services.resumes.reorderSkills(c.req.param('id'), c.req.param('sectionId'), body.skills)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: null })
  })

  // -- Save as Template ---------------------------------------------------

  app.post('/resumes/:id/save-as-template', async (c) => {
    const body = await c.req.json<{ name: string; description?: string }>()
    const result = services.templates.saveAsTemplate(
      c.req.param('id'),
      body.name,
      body.description,
    )
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data }, 201)
  })

  app.get('/resumes/:id/gaps', (c) => {
    const result = services.resumes.analyzeGaps(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  // ── IR endpoint ──────────────────────────────────────────────────

  app.get('/resumes/:id/ir', (c) => {
    const result = services.resumes.getIR(c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  // ── Header & Override endpoints ────────────────────────────────────

  app.patch('/resumes/:id/header', async (c) => {
    const body = await c.req.json()
    const result = services.resumes.updateHeader(c.req.param('id'), body)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/resumes/:id/markdown-override', async (c) => {
    const body = await c.req.json<{ content: string | null }>()
    const result = services.resumes.updateMarkdownOverride(c.req.param('id'), body.content)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  app.patch('/resumes/:id/latex-override', async (c) => {
    const body = await c.req.json<{ content: string | null }>()
    const result = services.resumes.updateLatexOverride(c.req.param('id'), body.content)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
    return c.json({ data: result.data })
  })

  // ── PDF endpoint ──────────────────────────────────────────────────

  app.post('/resumes/:id/pdf', async (c) => {
    let latex: string | undefined
    try {
      const body = await c.req.json()
      latex = body.latex
    } catch {
      // No body is fine -- compile from IR
    }

    const result = await services.resumes.generatePDF(c.req.param('id'), latex)
    if (!result.ok) {
      const code = result.error.code
      const status = code === 'TECTONIC_NOT_AVAILABLE' ? 501
                   : code === 'TECTONIC_TIMEOUT' ? 504
                   : code === 'LATEX_COMPILE_ERROR' ? 422
                   : mapStatusCode(code)
      return c.json({ error: result.error }, status as any)
    }

    return new Response(result.data, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="resume.pdf"',
      },
    })
  })

  // ── Legacy export endpoint (replaced by PDF) ──────────────────────

  app.post('/resumes/:id/export', (c) => {
    return c.json(
      { error: { code: 'NOT_IMPLEMENTED', message: 'Resume export is not yet implemented. Use POST /resumes/:id/pdf instead.' } },
      501,
    )
  })

  return app
}
