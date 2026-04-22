/**
 * Export routes — resume format export, data bundle, and database dump.
 */

import { Hono } from 'hono'
import type { Services } from '../services'
import { mapStatusCode } from './server'
import { slugify } from '../lib/slugify'

export function exportRoutes(services: Services) {
  const app = new Hono()

  // ── Resume Export ──────────────────────────────────────────────────

  app.get('/export/resume/:id', async (c) => {
    const id = c.req.param('id')
    const format = c.req.query('format')

    if (!format || !['pdf', 'markdown', 'latex', 'json'].includes(format)) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'format query parameter is required. Valid values: pdf, markdown, latex, json' } },
        400,
      )
    }

    // Look up the resume to get the name for the filename
    const resumeResult = await services.resumes.getResume(id)
    if (!resumeResult.ok) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: `Resume ${id} not found` } },
        404,
      )
    }

    const slug = slugify(resumeResult.data.name)
    const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    switch (format) {
      case 'json': {
        const result = services.export.getJSON(id)
        if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
        return c.json({ data: result.data }, 200, {
          'Content-Disposition': `attachment; filename="${slug}-${date}.json"`,
        })
      }

      case 'markdown': {
        const result = await services.export.getMarkdown(id)
        if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
        return new Response(result.data, {
          status: 200,
          headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Content-Disposition': `attachment; filename="${slug}-${date}.md"`,
          },
        })
      }

      case 'latex': {
        const result = await services.export.getLatex(id)
        if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))
        return new Response(result.data, {
          status: 200,
          headers: {
            'Content-Type': 'application/x-latex; charset=utf-8',
            'Content-Disposition': `attachment; filename="${slug}-${date}.tex"`,
          },
        })
      }

      case 'pdf': {
        // Delegate to existing ResumeService.generatePDF()
        const result = await services.resumes.generatePDF(id)
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
            'Content-Disposition': `attachment; filename="${slug}-${date}.pdf"`,
          },
        })
      }
    }
  })

  // ── Data Export ────────────────────────────────────────────────────

  app.get('/export/data', async (c) => {
    const entitiesParam = c.req.query('entities')
    if (!entitiesParam) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'entities query parameter is required (comma-separated)' } },
        400,
      )
    }

    const entities = entitiesParam.split(',').map(e => e.trim()).filter(Boolean)
    if (entities.length === 0) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'At least one entity type is required' } },
        400,
      )
    }

    const result = await services.export.exportData(entities)
    if (!result.ok) return c.json({ error: result.error }, mapStatusCode(result.error.code))

    const date = new Date().toISOString().slice(0, 10)
    return c.json({ data: result.data }, 200, {
      'Content-Disposition': `attachment; filename="forge-export-${date}.json"`,
    })
  })

  // ── Database Dump ─────────────────────────────────────────────────

  app.get('/export/dump', async (c) => {
    const result = await services.export.dumpDatabase()
    if (!result.ok) {
      const status = result.error.code === 'DUMP_FAILED' ? 502 : 500
      return c.json({ error: result.error }, status as any)
    }

    const date = new Date().toISOString().slice(0, 10)
    return new Response(result.data, {
      status: 200,
      headers: {
        'Content-Type': 'application/sql; charset=utf-8',
        'Content-Disposition': `attachment; filename="forge-dump-${date}.sql"`,
      },
    })
  })

  return app
}
