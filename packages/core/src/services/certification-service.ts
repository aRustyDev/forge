/**
 * CertificationService — business logic + validation over the integrity
 * layer for certification entities.
 *
 * Phase 1.2: uses EntityLifecycleManager instead of CertificationRepository.
 *
 * Responsibilities:
 *   - Validate required `short_name`/`long_name` fields (non-empty)
 *   - Validate `skill_id` on addSkill references an existing skill
 *     (kept in the service so the historical "Skill X not found"
 *     wording survives)
 *   - Hydrate `certification_skills` into the `skills` array for
 *     getWithSkills / listWithSkills (the ELM has no join)
 *
 * Unlike credentials, the `in_progress` boolean round-trips cleanly: the
 * Certification type already declares `in_progress: boolean` and the
 * entity map declares `boolean: true`, so the ELM's deserialization
 * matches the type directly without conversion shims.
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type {
  Certification,
  CertificationWithSkills,
  CreateCertification,
  UpdateCertification,
  Skill,
  Result,
} from '../types'

export class CertificationService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  async create(input: CreateCertification): Promise<Result<Certification>> {
    if (!input.short_name || input.short_name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'short_name is required' } }
    }
    if (!input.long_name || input.long_name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'long_name is required' } }
    }

    const createResult = await this.elm.create('certifications', {
      short_name: input.short_name.trim(),
      long_name: input.long_name.trim(),
      cert_id: input.cert_id ?? null,
      issuer_id: input.issuer_id ?? null,
      date_earned: input.date_earned ?? null,
      expiry_date: input.expiry_date ?? null,
      credential_id: input.credential_id ?? null,
      credential_url: input.credential_url ?? null,
      credly_url: input.credly_url ?? null,
      in_progress: input.in_progress ?? false,
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }
    return this.fetchCert(createResult.value.id)
  }

  async get(id: string): Promise<Result<Certification>> {
    return this.fetchCert(id)
  }

  async getWithSkills(id: string): Promise<Result<CertificationWithSkills>> {
    const certResult = await this.fetchCert(id)
    if (!certResult.ok) return certResult
    const skills = await this.fetchSkillsFor(id)
    return { ok: true, data: { ...certResult.data, skills } }
  }

  async list(): Promise<Result<Certification[]>> {
    const listResult = await this.elm.list('certifications', {
      orderBy: [{ field: 'short_name', direction: 'asc' }],
      limit: 10000,
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }
    return {
      ok: true,
      data: listResult.value.rows as unknown as Certification[],
    }
  }

  async listWithSkills(): Promise<Result<CertificationWithSkills[]>> {
    const listResult = await this.elm.list('certifications', {
      orderBy: [{ field: 'short_name', direction: 'asc' }],
      limit: 10000,
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }

    const hydrated: CertificationWithSkills[] = []
    for (const row of listResult.value.rows) {
      const cert = row as unknown as Certification
      const skills = await this.fetchSkillsFor(cert.id)
      hydrated.push({ ...cert, skills })
    }
    return { ok: true, data: hydrated }
  }

  async update(id: string, input: UpdateCertification): Promise<Result<Certification>> {
    if (input.short_name !== undefined && input.short_name.trim().length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'short_name must not be empty' },
      }
    }
    if (input.long_name !== undefined && input.long_name.trim().length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'long_name must not be empty' },
      }
    }

    const patch: Record<string, unknown> = {}
    if (input.short_name !== undefined) patch.short_name = input.short_name.trim()
    if (input.long_name !== undefined) patch.long_name = input.long_name.trim()
    if (input.cert_id !== undefined) patch.cert_id = input.cert_id
    if (input.issuer_id !== undefined) patch.issuer_id = input.issuer_id
    if (input.date_earned !== undefined) patch.date_earned = input.date_earned
    if (input.expiry_date !== undefined) patch.expiry_date = input.expiry_date
    if (input.credential_id !== undefined) patch.credential_id = input.credential_id
    if (input.credential_url !== undefined) patch.credential_url = input.credential_url
    if (input.credly_url !== undefined) patch.credly_url = input.credly_url
    if (input.in_progress !== undefined) patch.in_progress = input.in_progress

    const updateResult = await this.elm.update('certifications', id, patch)
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }
    return this.fetchCert(id)
  }

  async delete(id: string): Promise<Result<void>> {
    const delResult = await this.elm.delete('certifications', id)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  // ── Skill junction ──────────────────────────────────────────────

  async addSkill(certId: string, skillId: string): Promise<Result<void>> {
    // Verify the certification exists
    const certResult = await this.elm.get('certifications', certId)
    if (!certResult.ok) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Certification ${certId} not found` },
      }
    }

    // Verify the skill exists (historical test wording)
    const skillResult = await this.elm.get('skills', skillId)
    if (!skillResult.ok) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Skill ${skillId} not found` },
      }
    }

    // Idempotent add: pre-check existing pair.
    const existing = await this.elm.count('certification_skills', {
      certification_id: certId,
      skill_id: skillId,
    })
    if (existing.ok && existing.value > 0) {
      return { ok: true, data: undefined }
    }

    const createResult = await this.elm.create('certification_skills', {
      certification_id: certId,
      skill_id: skillId,
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }
    return { ok: true, data: undefined }
  }

  async removeSkill(certId: string, skillId: string): Promise<Result<void>> {
    // Verify the certification exists (the old semantics required the
    // cert to exist even though the removal itself is idempotent).
    const certResult = await this.elm.get('certifications', certId)
    if (!certResult.ok) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Certification ${certId} not found` },
      }
    }

    const delResult = await this.elm.deleteWhere('certification_skills', {
      certification_id: certId,
      skill_id: skillId,
    })
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  async getSkills(certId: string): Promise<Result<Skill[]>> {
    const certResult = await this.elm.get('certifications', certId)
    if (!certResult.ok) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Certification ${certId} not found` },
      }
    }
    const skills = await this.fetchSkillsFor(certId)
    return { ok: true, data: skills }
  }

  // ── Internal helpers ─────────────────────────────────────────────

  private async fetchCert(id: string): Promise<Result<Certification>> {
    const result = await this.elm.get('certifications', id)
    if (!result.ok) {
      return { ok: false, error: storageErrorToForgeError(result.error) }
    }
    return { ok: true, data: result.value as unknown as Certification }
  }

  private async fetchSkillsFor(certId: string): Promise<Skill[]> {
    const junctionResult = await this.elm.list('certification_skills', {
      where: { certification_id: certId },
      limit: 1000,
    })
    if (!junctionResult.ok) return []

    const skills: Skill[] = []
    for (const row of junctionResult.value.rows) {
      const j = row as unknown as { certification_id: string; skill_id: string }
      const s = await this.elm.get('skills', j.skill_id)
      if (s.ok) {
        const skill = s.value as Skill & { created_at?: string }
        skills.push({
          id: skill.id,
          name: skill.name,
          category: skill.category,
        })
      }
    }
    skills.sort((a, b) => a.name.localeCompare(b.name))
    return skills
  }
}
