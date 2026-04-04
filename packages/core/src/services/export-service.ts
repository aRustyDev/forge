/**
 * ExportService — resume format export, data bundle export, and database dump.
 *
 * Resume export methods delegate to ResumeService/resume-compiler for IR
 * compilation, then use the existing compileToMarkdown/compileToLatex functions.
 *
 * Data export collects entity data from repositories into a DataExportBundle.
 *
 * Database dump shells out to `sqlite3 <dbPath> .dump`.
 */

import type { Database } from 'bun:sqlite'
import type {
  DataExportBundle,
  ResumeDocument,
  Result,
} from '../types'
import { ResumeRepository } from '../db/repositories/resume-repository'
import { BulletRepository } from '../db/repositories/bullet-repository'
import { PerspectiveRepository } from '../db/repositories/perspective-repository'
import * as SourceRepo from '../db/repositories/source-repository'
import * as SkillRepo from '../db/repositories/skill-repository'
import * as OrgRepo from '../db/repositories/organization-repository'
import { compileResumeIR } from './resume-compiler'
import { compileToLatex } from '../lib/latex-compiler'
import { compileToMarkdown } from '../lib/markdown-compiler'
import { sb2nov } from '../templates/sb2nov'

export class ExportService {
  constructor(private db: Database, private dbPath: string) {}

  // ── Resume Export Methods ─────────────────────────────────────────

  getJSON(resumeId: string): Result<ResumeDocument> {
    const ir = compileResumeIR(this.db, resumeId)
    if (!ir) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    }
    return { ok: true, data: ir }
  }

  getMarkdown(resumeId: string): Result<string> {
    const resume = ResumeRepository.get(this.db, resumeId)
    if (!resume) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    }

    if (resume.markdown_override) {
      return { ok: true, data: resume.markdown_override }
    }

    const ir = compileResumeIR(this.db, resumeId)
    if (!ir) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    }

    return { ok: true, data: compileToMarkdown(ir) }
  }

  getLatex(resumeId: string): Result<string> {
    const resume = ResumeRepository.get(this.db, resumeId)
    if (!resume) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    }

    if (resume.latex_override) {
      return { ok: true, data: resume.latex_override }
    }

    const ir = compileResumeIR(this.db, resumeId)
    if (!ir) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    }

    return { ok: true, data: compileToLatex(ir, sb2nov) }
  }

  // ── Data Export ───────────────────────────────────────────────────

  exportData(entities: string[]): Result<DataExportBundle> {
    const resolved: string[] = []
    const bundle: DataExportBundle = {
      forge_export: {
        version: '1.0',
        exported_at: new Date().toISOString(),
        entities: resolved, // populated below; reflects only entities actually included
      },
    }

    for (const entity of entities) {
      switch (entity) {
        case 'sources':
          bundle.sources = SourceRepo.listAll(this.db)
          resolved.push(entity)
          break
        case 'bullets':
          bundle.bullets = BulletRepository.listAll(this.db)
          resolved.push(entity)
          break
        case 'perspectives':
          bundle.perspectives = PerspectiveRepository.listAll(this.db)
          resolved.push(entity)
          break
        case 'skills':
          bundle.skills = SkillRepo.list(this.db)
          resolved.push(entity)
          break
        case 'organizations':
          bundle.organizations = OrgRepo.listAll(this.db)
          resolved.push(entity)
          break
        case 'summaries':
          try {
            const rows = this.db.query('SELECT * FROM summaries ORDER BY created_at DESC').all()
            bundle.summaries = rows
            resolved.push(entity)
          } catch {
            // Table does not exist yet (Spec 2 / Phase 30 not implemented)
          }
          break
        case 'job_descriptions':
          try {
            const rows = this.db.query('SELECT * FROM job_descriptions ORDER BY created_at DESC').all()
            bundle.job_descriptions = rows
            resolved.push(entity)
          } catch {
            // Table does not exist yet (Spec 4 / Phase 31 not implemented)
          }
          break
        // Unknown entity names are silently ignored (no error, just excluded)
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
