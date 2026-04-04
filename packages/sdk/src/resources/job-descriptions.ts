import type {
  CreateJobDescription,
  JobDescriptionFilter,
  JobDescriptionWithOrg,
  PaginatedResult,
  PaginationParams,
  RequestFn,
  RequestListFn,
  ResumeLink,
  Result,
  Skill,
  UpdateJobDescription,
} from '../types'

function toParams(
  filter?: object,
): Record<string, string> | undefined {
  if (!filter) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(filter)) {
    if (v !== undefined && v !== null) out[k] = String(v)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export class JobDescriptionsResource {
  constructor(
    private request: RequestFn,
    private requestList: RequestListFn,
  ) {}

  create(
    input: CreateJobDescription,
  ): Promise<Result<JobDescriptionWithOrg>> {
    return this.request<JobDescriptionWithOrg>(
      'POST',
      '/api/job-descriptions',
      input,
    )
  }

  list(
    filter?: JobDescriptionFilter & PaginationParams,
  ): Promise<PaginatedResult<JobDescriptionWithOrg>> {
    return this.requestList<JobDescriptionWithOrg>(
      'GET',
      '/api/job-descriptions',
      toParams(filter),
    )
  }

  get(id: string): Promise<Result<JobDescriptionWithOrg>> {
    return this.request<JobDescriptionWithOrg>(
      'GET',
      `/api/job-descriptions/${id}`,
    )
  }

  update(
    id: string,
    input: UpdateJobDescription,
  ): Promise<Result<JobDescriptionWithOrg>> {
    return this.request<JobDescriptionWithOrg>(
      'PATCH',
      `/api/job-descriptions/${id}`,
      input,
    )
  }

  delete(id: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/job-descriptions/${id}`)
  }

  // ── JD Skills ─────────────────────────────────────────────────────

  /** List all skills linked to a job description. */
  listSkills(jdId: string): Promise<Result<Skill[]>> {
    return this.request<Skill[]>(
      'GET',
      `/api/job-descriptions/${jdId}/skills`,
    )
  }

  /** Link a skill to a job description. Pass skill_id to link existing, or name to create+link. */
  addSkill(
    jdId: string,
    input: { skill_id: string } | { name: string; category?: string },
  ): Promise<Result<Skill>> {
    return this.request<Skill>(
      'POST',
      `/api/job-descriptions/${jdId}/skills`,
      input,
    )
  }

  /** Remove a skill link from a job description. */
  removeSkill(jdId: string, skillId: string): Promise<Result<void>> {
    return this.request<void>(
      'DELETE',
      `/api/job-descriptions/${jdId}/skills/${skillId}`,
    )
  }

  // ── JD-Resume Linkage ─────────────────────────────────────────────

  /** List resumes linked to a JD. */
  listResumes(jdId: string): Promise<Result<ResumeLink[]>> {
    return this.request<ResumeLink[]>(
      'GET',
      `/api/job-descriptions/${jdId}/resumes`,
    )
  }

  /** Link a resume to a JD. Idempotent: re-linking returns 200 with existing data. */
  linkResume(jdId: string, resumeId: string): Promise<Result<ResumeLink>> {
    return this.request<ResumeLink>(
      'POST',
      `/api/job-descriptions/${jdId}/resumes`,
      { resume_id: resumeId },
    )
  }

  /** Unlink a resume from a JD. Idempotent: unlinking a nonexistent link returns 204. */
  unlinkResume(jdId: string, resumeId: string): Promise<Result<void>> {
    return this.request<void>(
      'DELETE',
      `/api/job-descriptions/${jdId}/resumes/${resumeId}`,
    )
  }
}
