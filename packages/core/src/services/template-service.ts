/**
 * TemplateService -- business logic for resume templates.
 *
 * Handles CRUD validation, built-in protection on delete,
 * save-as-template from existing resumes, and create-resume-from-template.
 *
 * Phase 1.7: All repository calls replaced with EntityLifecycleManager.
 * createResumeFromTemplate uses elm.transaction() for atomicity.
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type {
  ResumeTemplate,
  CreateResumeTemplate,
  UpdateResumeTemplate,
  TemplateSectionDef,
  Resume,
  Result,
  CreateResume,
} from '../types'

/** Valid entry_type values from the resume_sections CHECK constraint. */
const VALID_ENTRY_TYPES = new Set([
  'experience', 'skills', 'education', 'projects',
  'clearance', 'presentations', 'certifications', 'awards', 'freeform',
])

/** Lazy fields needed for full template reads (sections is lazy json). */
const TEMPLATE_LAZY = ['sections'] as const

/**
 * Normalize ELM row to ResumeTemplate type.
 * - is_builtin: ELM returns boolean, type expects number (0|1)
 * - sections: ELM deserializes lazy json to object automatically
 */
function toTemplate(row: Record<string, unknown>): ResumeTemplate {
  return {
    ...row,
    is_builtin: row.is_builtin === true || row.is_builtin === 1 ? 1 : 0,
  } as unknown as ResumeTemplate
}

export class TemplateService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  // -- CRUD -----------------------------------------------------------------

  async list(): Promise<Result<ResumeTemplate[]>> {
    const result = await this.elm.list('resume_templates', {
      orderBy: [
        { field: 'is_builtin', direction: 'desc' },
        { field: 'name', direction: 'asc' },
      ],
      limit: 10000,
      includeLazy: [...TEMPLATE_LAZY],
    })
    if (!result.ok) {
      return { ok: false, error: storageErrorToForgeError(result.error) }
    }
    return { ok: true, data: result.value.rows.map(toTemplate) }
  }

  async get(id: string): Promise<Result<ResumeTemplate>> {
    const result = await this.elm.get('resume_templates', id, {
      includeLazy: [...TEMPLATE_LAZY],
    })
    if (!result.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Template ${id} not found` } }
    }
    return { ok: true, data: toTemplate(result.value) }
  }

  async create(input: CreateResumeTemplate): Promise<Result<ResumeTemplate>> {
    const validation = this.validateSections(input.name, input.sections)
    if (!validation.ok) return validation

    const createResult = await this.elm.create('resume_templates', {
      name: input.name.trim(),
      description: input.description ?? null,
      sections: this.normalizeSections(input.sections),
      is_builtin: 0,
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }

    const fetched = await this.elm.get('resume_templates', createResult.value.id, {
      includeLazy: [...TEMPLATE_LAZY],
    })
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: toTemplate(fetched.value) }
  }

  async update(id: string, patch: UpdateResumeTemplate): Promise<Result<ResumeTemplate>> {
    const existing = await this.elm.get('resume_templates', id, {
      includeLazy: [...TEMPLATE_LAZY],
    })
    if (!existing.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Template ${id} not found` } }
    }

    // Validate name if provided
    if (patch.name !== undefined && patch.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }

    // Validate sections if provided
    if (patch.sections !== undefined) {
      const validation = this.validateSections(
        patch.name ?? existing.value.name as string,
        patch.sections,
      )
      if (!validation.ok) return validation
      patch = { ...patch, sections: this.normalizeSections(patch.sections) }
    }

    const updateData: Record<string, unknown> = {}
    if (patch.name !== undefined) updateData.name = patch.name.trim()
    if (patch.description !== undefined) updateData.description = patch.description
    if (patch.sections !== undefined) updateData.sections = patch.sections

    if (Object.keys(updateData).length > 0) {
      const updateResult = await this.elm.update('resume_templates', id, updateData)
      if (!updateResult.ok) {
        return { ok: false, error: storageErrorToForgeError(updateResult.error) }
      }
    }

    const fetched = await this.elm.get('resume_templates', id, {
      includeLazy: [...TEMPLATE_LAZY],
    })
    if (!fetched.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Template ${id} not found` } }
    }
    return { ok: true, data: toTemplate(fetched.value) }
  }

  async delete(id: string): Promise<Result<void>> {
    const templateResult = await this.elm.get('resume_templates', id, {
      includeLazy: [...TEMPLATE_LAZY],
    })
    if (!templateResult.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Template ${id} not found` } }
    }

    const template = templateResult.value
    if (template.is_builtin === true || template.is_builtin === 1) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Built-in templates cannot be deleted' },
      }
    }

    const delResult = await this.elm.delete('resume_templates', id)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  // -- Save as Template -----------------------------------------------------

  async saveAsTemplate(
    resumeId: string,
    name: string,
    description?: string,
  ): Promise<Result<ResumeTemplate>> {
    if (!name || name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }

    const resumeResult = await this.elm.get('resumes', resumeId)
    if (!resumeResult.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Resume not found' } }
    }

    const sectionsResult = await this.elm.list('resume_sections', {
      where: { resume_id: resumeId },
      orderBy: [{ field: 'position', direction: 'asc' }],
      limit: 100,
    })
    if (!sectionsResult.ok || sectionsResult.value.rows.length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Resume has no sections' },
      }
    }

    const templateSections: TemplateSectionDef[] = sectionsResult.value.rows.map((s) => ({
      title: s.title as string,
      entry_type: s.entry_type as string,
      position: s.position as number,
    }))

    return this.create({ name: name.trim(), description, sections: templateSections })
  }

  // -- Create Resume from Template ------------------------------------------

  /**
   * Create a resume with sections pre-populated from a template.
   *
   * Uses elm.transaction() for atomicity: if any step fails, the entire
   * operation rolls back (no partial data -- no orphaned resume without
   * sections, no orphaned sections without a resume).
   */
  async createResumeFromTemplate(
    input: CreateResume & { template_id: string },
  ): Promise<Result<Resume>> {
    // 1. Validate template exists (need sections, which are lazy)
    const templateResult = await this.elm.get('resume_templates', input.template_id, {
      includeLazy: [...TEMPLATE_LAZY],
    })
    if (!templateResult.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Template not found' } }
    }
    const template = toTemplate(templateResult.value)

    // 2. Validate resume input
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

    // 3. Atomic write: create resume + sections in transaction.
    //    tx.create does NOT run applyDefaults — provide id and timestamps
    //    explicitly. SQL-level defaults would fire for created_at/updated_at
    //    but explicit is safer.
    const resumeId = crypto.randomUUID()
    const now = new Date().toISOString()

    const txnResult = await this.elm.transaction(async (tx) => {
      await tx.create('resumes', {
        id: resumeId,
        name: input.name,
        target_role: input.target_role,
        target_employer: input.target_employer,
        archetype: input.archetype,
        created_at: now,
        updated_at: now,
      })

      for (const section of template.sections) {
        await tx.create('resume_sections', {
          id: crypto.randomUUID(),
          resume_id: resumeId,
          title: section.title,
          entry_type: section.entry_type,
          position: section.position,
          created_at: now,
        })
      }

      return resumeId
    })

    if (!txnResult.ok) {
      return { ok: false, error: storageErrorToForgeError(txnResult.error) }
    }

    // 4. Fetch the created resume
    const fetched = await this.elm.get('resumes', resumeId, {
      includeLazy: ['header', 'markdown_override', 'latex_override', 'summary_override'],
    })
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: fetched.value as unknown as Resume }
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
