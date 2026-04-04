import type {
  ContactWithOrg,
  ContactFilter,
  ContactLink,
  ContactOrgRelationship,
  ContactJDRelationship,
  ContactResumeRelationship,
  CreateContact,
  PaginatedResult,
  PaginationParams,
  RequestFn,
  RequestListFn,
  Result,
  UpdateContact,
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

export class ContactsResource {
  constructor(
    private request: RequestFn,
    private requestList: RequestListFn,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────

  create(input: CreateContact): Promise<Result<ContactWithOrg>> {
    return this.request<ContactWithOrg>('POST', '/api/contacts', input)
  }

  list(
    filter?: ContactFilter & PaginationParams,
  ): Promise<PaginatedResult<ContactWithOrg>> {
    return this.requestList<ContactWithOrg>(
      'GET',
      '/api/contacts',
      toParams(filter),
    )
  }

  get(id: string): Promise<Result<ContactWithOrg>> {
    return this.request<ContactWithOrg>('GET', `/api/contacts/${id}`)
  }

  update(
    id: string,
    input: UpdateContact,
  ): Promise<Result<ContactWithOrg>> {
    return this.request<ContactWithOrg>('PATCH', `/api/contacts/${id}`, input)
  }

  delete(id: string): Promise<Result<void>> {
    return this.request<void>('DELETE', `/api/contacts/${id}`)
  }

  // ── Organization relationships ────────────────────────────────────

  listOrganizations(
    contactId: string,
  ): Promise<Result<Array<{ id: string; name: string; relationship: string }>>> {
    return this.request('GET', `/api/contacts/${contactId}/organizations`)
  }

  linkOrganization(
    contactId: string,
    orgId: string,
    relationship: ContactOrgRelationship,
  ): Promise<Result<void>> {
    return this.request<void>('POST', `/api/contacts/${contactId}/organizations`, {
      organization_id: orgId,
      relationship,
    })
  }

  unlinkOrganization(contactId: string, orgId: string, relationship: string): Promise<Result<void>> {
    return this.request<void>(
      'DELETE',
      `/api/contacts/${contactId}/organizations/${orgId}/${encodeURIComponent(relationship)}`,
    )
  }

  // ── Job Description relationships ─────────────────────────────────

  listJobDescriptions(
    contactId: string,
  ): Promise<Result<Array<{ id: string; title: string; organization_name: string | null; relationship: string }>>> {
    return this.request('GET', `/api/contacts/${contactId}/job-descriptions`)
  }

  linkJobDescription(
    contactId: string,
    jdId: string,
    relationship: ContactJDRelationship,
  ): Promise<Result<void>> {
    return this.request<void>('POST', `/api/contacts/${contactId}/job-descriptions`, {
      job_description_id: jdId,
      relationship,
    })
  }

  unlinkJobDescription(contactId: string, jdId: string, relationship: string): Promise<Result<void>> {
    return this.request<void>(
      'DELETE',
      `/api/contacts/${contactId}/job-descriptions/${jdId}/${encodeURIComponent(relationship)}`,
    )
  }

  // ── Resume relationships ──────────────────────────────────────────

  listResumes(
    contactId: string,
  ): Promise<Result<Array<{ id: string; name: string; relationship: string }>>> {
    return this.request('GET', `/api/contacts/${contactId}/resumes`)
  }

  linkResume(
    contactId: string,
    resumeId: string,
    relationship: ContactResumeRelationship,
  ): Promise<Result<void>> {
    return this.request<void>('POST', `/api/contacts/${contactId}/resumes`, {
      resume_id: resumeId,
      relationship,
    })
  }

  unlinkResume(contactId: string, resumeId: string, relationship: string): Promise<Result<void>> {
    return this.request<void>(
      'DELETE',
      `/api/contacts/${contactId}/resumes/${resumeId}/${encodeURIComponent(relationship)}`,
    )
  }

  // ── Reverse lookups ───────────────────────────────────────────────

  /** List contacts linked to an organization. Call from org context. */
  listByOrganization(orgId: string): Promise<Result<ContactLink[]>> {
    return this.request<ContactLink[]>(
      'GET',
      `/api/organizations/${orgId}/contacts`,
    )
  }

  /** List contacts linked to a job description. Call from JD context. */
  listByJobDescription(jdId: string): Promise<Result<ContactLink[]>> {
    return this.request<ContactLink[]>(
      'GET',
      `/api/job-descriptions/${jdId}/contacts`,
    )
  }

  /** List contacts linked to a resume. Call from resume context. */
  listByResume(resumeId: string): Promise<Result<ContactLink[]>> {
    return this.request<ContactLink[]>(
      'GET',
      `/api/resumes/${resumeId}/contacts`,
    )
  }
}
