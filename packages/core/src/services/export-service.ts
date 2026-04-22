/**
 * ExportService — resume format export, data bundle export, and database dump.
 *
 * Resume export methods delegate to ResumeService/resume-compiler for IR
 * compilation, then use the existing compileToMarkdown/compileToLatex functions.
 *
 * Data export collects entity data via EntityLifecycleManager into a
 * DataExportBundle.
 *
 * Database dump shells out to `sqlite3 <dbPath> .dump`.
 *
 * Phase 1.4: uses EntityLifecycleManager
 */

import type { Database } from 'bun:sqlite'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type {
  DataExportBundle,
  ResumeDocument,
  Result,
} from '../types'
import { compileResumeIR } from './resume-compiler'
import { compileToLatex } from '../lib/latex-compiler'
import { compileToMarkdown } from '../lib/markdown-compiler'
import { sb2nov } from '../templates/sb2nov'

export class ExportService {
  constructor(private db: Database, private dbPath: string, protected readonly elm: EntityLifecycleManager) {}

  // ── Resume Export Methods ─────────────────────────────────────────

  getJSON(resumeId: string): Result<ResumeDocument> {
    // compileResumeIR stays sync until Phase 1.4.6 migrates it
    const ir = compileResumeIR(this.db, resumeId)
    if (!ir) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    }
    return { ok: true, data: ir }
  }

  async getMarkdown(resumeId: string): Promise<Result<string>> {
    const resumeResult = await this.elm.get('resumes', resumeId, {
      includeLazy: ['markdown_override'],
    })
    if (!resumeResult.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    }
    const resume = resumeResult.value

    if (resume.markdown_override) {
      return { ok: true, data: resume.markdown_override as string }
    }

    const ir = compileResumeIR(this.db, resumeId)
    if (!ir) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    }

    return { ok: true, data: compileToMarkdown(ir) }
  }

  async getLatex(resumeId: string): Promise<Result<string>> {
    const resumeResult = await this.elm.get('resumes', resumeId, {
      includeLazy: ['latex_override'],
    })
    if (!resumeResult.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    }
    const resume = resumeResult.value

    if (resume.latex_override) {
      return { ok: true, data: resume.latex_override as string }
    }

    const ir = compileResumeIR(this.db, resumeId)
    if (!ir) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    }

    return { ok: true, data: compileToLatex(ir, sb2nov) }
  }

  // ── Data Export ───────────────────────────────────────────────────

  /** listAll equivalent: elm.list with large limit, no where clause */
  private async listAllRows(entityType: string): Promise<unknown[]> {
    const result = await this.elm.list(entityType, {
      limit: 100000,
      orderBy: [{ field: 'created_at', direction: 'desc' }],
    })
    return result.ok ? result.value.rows : []
  }

  async exportData(entities: string[]): Promise<Result<DataExportBundle>> {
    const resolved: string[] = []
    const bundle: DataExportBundle = {
      forge_export: {
        version: '1.0',
        exported_at: new Date().toISOString(),
        entities: resolved,
      },
    }

    for (const entity of entities) {
      switch (entity) {
        case 'sources':
          bundle.sources = await this.listAllRows('sources')
          resolved.push(entity)
          break
        case 'bullets':
          bundle.bullets = await this.listAllRows('bullets')
          resolved.push(entity)
          break
        case 'perspectives':
          bundle.perspectives = await this.listAllRows('perspectives')
          resolved.push(entity)
          break
        case 'skills':
          bundle.skills = await this.listAllRows('skills')
          resolved.push(entity)
          break
        case 'organizations':
          bundle.organizations = await this.listAllRows('organizations')
          resolved.push(entity)
          break
        case 'summaries':
          try {
            bundle.summaries = await this.listAllRows('summaries')
            resolved.push(entity)
          } catch {
            // Table may not exist
          }
          break
        case 'job_descriptions':
          try {
            bundle.job_descriptions = await this.listAllRows('job_descriptions')
            resolved.push(entity)
          } catch {
            // Table may not exist
          }
          break
        // Unknown entity names are silently ignored
      }
    }

    return { ok: true, data: bundle }
  }

  // ── Database Dump ─────────────────────────────────────────────────

  async dumpDatabase(): Promise<Result<string>> {
    try {
      const proc = Bun.spawn(['sqlite3', this.dbPath, '.dump'], {
        stdout: 'pipe',
        stderr: 'pipe',
      })

      const stdout = await new Response(proc.stdout).text()
      const exitCode = await proc.exited

      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text()
        return {
          ok: false,
          error: { code: 'DUMP_FAILED', message: stderr.trim() || 'sqlite3 dump failed' },
        }
      }

      return { ok: true, data: stdout }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          ok: false,
          error: { code: 'DUMP_FAILED', message: 'sqlite3 not found on PATH' },
        }
      }
      throw err
    }
  }
}
