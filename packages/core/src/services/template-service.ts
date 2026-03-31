/**
 * TemplateService -- business logic for resume templates.
 *
 * Handles CRUD validation, built-in protection on delete,
 * save-as-template from existing resumes, and create-resume-from-template.
 */

import type { Database } from 'bun:sqlite'
import type {
  ResumeTemplate,
  CreateResumeTemplate,
  UpdateResumeTemplate,
  TemplateSectionDef,
  Resume,
  Result,
  CreateResume,
} from '../types'
import * as TemplateRepo from '../db/repositories/template-repository'
import { ResumeRepository } from '../db/repositories/resume-repository'

/** Valid entry_type values from the resume_sections CHECK constraint. */
const VALID_ENTRY_TYPES = new Set([
  'experience', 'skills', 'education', 'projects',
  'clearance', 'presentations', 'certifications', 'awards', 'freeform',
])

export class TemplateService {
  constructor(private db: Database) {}

  // -- CRUD -----------------------------------------------------------------

  list(): Result<ResumeTemplate[]> {
    return { ok: true, data: TemplateRepo.list(this.db) }
  }

  get(id: string): Result<ResumeTemplate> {
    const template = TemplateRepo.get(this.db, id)
    if (!template) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Template ${id} not found` } }
    }
    return { ok: true, data: template }
  }

  create(input: CreateResumeTemplate): Result<ResumeTemplate> {
    const validation = this.validateSections(input.name, input.sections)
    if (!validation.ok) return validation

    const template = TemplateRepo.create(this.db, {
      name: input.name.trim(),
      description: input.description,
      sections: this.normalizeSections(input.sections),
    })
    return { ok: true, data: template }
  }

  update(id: string, patch: UpdateResumeTemplate): Result<ResumeTemplate> {
    const existing = TemplateRepo.get(this.db, id)
    if (!existing) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Template ${id} not found` } }
    }

    // Validate name if provided
    if (patch.name !== undefined && patch.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }

    // Validate sections if provided
    if (patch.sections !== undefined) {
      const validation = this.validateSections(
        patch.name ?? existing.name,
        patch.sections,
      )
      if (!validation.ok) return validation
      patch = { ...patch, sections: this.normalizeSections(patch.sections) }
    }

    const updated = TemplateRepo.update(this.db, id, {
      ...patch,
      name: patch.name?.trim(),
    })
    if (!updated) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Template ${id} not found` } }
    }
    return { ok: true, data: updated }
  }

  delete(id: string): Result<void> {
    const template = TemplateRepo.get(this.db, id)
    if (!template) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Template ${id} not found` } }
    }

    if (template.is_builtin) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Built-in templates cannot be deleted' },
      }
    }

    TemplateRepo.remove(this.db, id)
    return { ok: true, data: undefined }
  }

  // -- Save as Template -----------------------------------------------------

  saveAsTemplate(
    resumeId: string,
    name: string,
    description?: string,
  ): Result<ResumeTemplate> {
    if (!name || name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }

    const resume = ResumeRepository.get(this.db, resumeId)
    if (!resume) return { ok: false, error: { code: 'NOT_FOUND', message: 'Resume not found' } }

    const sections = ResumeRepository.listSections(this.db, resumeId)
    if (sections.length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Resume has no sections' },
      }
    }

    const templateSections: TemplateSectionDef[] = sections.map(s => ({
      title: s.title,
      entry_type: s.entry_type,
      position: s.position,
    }))

    return this.create({ name: name.trim(), description, sections: templateSections })
  }

  // -- Create Resume from Template ------------------------------------------

  /**
   * Create a resume with sections pre-populated from a template.
   *
   * Uses db.transaction() for atomicity: if any step fails, the entire
   * operation rolls back (no partial data -- no orphaned resume without
   * sections, no orphaned sections without a resume).
   */
  createResumeFromTemplate(
    input: CreateResume & { template_id: string },
  ): Result<Resume> {
    const template = TemplateRepo.get(this.db, input.template_id)
    if (!template) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Template not found' } }
    }

    // Validate resume input
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

    const txn = this.db.transaction(() => {
      const resume = ResumeRepository.create(this.db, {
        name: input.name,
        target_role: input.target_role,
        target_employer: input.target_employer,
        archetype: input.archetype,
      })

      for (const section of template.sections) {
        ResumeRepository.createSection(this.db, resume.id, {
          title: section.title,
          entry_type: section.entry_type,
          position: section.position,
        })
      }

      return resume
    })

    const resume = txn()
    return { ok: true, data: resume }
  }

  // -- Private helpers ------------------------------------------------------

  /**
   * Validate template name and sections.
   */
  private validateSections(
    name: string,
    sections: TemplateSectionDef[],
  ): Result<never> | { ok: true } {
    if (!name || name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }

    if (!Array.isArray(sections) || sections.length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Sections must be a non-empty array' },
      }
    }

    for (let i = 0; i < sections.length; i++) {
      const s = sections[i]

      if (!s.title || s.title.trim().length === 0) {
        return {
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: `Section ${i}: title must not be empty` },
        }
      }

      if (!VALID_ENTRY_TYPES.has(s.entry_type)) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Section ${i}: invalid entry_type '${s.entry_type}'. Must be one of: ${[...VALID_ENTRY_TYPES].join(', ')}`,
          },
        }
      }
    }

    return { ok: true }
  }

  /**
   * Normalize section positions to be sequential starting from 0.
   * Preserves the relative order of the input array.
   */
  private normalizeSections(sections: TemplateSectionDef[]): TemplateSectionDef[] {
    return sections.map((s, i) => ({
      title: s.title.trim(),
      entry_type: s.entry_type,
      position: i,
    }))
  }
}
