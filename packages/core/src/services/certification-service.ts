/**
 * CertificationService — business logic + validation over
 * CertificationRepository.
 *
 * Introduced by Phase 85 T85.5 as part of the Qualifications track.
 * Responsibilities:
 *   - Validate required `name` field (non-empty)
 *   - Validate `education_source_id` references a source with
 *     source_type='education' (not a role/project/general)
 *   - Validate `skill_id` on addSkill references an existing skill
 *   - Map repository results into the standard Result<T> envelope
 */

import type { Database } from 'bun:sqlite'
import type {
  Certification,
  CertificationWithSkills,
  CreateCertification,
  UpdateCertification,
  Skill,
  Result,
} from '../types'
import * as CertificationRepo from '../db/repositories/certification-repository'

export class CertificationService {
  constructor(private db: Database) {}

  /**
   * Verify that a source ID exists AND has `source_type = 'education'`.
   * Returns an error message if invalid, null if ok.
   */
  private validateEducationSource(sourceId: string): string | null {
    const source = this.db
      .query('SELECT source_type FROM sources WHERE id = ?')
      .get(sourceId) as { source_type: string } | null

    if (!source) {
      return `Source ${sourceId} not found`
    }
    if (source.source_type !== 'education') {
      return `Source ${sourceId} has type '${source.source_type}', expected 'education' for a certification link`
    }
    return null
  }

  create(input: CreateCertification): Result<Certification> {
    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'name is required' } }
    }

    if (input.education_source_id) {
      const err = this.validateEducationSource(input.education_source_id)
      if (err) {
        const code = err.includes('not found') ? 'NOT_FOUND' : 'VALIDATION_ERROR'
        return { ok: false, error: { code, message: err } }
      }
    }

    const cert = CertificationRepo.create(this.db, {
      ...input,
      name: input.name.trim(),
    })
    return { ok: true, data: cert }
  }

  get(id: string): Result<Certification> {
    const cert = CertificationRepo.findById(this.db, id)
    if (!cert) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Certification ${id} not found` } }
    }
    return { ok: true, data: cert }
  }

  getWithSkills(id: string): Result<CertificationWithSkills> {
    const cert = CertificationRepo.findByIdWithSkills(this.db, id)
    if (!cert) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Certification ${id} not found` } }
    }
    return { ok: true, data: cert }
  }

  list(): Result<Certification[]> {
    return { ok: true, data: CertificationRepo.findAll(this.db) }
  }

  listWithSkills(): Result<CertificationWithSkills[]> {
    return { ok: true, data: CertificationRepo.findAllWithSkills(this.db) }
  }

  update(id: string, input: UpdateCertification): Result<Certification> {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'name must not be empty' } }
    }

    if (input.education_source_id) {
      const err = this.validateEducationSource(input.education_source_id)
      if (err) {
        const code = err.includes('not found') ? 'NOT_FOUND' : 'VALIDATION_ERROR'
        return { ok: false, error: { code, message: err } }
      }
    }

    const updated = CertificationRepo.update(this.db, id, {
      ...input,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    })
    if (!updated) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Certification ${id} not found` } }
    }
    return { ok: true, data: updated }
  }

  delete(id: string): Result<void> {
    const existing = CertificationRepo.findById(this.db, id)
    if (!existing) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Certification ${id} not found` } }
    }
    CertificationRepo.del(this.db, id)
    return { ok: true, data: undefined }
  }

  // ── Skill junction ──────────────────────────────────────────────

  addSkill(certId: string, skillId: string): Result<void> {
    // Verify the certification exists
    const cert = CertificationRepo.findById(this.db, certId)
    if (!cert) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Certification ${certId} not found` },
      }
    }

    // Verify the skill exists
    const skill = this.db
      .query('SELECT id FROM skills WHERE id = ?')
      .get(skillId) as { id: string } | null
    if (!skill) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Skill ${skillId} not found` },
      }
    }

    CertificationRepo.addSkill(this.db, certId, skillId)
    return { ok: true, data: undefined }
  }

  removeSkill(certId: string, skillId: string): Result<void> {
    // Verify the certification exists (idempotent removal doesn't need
    // the skill to exist, but the cert should at least).
    const cert = CertificationRepo.findById(this.db, certId)
    if (!cert) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Certification ${certId} not found` },
      }
    }

    CertificationRepo.removeSkill(this.db, certId, skillId)
    return { ok: true, data: undefined }
  }

  getSkills(certId: string): Result<Skill[]> {
    const cert = CertificationRepo.findById(this.db, certId)
    if (!cert) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Certification ${certId} not found` },
      }
    }
    return { ok: true, data: CertificationRepo.getSkills(this.db, certId) }
  }
}
