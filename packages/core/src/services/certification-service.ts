/**
 * CertificationService — business logic + validation over
 * CertificationRepository.
 *
 * Introduced by Phase 85 T85.5 as part of the Qualifications track.
 * Updated by migration 041 (cert schema rework):
 *   - `name` → `short_name` + `long_name` (both required on create)
 *   - `issuer` (text) → `issuer_id` (org FK)
 *   - `education_source_id` dropped
 *   - Added `cert_id`, `credly_url`, `in_progress`
 *
 * Responsibilities:
 *   - Validate required `short_name`/`long_name` fields (non-empty)
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

  create(input: CreateCertification): Result<Certification> {
    if (!input.short_name || input.short_name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'short_name is required' } }
    }
    if (!input.long_name || input.long_name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'long_name is required' } }
    }

    const cert = CertificationRepo.create(this.db, {
      ...input,
      short_name: input.short_name.trim(),
      long_name: input.long_name.trim(),
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
    if (input.short_name !== undefined && input.short_name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'short_name must not be empty' } }
    }
    if (input.long_name !== undefined && input.long_name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'long_name must not be empty' } }
    }

    const updated = CertificationRepo.update(this.db, id, {
      ...input,
      ...(input.short_name !== undefined ? { short_name: input.short_name.trim() } : {}),
      ...(input.long_name !== undefined ? { long_name: input.long_name.trim() } : {}),
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
