/**
 * ResumeService — resume assembly and gap analysis.
 *
 * Phase 1.3.5: uses EntityLifecycleManager instead of ResumeRepository.
 *
 * Handles CRUD for resumes, entry management within resumes, section
 * management, skills management, per-resume certifications, and gap
 * analysis comparing coverage against archetype expectations.
 *
 * This is the most complex service in Forge: ~10 tables, multiple
 * transaction scopes, and the single biggest surface area for the
 * migration. The core technique is the same as the other Phase 1.3
 * services — replace raw SQL with ELM calls and hydrate per-row where
 * needed — but the sheer count of methods makes this service long.
 *
 * Delegations left in place (out of Phase 1.3 scope):
 * - `analyzeGaps` reads bullets / perspectives / sources via elm.list
 *   but still uses the repo-backed ArchetypeRepo and the raw SQL
 *   helpers `findBulletsForGap` / `getSourceTitleForBullet` because
 *   those are read-only JOIN queries that would be better as named
 *   queries (Phase 1.4 candidate).
 * - `compileResumeIR` is called as-is; resume-compiler is Phase 1.4
 *   territory.
 * - `generatePDF` reads the latex_override via elm.get (with lazy
 *   include) but otherwise delegates to tectonic.
 *
 * captureSnapshotHook on resume_entries handles the "reference-mode
 * creation → capture perspective snapshot" path automatically. The
 * service explicitly clears the snapshot when entering reference mode
 * from an update (content=null), because the hook only captures; it
 * doesn't clear.
 */

import type { Database } from 'bun:sqlite'
import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
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
  Perspective,
  Bullet,
  Result,
  PaginatedResult,
} from '../types'
import { THIN_COVERAGE_THRESHOLD } from '../constants/archetypes'
import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { compileResumeIR } from './resume-compiler'
import { compileToLatex } from '../lib/latex-compiler'
import { lintMarkdown } from '../lib/markdown-linter'
import { lintLatex } from '../lib/latex-linter'
import { sb2nov } from '../templates/sb2nov'

export const PDF_CACHE_DIR = '/tmp/forge-pdf-cache'

export function hashLatexContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

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
  constructor(private db: Database, protected readonly elm: EntityLifecycleManager) {}

  async createResume(input: CreateResume): Promise<Result<Resume>> {
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

    const createResult = await this.elm.create('resumes', {
      name: input.name,
      target_role: input.target_role,
      target_employer: input.target_employer,
      archetype: input.archetype,
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }
    return this.fetchResume(createResult.value.id)
  }

  async getResume(id: string): Promise<Result<ResumeWithEntries>> {
    return this.fetchResumeWithEntries(id)
  }

  async listResumes(offset = 0, limit = 50): Promise<PaginatedResult<Resume>> {
    const listResult = await this.elm.list('resumes', {
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      offset,
      limit,
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }
    return {
      ok: true,
      data: listResult.value.rows.map((r) => this.toResume(r)),
      pagination: { total: listResult.value.total, offset, limit },
    }
  }

  async updateResume(id: string, input: UpdateResume): Promise<Result<Resume>> {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }

    const patch: Record<string, unknown> = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.target_role !== undefined) patch.target_role = input.target_role
    if (input.target_employer !== undefined) patch.target_employer = input.target_employer
    if (input.archetype !== undefined) patch.archetype = input.archetype
    if (input.status !== undefined) patch.status = input.status
    if (input.header !== undefined) patch.header = input.header
    if (input.summary_id !== undefined) patch.summary_id = input.summary_id
    if ('summary_override' in input) {
      patch.summary_override = input.summary_override ?? null
      patch.summary_override_updated_at = new Date().toISOString()
    }
    if (input.markdown_override !== undefined) {
      patch.markdown_override = input.markdown_override
      patch.markdown_override_updated_at =
        input.markdown_override !== null ? new Date().toISOString() : null
    }
    if (input.latex_override !== undefined) {
      patch.latex_override = input.latex_override
      patch.latex_override_updated_at =
        input.latex_override !== null ? new Date().toISOString() : null
    }
    if (input.show_clearance_in_header !== undefined) {
      patch.show_clearance_in_header = input.show_clearance_in_header ? true : false
    }

    if (Object.keys(patch).length === 0) {
      return this.fetchResume(id)
    }

    const updateResult = await this.elm.update('resumes', id, patch)
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }
    return this.fetchResume(id)
  }

  async deleteResume(id: string): Promise<Result<void>> {
    const delResult = await this.elm.delete('resumes', id)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  async addEntry(resumeId: string, input: AddResumeEntry): Promise<Result<ResumeEntry>> {
    const resume = await this.elm.get('resumes', resumeId)
    if (!resume.ok) {
      return { ok: false, error: storageErrorToForgeError(resume.error) }
    }

    // If perspective_id is provided, validate it exists and is approved.
    if (input.perspective_id) {
      const pResult = await this.elm.get('perspectives', input.perspective_id)
      if (!pResult.ok) {
        return {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: `Perspective ${input.perspective_id} not found`,
          },
        }
      }
      const perspective = pResult.value as unknown as Perspective
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

    // Compute default position if omitted: MAX(position) + 1 within section, or 0 if first.
    let position = input.position
    if (position === undefined) {
      const existing = await this.elm.list('resume_entries', {
        where: { section_id: input.section_id },
        orderBy: [{ field: 'position', direction: 'desc' }],
        limit: 1,
      })
      if (!existing.ok) {
        return { ok: false, error: storageErrorToForgeError(existing.error) }
      }
      const maxPos = existing.value.rows[0]?.position as number | undefined
      position = maxPos !== undefined ? maxPos + 1 : 0
    }

    const createResult = await this.elm.create('resume_entries', {
      resume_id: resumeId,
      section_id: input.section_id,
      perspective_id: input.perspective_id ?? null,
      source_id: input.source_id ?? null,
      content: input.content ?? null,
      position,
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }
    const fetched = await this.elm.get('resume_entries', createResult.value.id)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: fetched.value as unknown as ResumeEntry }
  }

  async updateEntry(
    resumeId: string,
    entryId: string,
    input: {
      content?: string | null
      section_id?: string
      position?: number
    },
  ): Promise<Result<ResumeEntry>> {
    const resume = await this.elm.get('resumes', resumeId)
    if (!resume.ok) {
      return { ok: false, error: storageErrorToForgeError(resume.error) }
    }

    const patch: Record<string, unknown> = {}
    if ('content' in input) {
      patch.content = input.content
      // Reset clears the snapshot. For clone-mode transitions, any
      // snapshot captured at create-time stays in place (the
      // captureSnapshotHook does not re-run when content is set).
      if (input.content === null) {
        patch.perspective_content_snapshot = null
      }
    }
    if (input.section_id !== undefined) patch.section_id = input.section_id
    if (input.position !== undefined) patch.position = input.position

    if (Object.keys(patch).length === 0) {
      const fetched = await this.elm.get('resume_entries', entryId)
      if (!fetched.ok) {
        return { ok: false, error: storageErrorToForgeError(fetched.error) }
      }
      const entry = fetched.value as unknown as ResumeEntry
      if (entry.resume_id !== resumeId) {
        return { ok: false, error: { code: 'NOT_FOUND', message: 'Entry not found in this resume' } }
      }
      return { ok: true, data: entry }
    }

    const updateResult = await this.elm.update('resume_entries', entryId, patch)
    if (!updateResult.ok) {
      const mapped = storageErrorToForgeError(updateResult.error)
      if (mapped.code === 'NOT_FOUND') {
        return { ok: false, error: { code: 'NOT_FOUND', message: 'Entry not found' } }
      }
      return { ok: false, error: mapped }
    }

    const fetched = await this.elm.get('resume_entries', entryId)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    const entry = fetched.value as unknown as ResumeEntry
    if (entry.resume_id !== resumeId) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Entry not found in this resume' } }
    }
    return { ok: true, data: entry }
  }

  async removeEntry(resumeId: string, entryId: string): Promise<Result<void>> {
    // Verify the entry belongs to the resume, then delete.
    const fetched = await this.elm.get('resume_entries', entryId)
    if (!fetched.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Entry not found in this resume' } }
    }
    const entry = fetched.value as unknown as ResumeEntry
    if (entry.resume_id !== resumeId) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Entry not found in this resume' } }
    }
    const delResult = await this.elm.delete('resume_entries', entryId)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  async reorderEntries(
    resumeId: string,
    entries: Array<{ id: string; section_id: string; position: number }>,
  ): Promise<Result<void>> {
    const resume = await this.elm.get('resumes', resumeId)
    if (!resume.ok) {
      return { ok: false, error: storageErrorToForgeError(resume.error) }
    }

    // Verify all entry IDs belong to this resume.
    const allEntries = await this.elm.list('resume_entries', {
      where: { resume_id: resumeId },
      limit: 10000,
    })
    if (!allEntries.ok) {
      return { ok: false, error: storageErrorToForgeError(allEntries.error) }
    }
    const existingIds = new Set(allEntries.value.rows.map((r) => r.id as string))

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

    // Atomic update via elm.transaction.
    const txResult = await this.elm.transaction(async (tx) => {
      for (const entry of entries) {
        await tx.update('resume_entries', entry.id, {
          section_id: entry.section_id,
          position: entry.position,
          updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        })
      }
    })
    if (!txResult.ok) {
      return { ok: false, error: storageErrorToForgeError(txResult.error) }
    }
    return { ok: true, data: undefined }
  }

  async analyzeGaps(resumeId: string): Promise<Result<GapAnalysis>> {
    const resumeWithEntries = await this.fetchResumeWithEntries(resumeId)
    if (!resumeWithEntries.ok) return resumeWithEntries
    const resume = resumeWithEntries.data

    // Collect included perspective IDs and compute domain coverage.
    const includedDomains = new Map<string, number>()
    let perspectivesIncluded = 0

    for (const section of resume.sections) {
      for (const entry of section.entries) {
        if (!entry.perspective_id) continue
        perspectivesIncluded++
        const pResult = await this.elm.get('perspectives', entry.perspective_id)
        if (pResult.ok) {
          const perspective = pResult.value as unknown as Perspective
          if (perspective.domain) {
            includedDomains.set(
              perspective.domain,
              (includedDomains.get(perspective.domain) ?? 0) + 1,
            )
          }
        }
      }
    }

    // Get expected domains for this archetype via ELM.
    const expectedDomains = await this.getExpectedDomainNames(resume.archetype)

    // All approved perspectives for this archetype.
    const allForArchetypeResult = await this.elm.list('perspectives', {
      where: { target_archetype: resume.archetype, status: 'approved' },
      limit: 10000,
    })
    const allForArchetypeCount = allForArchetypeResult.ok
      ? allForArchetypeResult.value.total
      : 0

    const gaps: Gap[] = []

    for (const domain of expectedDomains) {
      const count = includedDomains.get(domain) ?? 0

      if (count === 0) {
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

    // Find unused approved bullets (no perspective for this archetype).
    const allApprovedBullets = await this.elm.list('bullets', {
      where: { status: 'approved' },
      limit: 10000,
    })
    if (allApprovedBullets.ok) {
      for (const row of allApprovedBullets.value.rows) {
        const bullet = row as unknown as Bullet
        const perspectivesForBullet = await this.elm.list('perspectives', {
          where: {
            bullet_id: bullet.id,
            target_archetype: resume.archetype,
            status: 'approved',
          },
          limit: 1,
        })
        const hasAny = perspectivesForBullet.ok && perspectivesForBullet.value.rows.length > 0
        if (!hasAny) {
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
          total_approved_perspectives_for_archetype: allForArchetypeCount,
          domains_represented: domainsRepresented,
          domains_missing: domainsMissing,
        },
      },
    }
  }

  // ── Section management ──────────────────────────────────────────────

  async createSection(
    resumeId: string,
    input: { title: string; entry_type: string; position?: number },
  ): Promise<Result<ResumeSectionEntity>> {
    const resume = await this.elm.get('resumes', resumeId)
    if (!resume.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    }
    const createResult = await this.elm.create('resume_sections', {
      resume_id: resumeId,
      title: input.title,
      entry_type: input.entry_type,
      position: input.position ?? 0,
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }
    const fetched = await this.elm.get('resume_sections', createResult.value.id)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: fetched.value as unknown as ResumeSectionEntity }
  }

  async listSections(resumeId: string): Promise<Result<ResumeSectionEntity[]>> {
    const resume = await this.elm.get('resumes', resumeId)
    if (!resume.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${resumeId} not found` } }
    }
    const listResult = await this.elm.list('resume_sections', {
      where: { resume_id: resumeId },
      orderBy: [{ field: 'position', direction: 'asc' }],
      limit: 1000,
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }
    return { ok: true, data: listResult.value.rows as unknown as ResumeSectionEntity[] }
  }

  async updateSection(
    resumeId: string,
    sectionId: string,
    input: { title?: string; position?: number },
  ): Promise<Result<ResumeSectionEntity>> {
    const section = await this.getAndVerifySection(resumeId, sectionId)
    if (!section.ok) return section

    const patch: Record<string, unknown> = {}
    if (input.title !== undefined) patch.title = input.title
    if (input.position !== undefined) patch.position = input.position

    if (Object.keys(patch).length === 0) {
      return { ok: true, data: section.data }
    }

    const updateResult = await this.elm.update('resume_sections', sectionId, patch)
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }
    const fetched = await this.elm.get('resume_sections', sectionId)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: fetched.value as unknown as ResumeSectionEntity }
  }

  async deleteSection(resumeId: string, sectionId: string): Promise<Result<void>> {
    const section = await this.getAndVerifySection(resumeId, sectionId)
    if (!section.ok) return section as Result<void>

    const delResult = await this.elm.delete('resume_sections', sectionId)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  // ── Skills management ──────────────────────────────────────────────

  async addSkill(
    resumeId: string,
    sectionId: string,
    skillId: string,
  ): Promise<Result<ResumeSkill>> {
    const section = await this.getAndVerifySection(resumeId, sectionId)
    if (!section.ok) return section as Result<ResumeSkill>
    if (section.data.entry_type !== 'skills') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Skills can only be added to skills-type sections' },
      }
    }

    // Pre-check the UNIQUE(section_id, skill_id) SQL constraint so we
    // return CONFLICT via the ELM's structured path instead of relying
    // on the adapter's untyped SQL error wrapping.
    const existing = await this.elm.count('resume_skills', {
      section_id: sectionId,
      skill_id: skillId,
    })
    if (existing.ok && existing.value > 0) {
      return {
        ok: false,
        error: { code: 'CONFLICT', message: 'Skill already in this section' },
      }
    }

    const createResult = await this.elm.create('resume_skills', {
      section_id: sectionId,
      skill_id: skillId,
      position: 0,
    })
    if (!createResult.ok) {
      const mapped = storageErrorToForgeError(createResult.error)
      if (mapped.code === 'CONFLICT') {
        return {
          ok: false,
          error: { code: 'CONFLICT', message: 'Skill already in this section' },
        }
      }
      return { ok: false, error: mapped }
    }
    const fetched = await this.elm.get('resume_skills', createResult.value.id)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: fetched.value as unknown as ResumeSkill }
  }

  async removeSkill(
    resumeId: string,
    sectionId: string,
    skillId: string,
  ): Promise<Result<void>> {
    const section = await this.getAndVerifySection(resumeId, sectionId)
    if (!section.ok) return section as Result<void>

    const delResult = await this.elm.deleteWhere('resume_skills', {
      section_id: sectionId,
      skill_id: skillId,
    })
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    if (delResult.value === 0) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Skill not found in section' } }
    }
    return { ok: true, data: undefined }
  }

  async listSkillsForSection(
    resumeId: string,
    sectionId: string,
  ): Promise<Result<ResumeSkill[]>> {
    const section = await this.getAndVerifySection(resumeId, sectionId)
    if (!section.ok) return section as Result<ResumeSkill[]>

    const listResult = await this.elm.list('resume_skills', {
      where: { section_id: sectionId },
      orderBy: [{ field: 'position', direction: 'asc' }],
      limit: 1000,
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }
    return { ok: true, data: listResult.value.rows as unknown as ResumeSkill[] }
  }

  async reorderSkills(
    resumeId: string,
    sectionId: string,
    skills: Array<{ skill_id: string; position: number }>,
  ): Promise<Result<void>> {
    const section = await this.getAndVerifySection(resumeId, sectionId)
    if (!section.ok) return section as Result<void>

    const txResult = await this.elm.transaction(async (tx) => {
      for (const s of skills) {
        await tx.updateWhere(
          'resume_skills',
          { section_id: sectionId, skill_id: s.skill_id },
          { position: s.position },
        )
      }
    })
    if (!txResult.ok) {
      return { ok: false, error: storageErrorToForgeError(txResult.error) }
    }
    return { ok: true, data: undefined }
  }

  // ── Certifications management ───────────────────────────────────────

  async addCertification(
    resumeId: string,
    input: AddResumeCertification,
  ): Promise<Result<ResumeCertification>> {
    const section = await this.getAndVerifySection(resumeId, input.section_id)
    if (!section.ok) return section as Result<ResumeCertification>
    if (section.data.entry_type !== 'certifications') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Certifications can only be added to certifications-type sections' },
      }
    }

    // Pre-check the UNIQUE(resume_id, certification_id) SQL constraint
    // so we return CONFLICT structurally instead of as adapter error.
    const existingLink = await this.elm.count('resume_certifications', {
      resume_id: resumeId,
      certification_id: input.certification_id,
    })
    if (existingLink.ok && existingLink.value > 0) {
      return {
        ok: false,
        error: { code: 'CONFLICT', message: 'Certification already in this resume' },
      }
    }

    let position = input.position
    if (position === undefined) {
      const existing = await this.elm.list('resume_certifications', {
        where: { section_id: input.section_id },
        orderBy: [{ field: 'position', direction: 'desc' }],
        limit: 1,
      })
      if (!existing.ok) {
        return { ok: false, error: storageErrorToForgeError(existing.error) }
      }
      const maxPos = existing.value.rows[0]?.position as number | undefined
      position = maxPos !== undefined ? maxPos + 1 : 0
    }

    const createResult = await this.elm.create('resume_certifications', {
      resume_id: resumeId,
      certification_id: input.certification_id,
      section_id: input.section_id,
      position,
    })
    if (!createResult.ok) {
      const mapped = storageErrorToForgeError(createResult.error)
      if (mapped.code === 'CONFLICT') {
        return {
          ok: false,
          error: { code: 'CONFLICT', message: 'Certification already in this resume' },
        }
      }
      return { ok: false, error: mapped }
    }
    const fetched = await this.elm.get('resume_certifications', createResult.value.id)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: fetched.value as unknown as ResumeCertification }
  }

  async removeCertification(
    resumeId: string,
    rcId: string,
  ): Promise<Result<void>> {
    const fetched = await this.elm.get('resume_certifications', rcId)
    if (!fetched.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Resume certification not found' } }
    }
    const rc = fetched.value as unknown as ResumeCertification
    if (rc.resume_id !== resumeId) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Resume certification not found' } }
    }
    const delResult = await this.elm.delete('resume_certifications', rcId)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  async listCertificationsForResume(
    resumeId: string,
  ): Promise<Result<ResumeCertification[]>> {
    const listResult = await this.elm.list('resume_certifications', {
      where: { resume_id: resumeId },
      orderBy: [{ field: 'position', direction: 'asc' }],
      limit: 1000,
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }
    return { ok: true, data: listResult.value.rows as unknown as ResumeCertification[] }
  }

  // ── IR & Override Methods ──────────────────────────────────────────

  getIR(id: string): Result<ResumeDocument> {
    const ir = compileResumeIR(this.db, id)
    if (!ir) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${id} not found` } }
    }
    return { ok: true, data: ir }
  }

  async updateHeader(
    id: string,
    header: Record<string, unknown>,
  ): Promise<Result<Resume>> {
    if (!header.name || typeof header.name !== 'string' || header.name.trim().length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Header name must not be empty' },
      }
    }
    // The entity map marks `header` as lazy JSON, so the ELM serializes
    // the object to text on write automatically.
    const updateResult = await this.elm.update('resumes', id, { header })
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }
    return this.fetchResume(id)
  }

  async updateMarkdownOverride(
    id: string,
    content: string | null,
  ): Promise<Result<Resume>> {
    if (content !== null) {
      const lint = lintMarkdown(content)
      if (!lint.ok) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Markdown lint errors: ${lint.errors.join('; ')}`,
          },
        }
      }
    }
    const updateResult = await this.elm.update('resumes', id, {
      markdown_override: content,
      markdown_override_updated_at: content !== null ? new Date().toISOString() : null,
    })
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }
    return this.fetchResume(id)
  }

  async updateLatexOverride(
    id: string,
    content: string | null,
  ): Promise<Result<Resume>> {
    if (content !== null) {
      const lint = lintLatex(content)
      if (!lint.ok) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `LaTeX lint errors: ${lint.errors.join('; ')}`,
          },
        }
      }
    }
    const updateResult = await this.elm.update('resumes', id, {
      latex_override: content,
      latex_override_updated_at: content !== null ? new Date().toISOString() : null,
    })
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }
    return this.fetchResume(id)
  }

  async generatePDF(
    id: string,
    latex?: string,
    bust = false,
  ): Promise<Result<Buffer> & { _cacheHit?: boolean }> {
    if (!(await checkTectonic())) {
      return {
        ok: false,
        error: { code: 'TECTONIC_NOT_AVAILABLE', message: 'tectonic is not installed. Install it for PDF generation.' },
      }
    }

    let latexContent = latex
    if (!latexContent) {
      // latex_override is lazy — include it explicitly.
      const resumeResult = await this.elm.get('resumes', id, {
        includeLazy: ['latex_override'],
      })
      if (!resumeResult.ok) {
        return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${id} not found` } }
      }
      const resume = resumeResult.value as unknown as Resume

      if (resume.latex_override) {
        latexContent = resume.latex_override
      } else {
        const ir = compileResumeIR(this.db, id)
        if (!ir) {
          return { ok: false, error: { code: 'NOT_FOUND', message: `Resume ${id} not found` } }
        }
        latexContent = compileToLatex(ir, sb2nov)
      }
    }

    const hash = hashLatexContent(latexContent)
    const cachePath = `${PDF_CACHE_DIR}/${hash}.pdf`

    if (!existsSync(PDF_CACHE_DIR)) {
      const { mkdirSync } = await import('fs')
      mkdirSync(PDF_CACHE_DIR, { recursive: true })
    }

    if (!bust && existsSync(cachePath)) {
      const cached = await Bun.file(cachePath).arrayBuffer()
      return { ok: true, data: Buffer.from(cached), _cacheHit: true }
    }

    const tmpDir = '/tmp'
    const uuid = crypto.randomUUID()
    const texPath = `${tmpDir}/forge-pdf-${uuid}.tex`
    const pdfPath = `${tmpDir}/forge-pdf-${uuid}.pdf`

    try {
      await Bun.write(texPath, latexContent)

      const proc = Bun.spawn(
        ['tectonic', texPath],
        { cwd: tmpDir, stdout: 'pipe', stderr: 'pipe' },
      )

      let timedOut = false
      const timeoutHandle = setTimeout(() => {
        timedOut = true
        proc.kill()
      }, 60_000)

      const exitCode = await proc.exited
      clearTimeout(timeoutHandle)

      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text()
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

      const pdfBytes = await Bun.file(pdfPath).arrayBuffer()
      const buffer = Buffer.from(pdfBytes)
      await Bun.write(cachePath, buffer)
      return { ok: true, data: buffer, _cacheHit: false }
    } finally {
      try {
        const { unlinkSync } = await import('fs')
        try { unlinkSync(texPath) } catch { /* ignore */ }
        try { unlinkSync(pdfPath) } catch { /* ignore */ }
        try { unlinkSync(`${tmpDir}/forge-pdf-${uuid}.log`) } catch { /* ignore */ }
        try { unlinkSync(`${tmpDir}/forge-pdf-${uuid}.aux`) } catch { /* ignore */ }
      } catch { /* ignore */ }
    }
  }

  // ── private helpers ─────────────────────────────────────────────────

  private async fetchResume(id: string): Promise<Result<Resume>> {
    const result = await this.elm.get('resumes', id, {
      includeLazy: ['header', 'markdown_override', 'latex_override', 'summary_override'],
    })
    if (!result.ok) {
      return { ok: false, error: storageErrorToForgeError(result.error) }
    }
    return { ok: true, data: this.toResume(result.value) }
  }

  private async fetchResumeWithEntries(id: string): Promise<Result<ResumeWithEntries>> {
    const resumeResult = await this.fetchResume(id)
    if (!resumeResult.ok) return resumeResult
    const resume = resumeResult.data

    // Fetch ALL sections for this resume (including empty ones).
    const sectionsResult = await this.elm.list('resume_sections', {
      where: { resume_id: id },
      orderBy: [{ field: 'position', direction: 'asc' }],
      limit: 1000,
    })
    if (!sectionsResult.ok) {
      return { ok: false, error: storageErrorToForgeError(sectionsResult.error) }
    }
    const sectionRows = sectionsResult.value.rows as unknown as ResumeSectionEntity[]

    // Fetch all entries for this resume.
    const entriesResult = await this.elm.list('resume_entries', {
      where: { resume_id: id },
      orderBy: [{ field: 'position', direction: 'asc' }],
      limit: 10000,
    })
    if (!entriesResult.ok) {
      return { ok: false, error: storageErrorToForgeError(entriesResult.error) }
    }

    // Group entries by section. Populate perspective_content via per-row
    // perspective lookups for entries with a perspective_id.
    type HydratedEntry = ResumeEntry & { perspective_content: string | null }
    const bySection = new Map<string, HydratedEntry[]>()
    for (const section of sectionRows) {
      bySection.set(section.id, [])
    }

    for (const row of entriesResult.value.rows) {
      const entry = row as unknown as ResumeEntry
      let perspectiveContent: string | null = null
      if (entry.perspective_id) {
        const pResult = await this.elm.get('perspectives', entry.perspective_id)
        if (pResult.ok) {
          perspectiveContent = (pResult.value.content as string | null) ?? null
        }
      }
      const bucket = bySection.get(entry.section_id)
      if (bucket) {
        bucket.push({ ...entry, perspective_content: perspectiveContent })
      }
    }

    const sections = sectionRows.map((section) => ({
      id: section.id,
      title: section.title,
      entry_type: section.entry_type,
      position: section.position,
      entries: bySection.get(section.id) ?? [],
    }))

    return {
      ok: true,
      data: { ...resume, sections },
    }
  }

  private async getAndVerifySection(
    resumeId: string,
    sectionId: string,
  ): Promise<Result<ResumeSectionEntity>> {
    const result = await this.elm.get('resume_sections', sectionId)
    if (!result.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Section not found' } }
    }
    const section = result.value as unknown as ResumeSectionEntity
    if (section.resume_id !== resumeId) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Section not found' } }
    }
    return { ok: true, data: section }
  }

  private toResume(row: Record<string, unknown>): Resume {
    return {
      id: row.id as string,
      name: row.name as string,
      target_role: row.target_role as string,
      target_employer: row.target_employer as string,
      archetype: row.archetype as string,
      status: row.status as Resume['status'],
      header: (row.header as string | null) ?? null,
      summary_id: (row.summary_id as string | null) ?? null,
      summary_override: (row.summary_override as string | null) ?? null,
      summary_override_updated_at: (row.summary_override_updated_at as string | null) ?? null,
      markdown_override: (row.markdown_override as string | null) ?? null,
      markdown_override_updated_at: (row.markdown_override_updated_at as string | null) ?? null,
      latex_override: (row.latex_override as string | null) ?? null,
      latex_override_updated_at: (row.latex_override_updated_at as string | null) ?? null,
      show_clearance_in_header:
        row.show_clearance_in_header === undefined || row.show_clearance_in_header === null
          ? 1
          : row.show_clearance_in_header === true || row.show_clearance_in_header === 1
            ? 1
            : 0,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    }
  }

  // ── ELM helper replacing ArchetypeRepo.getExpectedDomainNames ──

  private async getExpectedDomainNames(archetypeName: string): Promise<string[]> {
    // Find the archetype by name (bounded table, in-memory filter)
    const archResult = await this.elm.list('archetypes', { limit: 1000 })
    if (!archResult.ok) return []
    const archetype = archResult.value.rows.find(
      (a: any) => a.name?.toLowerCase() === archetypeName.toLowerCase(),
    )
    if (!archetype) return []

    // Get linked domain IDs from archetype_domains junction
    const junctionResult = await this.elm.list('archetype_domains', {
      where: { archetype_id: (archetype as any).id },
      limit: 1000,
    })
    if (!junctionResult.ok) return []

    // Resolve domain names
    const names: string[] = []
    for (const row of junctionResult.value.rows) {
      const domainResult = await this.elm.get('domains', (row as any).domain_id)
      if (domainResult.ok) {
        names.push((domainResult.value as any).name)
      }
    }
    return names.sort()
  }

  // ── raw SQL helpers for gap analysis (read-only, Phase 1.4 candidates) ──

  private findBulletsForGap(
    archetype: string,
    domain: string,
  ): Array<{ id: string; content: string; source_title: string }> {
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
