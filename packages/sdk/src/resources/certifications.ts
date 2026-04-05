/**
 * CertificationsResource — SDK client for the certifications API.
 *
 * Introduced by Phase 86 T86.4 as part of the Qualifications track.
 *
 * All list/get operations use the WithSkills variant — callers always
 * receive the full populated skills array without making a second request.
 *
 * Endpoints mirrored:
 *   GET    /api/certifications                            list() → WithSkills[]
 *   GET    /api/certifications/:id                        get(id) → WithSkills
 *   POST   /api/certifications                            create(input)
 *   PATCH  /api/certifications/:id                        update(id, input)
 *   DELETE /api/certifications/:id                        delete(id)
 *   POST   /api/certifications/:id/skills                 addSkill(id, skillId)
 *   DELETE /api/certifications/:id/skills/:skillId        removeSkill(id, skillId)
 */

import type {
  Certification,
  CertificationWithSkills,
  CreateCertification,
  RequestFn,
  Result,
  UpdateCertification,
} from '../types'

export class CertificationsResource {
  constructor(private request: RequestFn) {}

  list(): Promise<Result<CertificationWithSkills[]>> {
    return this.request<CertificationWithSkills[]>('GET', '/api/certifications')
  }

  get(id: string): Promise<Result<CertificationWithSkills>> {
    return this.request<CertificationWithSkills>('GET', `/api/certifications/${id}`)
  }

  create(input: CreateCertification): Promise<Result<Certification>> {
    return this.request<Certification>('POST', '/api/certifications', input)
  }

  update(id: string, input: UpdateCertification): Promise<Result<Certification>> {
    return this.request<Certification>('PATCH', `/api/certifications/${id}`, input)
  }

  delete(id: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/certifications/${id}`)
  }

  /** Link a skill to a certification. Returns the updated cert with its
   *  full skills array populated. Idempotent — re-linking the same pair
   *  returns the same state. */
  addSkill(id: string, skillId: string): Promise<Result<CertificationWithSkills>> {
    return this.request<CertificationWithSkills>(
      'POST',
      `/api/certifications/${id}/skills`,
      { skill_id: skillId },
    )
  }

  /** Remove a skill link. Idempotent — removing a non-existent link
   *  returns 204. */
  removeSkill(id: string, skillId: string): Promise<Result<void>> {
    return this.request<void>(
      'DELETE',
      `/api/certifications/${id}/skills/${skillId}`,
    )
  }
}
