/**
 * ResumeService — resume assembly and gap analysis.
 *
 * Handles CRUD for resumes, entry management within resumes,
 * section management, skills management, and gap analysis comparing
 * coverage against archetype expectations.
 */

import type { Database } from 'bun:sqlite'
import type {
  Resume,
  ResumeWithEntries,
  ResumeEntry,
  ResumeDocument,
  CreateResume,
  UpdateResume,
  AddResumeEntry,
  ResumeSectionEntity,
  ResumeSkill,
  ResumeCertification,
  AddResumeCertification,
  GapAnalysis,
  Gap,
  Result,
  PaginatedResult,
} from '../types'
import { ResumeRepository } from '../db/repositories/resume-repository'
import { PerspectiveRepository } from '../db/repositories/perspective-repository'
import { BulletRepository } from '../db/repositories/bullet-repository'
import { THIN_COVERAGE_THRESHOLD } from '../constants/archetypes'
import * as ArchetypeRepo from '../db/repositories/archetype-repository'
import { compileResumeIR } from './resume-compiler'
import { compileToLatex } from '../lib/latex-compiler'
import { lintMarkdown } from '../lib/markdown-linter'
import { lintLatex } from '../lib/latex-linter'
import { sb2nov } from '../templates/sb2nov'

// ── Tectonic availability check ────────────────────────────────────

let tectonicAvailable: boolean | null = null

async function checkTectonic(): Promise<boolean> {
  if (tectonicAvailable !== null) return tectonicAvailable
  try {
    const proc = Bun.spawnSync(['which', 'tectonic'], { stdout: 'pipe', stderr: 'pipe' })
    tectonicAvailable = proc.exitCode === 0
  } catch {
    tectonicAvailable = false
  }
  if (!tectonicAvailable) {
    console.warn('[forge] tectonic not found — PDF generation will be unavailable')
  }
  return tectonicAvailable
}

export class ResumeService {
  constructor(private db: Database) {}

  createResume(input: CreateResume): Result<Resume> {
    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    if (!input.target_role || input.target_role.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Target role must not be empty' } }
    }
    if (!input.target_employer || input.target_employer.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Target employer must not be empty' } }
    }
    if (!input.archetype || input.archetype.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Archetype must not be empty' } }
    }

    const resume = ResumeRepository.create(this.db, input)
    return { ok: true, data: resume }
  }

  getResume(id: string): Result<ResumeWithEntries> {
    const resume = ResumeRepository.getWithEntries(this.db, id)
    if (!resume) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${id} not found` } }
    }
    return { ok: true, data: resume }
  }

  listResumes(offset = 0, limit = 50): PaginatedResult<Resume> {
    const result = ResumeRepository.list(this.db, offset, limit)
    return {
      ok: true,
      data: result.data,
      pagination: { total: result.total, offset, limit },
    }
  }

  updateResume(id: string, input: UpdateResume): Result<Resume> {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }

    const resume = ResumeRepository.update(this.db, id, input)
    if (!resume) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${id} not found` } }
    }
    return { ok: true, data: resume }
  }

  deleteResume(id: string): Result<void> {
    const deleted = ResumeRepository.delete(this.db, id)
    if (!deleted) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${id} not found` } }
    }
    return { ok: true, data: undefined }
  }

  addEntry(resumeId: string, input: AddResumeEntry): Result<ResumeEntry> {
    // Verify resume exists
    const resume = ResumeRepository.get(this.db, resumeId)
    if (!resume) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    }

    // If perspective_id is provided, validate it
    if (input.perspective_id) {
      const perspective = PerspectiveRepository.get(this.db, input.perspective_id)
      if (!perspective) {
        return { ok: false, error: { code: 'NOT_FOUND', message: `Perspective ${input.perspective_id} not found` } }
      }
      if (perspective.status === 'archived') {
        return {
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Cannot add archived perspective to resume. Unarchive it first.' },
        }
      }
      if (perspective.status !== 'approved') {
        return {
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Only approved perspectives can be added to resumes' },
        }
      }
    }

    try {
      const entry = ResumeRepository.addEntry(this.db, resumeId, input)
      return { ok: true, data: entry }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('UNIQUE constraint')) {
        return { ok: false, error: { code: 'CONFLICT', message: 'Perspective already in this resume' } }
      }
      throw err
    }
  }

  updateEntry(resumeId: string, entryId: string, input: {
    content?: string | null
    section_id?: string
    position?: number
    notes?: string | null
  }): Result<ResumeEntry> {
    // Verify resume exists
    const resume = ResumeRepository.get(this.db, resumeId)
    if (!resume) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    }

    const entry = ResumeRepository.updateEntry(this.db, entryId, input)
    if (!entry) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Entry not found' } }
    }
    // Verify the entry belongs to this resume
    if (entry.resume_id !== resumeId) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Entry not found in this resume' } }
    }
    return { ok: true, data: entry }
  }

  removeEntry(resumeId: string, entryId: string): Result<void> {
    const removed = ResumeRepository.removeEntry(this.db, resumeId, entryId)
    if (!removed) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Entry not found in this resume' } }
    }
    return { ok: true, data: undefined }
  }

  reorderEntries(resumeId: string, entries: Array<{ id: string; section_id: string; position: number }>): Result<void> {
    const resume = ResumeRepository.get(this.db, resumeId)
    if (!resume) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    }

    // Verify all entry IDs belong to this resume
    const existing = ResumeRepository.getWithEntries(this.db, resumeId)
    if (!existing) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    }

    const existingIds = new Set<string>()
    for (const section of existing.sections) {
      for (const e of section.entries) {
        existingIds.add(e.id)
      }
    }

    for (const item of entries) {
      if (!existingIds.has(item.id)) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Entry ${item.id} is not in this resume`,
          },
        }
      }
    }

    ResumeRepository.reorderEntries(this.db, resumeId, entries)
    return { ok: true, data: undefined }
  }

  analyzeGaps(resumeId: string): Result<GapAnalysis> {
    const resume = ResumeRepository.getWithEntries(this.db, resumeId)
    if (!resume) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    }

    // Collect all included perspective IDs and compute domain coverage
    const includedDomains = new Map<string, number>()
    let perspectivesIncluded = 0

    for (const section of resume.sections) {
      for (const entry of section.entries) {
        // Skip freeform entries (no perspective_id)
        if (!entry.perspective_id) continue
        perspectivesIncluded++
        // Look up the perspective's domain
        const perspective = PerspectiveRepository.get(this.db, entry.perspective_id)
        if (perspective?.domain) {
          includedDomains.set(perspective.domain, (includedDomains.get(perspective.domain) ?? 0) + 1)
        }
      }
    }

    // Get expected domains for this archetype from DB
    const expectedDomains = ArchetypeRepo.getExpectedDomainNames(this.db, resume.archetype)

    // Get all approved perspectives for this archetype
    const allForArchetype = PerspectiveRepository.list(this.db, {
      target_archetype: resume.archetype,
      status: 'approved',
    }, 0, 10000)

    const gaps: Gap[] = []

    // Check each expected domain
    for (const domain of expectedDomains) {
      const count = includedDomains.get(domain) ?? 0

      if (count === 0) {
        // Missing domain — find bullets that could fill the gap
        const availableBullets = this.findBulletsForGap(resume.archetype, domain)
        gaps.push({
          type: 'missing_domain_coverage',
          domain,
          description: `No approved perspectives with domain '${domain}' are included in this resume`,
          available_bullets: availableBullets,
          recommendation: `Derive perspectives with domain '${domain}' from these bullets`,
        })
      } else if (count < THIN_COVERAGE_THRESHOLD) {
        gaps.push({
          type: 'thin_coverage',
          domain,
          current_count: count,
          description: `Only ${count} perspective with domain '${domain}' — consider adding more`,
          recommendation: `Review approved bullets for additional ${domain} framing opportunities`,
        })
      }
    }

    // Find unused bullets (approved bullets with no perspective for this archetype)
    const allApproved = BulletRepository.list(this.db, { status: 'approved' }, 0, 10000)
    for (const bullet of allApproved.data) {
      const perspectivesForBullet = PerspectiveRepository.list(this.db, {
        bullet_id: bullet.id,
        target_archetype: resume.archetype,
        status: 'approved',
      }, 0, 1)

      if (perspectivesForBullet.data.length === 0) {
        const sourceTitle = this.getSourceTitleForBullet(bullet.id)
        gaps.push({
          type: 'unused_bullet',
          bullet_id: bullet.id,
          bullet_content: bullet.content,
          source_title: sourceTitle,
          description: `This approved bullet has no perspective for archetype '${resume.archetype}'`,
          recommendation: `Derive a perspective targeting '${resume.archetype}' archetype`,
        })
      }
    }

    const domainsRepresented = [...includedDomains.keys()]
    const domainsMissing = expectedDomains.filter((d) => !includedDomains.has(d))

    return {
      ok: true,
      data: {
        resume_id: resumeId,
        archetype: resume.archetype,
        target_role: resume.target_role,
        target_employer: resume.target_employer,
        gaps,
        coverage_summary: {
          perspectives_included: perspectivesIncluded,
          total_approved_perspectives_for_archetype: allForArchetype.data.length,
          domains_represented: domainsRepresented,
          domains_missing: domainsMissing,
        },
      },
    }
  }

  // ── Section management ──────────────────────────────────────────────

  createSection(resumeId: string, input: { title: string; entry_type: string; position?: number }): Result<ResumeSectionEntity> {
    const resume = ResumeRepository.get(this.db, resumeId)
    if (!resume) return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    const section = ResumeRepository.createSection(this.db, resumeId, input)
    return { ok: true, data: section }
  }

  listSections(resumeId: string): Result<ResumeSectionEntity[]> {
    const resume = ResumeRepository.get(this.db, resumeId)
    if (!resume) return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    return { ok: true, data: ResumeRepository.listSections(this.db, resumeId) }
  }

  updateSection(resumeId: string, sectionId: string, input: { title?: string; position?: number }): Result<ResumeSectionEntity> {
    const section = ResumeRepository.getSection(this.db, sectionId)
    if (!section || section.resume_id !== resumeId) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Section not found' } }
    }
    const updated = ResumeRepository.updateSection(this.db, sectionId, input)
    if (!updated) return { ok: false, error: { code: 'NOT_FOUND', message: 'Section not found' } }
    return { ok: true, data: updated }
  }

  deleteSection(resumeId: string, sectionId: string): Result<void> {
    const section = ResumeRepository.getSection(this.db, sectionId)
    if (!section || section.resume_id !== resumeId) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Section not found' } }
    }
    ResumeRepository.deleteSection(this.db, sectionId)
    return { ok: true, data: undefined }
  }

  // ── Skills management ──────────────────────────────────────────────

  addSkill(resumeId: string, sectionId: string, skillId: string): Result<ResumeSkill> {
    const section = ResumeRepository.getSection(this.db, sectionId)
    if (!section || section.resume_id !== resumeId) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Section not found' } }
    }
    if (section.entry_type !== 'skills') {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Skills can only be added to skills-type sections' } }
    }
    try {
      const skill = ResumeRepository.addSkill(this.db, sectionId, skillId)
      return { ok: true, data: skill }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('UNIQUE constraint')) {
        return { ok: false, error: { code: 'CONFLICT', message: 'Skill already in this section' } }
      }
      throw err
    }
  }

  removeSkill(resumeId: string, sectionId: string, skillId: string): Result<void> {
    const section = ResumeRepository.getSection(this.db, sectionId)
    if (!section || section.resume_id !== resumeId) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Section not found' } }
    }
    const removed = ResumeRepository.removeSkill(this.db, sectionId, skillId)
    if (!removed) return { ok: false, error: { code: 'NOT_FOUND', message: 'Skill not found in section' } }
    return { ok: true, data: undefined }
  }

  listSkillsForSection(resumeId: string, sectionId: string): Result<ResumeSkill[]> {
    const section = ResumeRepository.getSection(this.db, sectionId)
    if (!section || section.resume_id !== resumeId) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Section not found' } }
    }
    return { ok: true, data: ResumeRepository.listSkillsForSection(this.db, sectionId) }
  }

  reorderSkills(resumeId: string, sectionId: string, skills: Array<{ skill_id: string; position: number }>): Result<void> {
    const section = ResumeRepository.getSection(this.db, sectionId)
    if (!section || section.resume_id !== resumeId) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Section not found' } }
    }
    ResumeRepository.reorderSkills(this.db, sectionId, skills)
    return { ok: true, data: undefined }
  }

  // ── Certifications management ───────────────────────────────────────

  addCertification(resumeId: string, input: AddResumeCertification): Result<ResumeCertification> {
    const section = ResumeRepository.getSection(this.db, input.section_id)
    if (!section || section.resume_id !== resumeId) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Section not found' } }
    }
    if (section.entry_type !== 'certifications') {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Certifications can only be added to certifications-type sections' } }
    }
    try {
      const rc = ResumeRepository.addCertification(this.db, resumeId, input)
      return { ok: true, data: rc }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('UNIQUE constraint')) {
        return { ok: false, error: { code: 'CONFLICT', message: 'Certification already in this resume' } }
      }
      throw err
    }
  }

  removeCertification(resumeId: string, rcId: string): Result<void> {
    const removed = ResumeRepository.removeCertification(this.db, resumeId, rcId)
    if (!removed) return { ok: false, error: { code: 'NOT_FOUND', message: 'Resume certification not found' } }
    return { ok: true, data: undefined }
  }

  listCertificationsForResume(resumeId: string): Result<ResumeCertification[]> {
    // Get all certification-type sections for this resume, then collect entries
    const sections = ResumeRepository.listSections(this.db, resumeId)
    const certSections = sections.filter(s => s.entry_type === 'certifications')
    const all: ResumeCertification[] = []
    for (const section of certSections) {
      all.push(...ResumeRepository.listCertificationsForSection(this.db, section.id))
    }
    return { ok: true, data: all }
  }

  // ── IR & Override Methods ──────────────────────────────────────────

  getIR(id: string): Result<ResumeDocument> {
    const ir = compileResumeIR(this.db, id)
    if (!ir) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${id} not found` } }
    }
    return { ok: true, data: ir }
  }

  updateHeader(id: string, header: Record<string, unknown>): Result<Resume> {
    if (!header.name || typeof header.name !== 'string' || header.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Header name must not be empty' } }
    }
    const resume = ResumeRepository.updateHeader(this.db, id, header)
    if (!resume) return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${id} not found` } }
    return { ok: true, data: resume }
  }

  updateMarkdownOverride(id: string, content: string | null): Result<Resume> {
    if (content !== null) {
      const lint = lintMarkdown(content)
      if (!lint.ok) {
        return { ok: false, error: { code: 'VALIDATION_ERROR', message: `Markdown lint errors: ${lint.errors.join('; ')}` } }
      }
    }
    const resume = ResumeRepository.updateMarkdownOverride(this.db, id, content)
    if (!resume) return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${id} not found` } }
    return { ok: true, data: resume }
  }

  updateLatexOverride(id: string, content: string | null): Result<Resume> {
    if (content !== null) {
      const lint = lintLatex(content)
      if (!lint.ok) {
        return { ok: false, error: { code: 'VALIDATION_ERROR', message: `LaTeX lint errors: ${lint.errors.join('; ')}` } }
      }
    }
    const resume = ResumeRepository.updateLatexOverride(this.db, id, content)
    if (!resume) return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${id} not found` } }
    return { ok: true, data: resume }
  }

  async generatePDF(id: string, latex?: string): Promise<Result<Buffer>> {
    // Check tectonic availability
    if (!(await checkTectonic())) {
      return { ok: false, error: { code: 'TECTONIC_NOT_AVAILABLE', message: 'tectonic is not installed. Install it for PDF generation.' } }
    }

    // Get LaTeX content
    let latexContent = latex
    if (!latexContent) {
      // Check for override first
      const resume = ResumeRepository.get(this.db, id)
      if (!resume) return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${id} not found` } }

      if (resume.latex_override) {
        latexContent = resume.latex_override
      } else {
        // Compile from IR
        const ir = compileResumeIR(this.db, id)
        if (!ir) return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${id} not found` } }
        latexContent = compileToLatex(ir, sb2nov)
      }
    }

    // Write to temp file
    const tmpDir = '/tmp'
    const uuid = crypto.randomUUID()
    const texPath = `${tmpDir}/forge-pdf-${uuid}.tex`
    const pdfPath = `${tmpDir}/forge-pdf-${uuid}.pdf`

    try {
      await Bun.write(texPath, latexContent)

      // Spawn tectonic (no --untrusted: tectonic needs network on first run to download TeX packages;
      // tectonic does not support \write18 shell-escape by default, so the security risk is minimal)
      const proc = Bun.spawn(
        ['tectonic', texPath],
        { cwd: tmpDir, stdout: 'pipe', stderr: 'pipe' }
      )

      // Timeout after 60 seconds. Use our own `timedOut` flag instead of
      // proc.killed, which is unreliable in some Bun versions (reports true
      // even for non-signal process exits, masking the real LaTeX error).
      let timedOut = false
      const timeoutHandle = setTimeout(() => {
        timedOut = true
        proc.kill()
      }, 60_000)

      const exitCode = await proc.exited
      clearTimeout(timeoutHandle)

      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text()
        // Use our own flag instead of proc.killed, which can be unreliable
        // in some Bun versions (reports true even for non-signal exits).
        if (timedOut) {
          return { ok: false, error: { code: 'TECTONIC_TIMEOUT', message: 'PDF compilation timed out after 60 seconds' } }
        }
        return {
          ok: false,
          error: {
            code: 'LATEX_COMPILE_ERROR',
            message: 'LaTeX compilation failed',
            details: { tectonic_stderr: stderr.slice(-2000) },
          },
        }
      }

      // Read PDF
      const pdfBytes = await Bun.file(pdfPath).arrayBuffer()
      return { ok: true, data: Buffer.from(pdfBytes) }

    } finally {
      // Cleanup temp files
      try {
        const { unlinkSync } = await import('fs')
        try { unlinkSync(texPath) } catch { /* ignore */ }
        try { unlinkSync(pdfPath) } catch { /* ignore */ }
        // Also clean up auxiliary files tectonic may create
        try { unlinkSync(`${tmpDir}/forge-pdf-${uuid}.log`) } catch { /* ignore */ }
        try { unlinkSync(`${tmpDir}/forge-pdf-${uuid}.aux`) } catch { /* ignore */ }
      } catch { /* ignore */ }
    }
  }

  private findBulletsForGap(archetype: string, domain: string): Array<{ id: string; content: string; source_title: string }> {
    // Find approved bullets that have NO approved perspective for this archetype+domain
    const rows = this.db
      .query(
        `SELECT b.id, b.content, s.title AS source_title
         FROM bullets b
         JOIN bullet_sources bs ON b.id = bs.bullet_id AND bs.is_primary = 1
         JOIN sources s ON bs.source_id = s.id
         WHERE b.status = 'approved'
         AND b.id NOT IN (
           SELECT p.bullet_id FROM perspectives p
           WHERE p.target_archetype = ?
           AND p.domain = ?
           AND p.status = 'approved'
         )`,
      )
      .all(archetype, domain) as Array<{ id: string; content: string; source_title: string }>

    return rows
  }

  private getSourceTitleForBullet(bulletId: string): string {
    const row = this.db
      .query(
        `SELECT s.title FROM sources s
         JOIN bullet_sources bs ON s.id = bs.source_id
         WHERE bs.bullet_id = ? AND bs.is_primary = 1`,
      )
      .get(bulletId) as { title: string } | null
    return row?.title ?? 'Unknown Source'
  }
}
