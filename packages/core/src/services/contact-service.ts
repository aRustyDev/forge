/**
 * ContactService -- business logic for contact entities.
 *
 * Phase 1.2: uses EntityLifecycleManager instead of ContactRepository.
 *
 * Validates input (name, email format, linkedin URL) before delegating
 * to the ELM. All methods return Result<T> (never throw).
 *
 * Junction-heavy: contacts participate in three many-to-many junctions
 * (`contact_organizations`, `contact_job_descriptions`,
 * `contact_resumes`), each with a 3-column composite PK
 * `(contact_id, other_id, relationship)`. This means the SAME contact
 * can be linked to the SAME entity with different relationships (e.g.
 * "recruiter" and "manager" on the same org). The composite-PK
 * uniqueness check the ELM gained in Phase 1.2.1 handles this.
 *
 * Hydration: `ContactWithOrg` includes a JOIN-computed
 * `organization_name` field. The service fetches the contact row then
 * looks up its organization_id → organizations.name to populate.
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type {
  Contact,
  ContactWithOrg,
  CreateContact,
  UpdateContact,
  ContactFilter,
  ContactLink,
  ContactOrgRelationship,
  ContactJDRelationship,
  ContactResumeRelationship,
  Organization,
  JobDescription,
  Resume,
  Result,
  PaginatedResult,
} from '../types'

const VALID_ORG_RELATIONSHIPS: ContactOrgRelationship[] = [
  'recruiter',
  'hr',
  'referral',
  'peer',
  'manager',
  'other',
]

const VALID_JD_RELATIONSHIPS: ContactJDRelationship[] = [
  'hiring_manager',
  'recruiter',
  'interviewer',
  'referral',
  'other',
]

const VALID_RESUME_RELATIONSHIPS: ContactResumeRelationship[] = [
  'reference',
  'recommender',
  'other',
]

export class ContactService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  async create(input: CreateContact): Promise<Result<ContactWithOrg>> {
    if (!input.name || input.name.trim().length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' },
      }
    }
    if (input.email && !this.isValidEmail(input.email)) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' },
      }
    }
    if (input.linkedin && !this.isValidUrl(input.linkedin)) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'LinkedIn must be a valid URL' },
      }
    }

    const createResult = await this.elm.create('contacts', {
      name: input.name,
      title: input.title ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      linkedin: input.linkedin ?? null,
      team: input.team ?? null,
      dept: input.dept ?? null,
      notes: input.notes ?? null,
      organization_id: input.organization_id ?? null,
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }
    return this.fetchContact(createResult.value.id)
  }

  async get(id: string): Promise<Result<ContactWithOrg>> {
    return this.fetchContact(id)
  }

  async list(
    filter?: ContactFilter,
    offset?: number,
    limit?: number,
  ): Promise<PaginatedResult<ContactWithOrg>> {
    const where: Record<string, unknown> = {}
    if (filter?.organization_id !== undefined) {
      where.organization_id = filter.organization_id
    }

    // Search: the historical repo uses `COLLATE NOCASE` LIKE across
    // name/title/email. SQLite's default LIKE is already
    // case-insensitive for ASCII, which covers practical usage for
    // contact names/emails. Use `$or` to reproduce the multi-column
    // match.
    let whereClause: Record<string, unknown> | undefined = undefined
    if (filter?.search !== undefined && filter.search.trim()) {
      const searchTerm = `%${filter.search.trim()}%`
      whereClause = {
        $and: [
          ...(Object.keys(where).length > 0 ? [where] : []),
          {
            $or: [
              { name: { $like: searchTerm } },
              { title: { $like: searchTerm } },
              { email: { $like: searchTerm } },
            ],
          },
        ],
      }
    } else if (Object.keys(where).length > 0) {
      whereClause = where
    }

    const listResult = await this.elm.list('contacts', {
      where: whereClause,
      orderBy: [{ field: 'name', direction: 'asc' }],
      offset,
      limit,
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }

    const data: ContactWithOrg[] = []
    for (const row of listResult.value.rows) {
      data.push(await this.toContactWithOrg(row as unknown as Contact))
    }

    return {
      ok: true,
      data,
      pagination: {
        total: listResult.value.total,
        offset: offset ?? 0,
        limit: limit ?? 50,
      },
    }
  }

  async update(id: string, input: UpdateContact): Promise<Result<ContactWithOrg>> {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' },
      }
    }
    if (input.email !== undefined && input.email !== null && !this.isValidEmail(input.email)) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' },
      }
    }
    if (
      input.linkedin !== undefined &&
      input.linkedin !== null &&
      !this.isValidUrl(input.linkedin)
    ) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'LinkedIn must be a valid URL' },
      }
    }

    const patch: Record<string, unknown> = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.title !== undefined) patch.title = input.title
    if (input.email !== undefined) patch.email = input.email
    if (input.phone !== undefined) patch.phone = input.phone
    if (input.linkedin !== undefined) patch.linkedin = input.linkedin
    if (input.team !== undefined) patch.team = input.team
    if (input.dept !== undefined) patch.dept = input.dept
    if (input.notes !== undefined) patch.notes = input.notes
    if (input.organization_id !== undefined) patch.organization_id = input.organization_id

    const updateResult = await this.elm.update('contacts', id, patch)
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }
    return this.fetchContact(id)
  }

  async delete(id: string): Promise<Result<void>> {
    const delResult = await this.elm.delete('contacts', id)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  // ── Organization relationships ────────────────────────────────────

  async linkOrganization(
    contactId: string,
    orgId: string,
    relationship: string,
  ): Promise<Result<void>> {
    if (!VALID_ORG_RELATIONSHIPS.includes(relationship as ContactOrgRelationship)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid relationship: ${relationship}. Must be one of: ${VALID_ORG_RELATIONSHIPS.join(', ')}`,
        },
      }
    }
    return this.addJunctionRow('contact_organizations', {
      contact_id: contactId,
      organization_id: orgId,
      relationship,
    })
  }

  async unlinkOrganization(
    contactId: string,
    orgId: string,
    relationship: string,
  ): Promise<Result<void>> {
    if (!VALID_ORG_RELATIONSHIPS.includes(relationship as ContactOrgRelationship)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid relationship: ${relationship}. Must be one of: ${VALID_ORG_RELATIONSHIPS.join(', ')}`,
        },
      }
    }
    return this.deleteJunctionRow('contact_organizations', {
      contact_id: contactId,
      organization_id: orgId,
      relationship,
    })
  }

  async listOrganizations(
    contactId: string,
  ): Promise<Result<Array<{ id: string; name: string; relationship: ContactOrgRelationship }>>> {
    const junctionResult = await this.elm.list('contact_organizations', {
      where: { contact_id: contactId },
      limit: 10000,
    })
    if (!junctionResult.ok) {
      return { ok: false, error: storageErrorToForgeError(junctionResult.error) }
    }

    const rows: Array<{ id: string; name: string; relationship: ContactOrgRelationship }> = []
    for (const row of junctionResult.value.rows) {
      const j = row as unknown as {
        organization_id: string
        relationship: ContactOrgRelationship
      }
      const orgResult = await this.elm.get('organizations', j.organization_id)
      if (orgResult.ok) {
        const org = orgResult.value as unknown as Organization
        rows.push({ id: org.id, name: org.name, relationship: j.relationship })
      }
    }
    rows.sort((a, b) => a.name.localeCompare(b.name))
    return { ok: true, data: rows }
  }

  // ── Job Description relationships ─────────────────────────────────

  async linkJobDescription(
    contactId: string,
    jdId: string,
    relationship: string,
  ): Promise<Result<void>> {
    if (!VALID_JD_RELATIONSHIPS.includes(relationship as ContactJDRelationship)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid relationship: ${relationship}. Must be one of: ${VALID_JD_RELATIONSHIPS.join(', ')}`,
        },
      }
    }
    return this.addJunctionRow('contact_job_descriptions', {
      contact_id: contactId,
      job_description_id: jdId,
      relationship,
    })
  }

  async unlinkJobDescription(
    contactId: string,
    jdId: string,
    relationship: string,
  ): Promise<Result<void>> {
    if (!VALID_JD_RELATIONSHIPS.includes(relationship as ContactJDRelationship)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid relationship: ${relationship}. Must be one of: ${VALID_JD_RELATIONSHIPS.join(', ')}`,
        },
      }
    }
    return this.deleteJunctionRow('contact_job_descriptions', {
      contact_id: contactId,
      job_description_id: jdId,
      relationship,
    })
  }

  async listJobDescriptions(
    contactId: string,
  ): Promise<
    Result<
      Array<{
        id: string
        title: string
        organization_name: string | null
        relationship: ContactJDRelationship
      }>
    >
  > {
    const junctionResult = await this.elm.list('contact_job_descriptions', {
      where: { contact_id: contactId },
      limit: 10000,
    })
    if (!junctionResult.ok) {
      return { ok: false, error: storageErrorToForgeError(junctionResult.error) }
    }

    const rows: Array<{
      id: string
      title: string
      organization_name: string | null
      relationship: ContactJDRelationship
    }> = []
    for (const row of junctionResult.value.rows) {
      const j = row as unknown as {
        job_description_id: string
        relationship: ContactJDRelationship
      }
      const jdResult = await this.elm.get('job_descriptions', j.job_description_id)
      if (!jdResult.ok) continue
      const jd = jdResult.value as unknown as JobDescription
      let organization_name: string | null = null
      if (jd.organization_id) {
        const orgResult = await this.elm.get('organizations', jd.organization_id)
        if (orgResult.ok) {
          organization_name = (orgResult.value as unknown as Organization).name
        }
      }
      rows.push({
        id: jd.id,
        title: jd.title,
        organization_name,
        relationship: j.relationship,
      })
    }
    rows.sort((a, b) => a.title.localeCompare(b.title))
    return { ok: true, data: rows }
  }

  // ── Resume relationships ──────────────────────────────────────────

  async linkResume(
    contactId: string,
    resumeId: string,
    relationship: string,
  ): Promise<Result<void>> {
    if (
      !VALID_RESUME_RELATIONSHIPS.includes(relationship as ContactResumeRelationship)
    ) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid relationship: ${relationship}. Must be one of: ${VALID_RESUME_RELATIONSHIPS.join(', ')}`,
        },
      }
    }
    return this.addJunctionRow('contact_resumes', {
      contact_id: contactId,
      resume_id: resumeId,
      relationship,
    })
  }

  async unlinkResume(
    contactId: string,
    resumeId: string,
    relationship: string,
  ): Promise<Result<void>> {
    if (
      !VALID_RESUME_RELATIONSHIPS.includes(relationship as ContactResumeRelationship)
    ) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid relationship: ${relationship}. Must be one of: ${VALID_RESUME_RELATIONSHIPS.join(', ')}`,
        },
      }
    }
    return this.deleteJunctionRow('contact_resumes', {
      contact_id: contactId,
      resume_id: resumeId,
      relationship,
    })
  }

  async listResumes(
    contactId: string,
  ): Promise<Result<Array<{ id: string; name: string; relationship: ContactResumeRelationship }>>> {
    const junctionResult = await this.elm.list('contact_resumes', {
      where: { contact_id: contactId },
      limit: 10000,
    })
    if (!junctionResult.ok) {
      return { ok: false, error: storageErrorToForgeError(junctionResult.error) }
    }

    const rows: Array<{ id: string; name: string; relationship: ContactResumeRelationship }> = []
    for (const row of junctionResult.value.rows) {
      const j = row as unknown as { resume_id: string; relationship: ContactResumeRelationship }
      const resumeResult = await this.elm.get('resumes', j.resume_id)
      if (resumeResult.ok) {
        const resume = resumeResult.value as unknown as Resume
        rows.push({ id: resume.id, name: resume.name, relationship: j.relationship })
      }
    }
    rows.sort((a, b) => a.name.localeCompare(b.name))
    return { ok: true, data: rows }
  }

  // ── Reverse lookups ───────────────────────────────────────────────

  async listByOrganization(orgId: string): Promise<Result<ContactLink[]>> {
    return this.listContactsByJunction('contact_organizations', { organization_id: orgId })
  }

  async listByJobDescription(jdId: string): Promise<Result<ContactLink[]>> {
    return this.listContactsByJunction('contact_job_descriptions', {
      job_description_id: jdId,
    })
  }

  async listByResume(resumeId: string): Promise<Result<ContactLink[]>> {
    return this.listContactsByJunction('contact_resumes', { resume_id: resumeId })
  }

  // ── Internal helpers ─────────────────────────────────────────────

  private async fetchContact(id: string): Promise<Result<ContactWithOrg>> {
    const result = await this.elm.get('contacts', id)
    if (!result.ok) {
      return { ok: false, error: storageErrorToForgeError(result.error) }
    }
    const contact = await this.toContactWithOrg(result.value as unknown as Contact)
    return { ok: true, data: contact }
  }

  private async toContactWithOrg(contact: Contact): Promise<ContactWithOrg> {
    let organization_name: string | null = null
    if (contact.organization_id) {
      const orgResult = await this.elm.get('organizations', contact.organization_id)
      if (orgResult.ok) {
        organization_name = (orgResult.value as unknown as Organization).name
      }
    }
    return { ...contact, organization_name }
  }

  /**
   * Add a junction row. Idempotent via composite-PK uniqueness
   * pre-check: if the triple already exists, return ok without
   * re-inserting. This matches the historical `INSERT OR IGNORE`
   * semantics that every add* helper relied on.
   */
  private async addJunctionRow(
    entity: string,
    row: Record<string, unknown>,
  ): Promise<Result<void>> {
    const existing = await this.elm.count(entity, row)
    if (existing.ok && existing.value > 0) {
      return { ok: true, data: undefined }
    }

    const createResult = await this.elm.create(entity, row)
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }
    return { ok: true, data: undefined }
  }

  /**
   * Delete a junction row by its composite key. Idempotent: if the
   * row does not exist, the delete is a no-op (matches the old repo
   * which did `DELETE WHERE ...` with no return value).
   */
  private async deleteJunctionRow(
    entity: string,
    where: Record<string, unknown>,
  ): Promise<Result<void>> {
    const delResult = await this.elm.deleteWhere(entity, where)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  /**
   * Walk a junction table and return ContactLink rows. Used by the
   * three reverse lookups (listByOrganization / listByJobDescription
   * / listByResume).
   */
  private async listContactsByJunction(
    entity: string,
    where: Record<string, unknown>,
  ): Promise<Result<ContactLink[]>> {
    const junctionResult = await this.elm.list(entity, { where, limit: 10000 })
    if (!junctionResult.ok) {
      return { ok: false, error: storageErrorToForgeError(junctionResult.error) }
    }

    const links: ContactLink[] = []
    for (const row of junctionResult.value.rows) {
      const j = row as unknown as { contact_id: string; relationship: string }
      const contactResult = await this.elm.get('contacts', j.contact_id)
      if (contactResult.ok) {
        const c = contactResult.value as unknown as Contact
        links.push({
          contact_id: c.id,
          contact_name: c.name,
          contact_title: c.title,
          contact_email: c.email,
          relationship: j.relationship,
        })
      }
    }
    links.sort((a, b) => a.contact_name.localeCompare(b.contact_name))
    return { ok: true, data: links }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }
}
