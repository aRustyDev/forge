/**
 * ContactService -- business logic for contact entities.
 *
 * Validates input before delegating to the ContactRepository.
 * All methods return Result<T> (never throw).
 */

import type { Database } from 'bun:sqlite'
import type {
  ContactWithOrg,
  CreateContact,
  UpdateContact,
  ContactFilter,
  ContactLink,
  ContactOrgRelationship,
  ContactJDRelationship,
  ContactResumeRelationship,
  Result,
  PaginatedResult,
} from '../types'
import * as ContactRepo from '../db/repositories/contact-repository'

const VALID_ORG_RELATIONSHIPS: ContactOrgRelationship[] = [
  'recruiter', 'hr', 'referral', 'peer', 'manager', 'other',
]

const VALID_JD_RELATIONSHIPS: ContactJDRelationship[] = [
  'hiring_manager', 'recruiter', 'interviewer', 'referral', 'other',
]

const VALID_RESUME_RELATIONSHIPS: ContactResumeRelationship[] = [
  'reference', 'recommender', 'other',
]

export class ContactService {
  constructor(private db: Database) {}

  create(input: CreateContact): Result<ContactWithOrg> {
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

    const contact = ContactRepo.create(this.db, input)
    return { ok: true, data: contact }
  }

  get(id: string): Result<ContactWithOrg> {
    const contact = ContactRepo.get(this.db, id)
    if (!contact) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Contact ${id} not found` },
      }
    }
    return { ok: true, data: contact }
  }

  list(
    filter?: ContactFilter,
    offset?: number,
    limit?: number,
  ): PaginatedResult<ContactWithOrg> {
    const result = ContactRepo.list(this.db, filter, offset, limit)
    return {
      ok: true,
      data: result.data,
      pagination: {
        total: result.total,
        offset: offset ?? 0,
        limit: limit ?? 50,
      },
    }
  }

  update(id: string, input: UpdateContact): Result<ContactWithOrg> {
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
    if (input.linkedin !== undefined && input.linkedin !== null && !this.isValidUrl(input.linkedin)) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'LinkedIn must be a valid URL' },
      }
    }

    const contact = ContactRepo.update(this.db, id, input)
    if (!contact) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Contact ${id} not found` },
      }
    }
    return { ok: true, data: contact }
  }

  delete(id: string): Result<void> {
    const deleted = ContactRepo.del(this.db, id)
    if (!deleted) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Contact ${id} not found` },
      }
    }
    return { ok: true, data: undefined }
  }

  // ── Organization relationships ────────────────────────────────────

  linkOrganization(
    contactId: string,
    orgId: string,
    relationship: string,
  ): Result<void> {
    if (!VALID_ORG_RELATIONSHIPS.includes(relationship as ContactOrgRelationship)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid relationship: ${relationship}. Must be one of: ${VALID_ORG_RELATIONSHIPS.join(', ')}`,
        },
      }
    }
    ContactRepo.addOrganization(this.db, contactId, orgId, relationship as ContactOrgRelationship)
    return { ok: true, data: undefined }
  }

  unlinkOrganization(contactId: string, orgId: string, relationship: string): Result<void> {
    if (!VALID_ORG_RELATIONSHIPS.includes(relationship as ContactOrgRelationship)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid relationship: ${relationship}. Must be one of: ${VALID_ORG_RELATIONSHIPS.join(', ')}`,
        },
      }
    }
    ContactRepo.removeOrganization(this.db, contactId, orgId, relationship as ContactOrgRelationship)
    return { ok: true, data: undefined }
  }

  listOrganizations(contactId: string): Result<Array<{ id: string; name: string; relationship: ContactOrgRelationship }>> {
    const orgs = ContactRepo.listOrganizations(this.db, contactId)
    return { ok: true, data: orgs }
  }

  // ── Job Description relationships ─────────────────────────────────

  linkJobDescription(
    contactId: string,
    jdId: string,
    relationship: string,
  ): Result<void> {
    if (!VALID_JD_RELATIONSHIPS.includes(relationship as ContactJDRelationship)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid relationship: ${relationship}. Must be one of: ${VALID_JD_RELATIONSHIPS.join(', ')}`,
        },
      }
    }
    ContactRepo.addJobDescription(this.db, contactId, jdId, relationship as ContactJDRelationship)
    return { ok: true, data: undefined }
  }

  unlinkJobDescription(contactId: string, jdId: string, relationship: string): Result<void> {
    if (!VALID_JD_RELATIONSHIPS.includes(relationship as ContactJDRelationship)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid relationship: ${relationship}. Must be one of: ${VALID_JD_RELATIONSHIPS.join(', ')}`,
        },
      }
    }
    ContactRepo.removeJobDescription(this.db, contactId, jdId, relationship as ContactJDRelationship)
    return { ok: true, data: undefined }
  }

  listJobDescriptions(contactId: string): Result<Array<{ id: string; title: string; organization_name: string | null; relationship: ContactJDRelationship }>> {
    const jds = ContactRepo.listJobDescriptions(this.db, contactId)
    return { ok: true, data: jds }
  }

  // ── Resume relationships ──────────────────────────────────────────

  linkResume(
    contactId: string,
    resumeId: string,
    relationship: string,
  ): Result<void> {
    if (!VALID_RESUME_RELATIONSHIPS.includes(relationship as ContactResumeRelationship)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid relationship: ${relationship}. Must be one of: ${VALID_RESUME_RELATIONSHIPS.join(', ')}`,
        },
      }
    }
    ContactRepo.addResume(this.db, contactId, resumeId, relationship as ContactResumeRelationship)
    return { ok: true, data: undefined }
  }

  unlinkResume(contactId: string, resumeId: string, relationship: string): Result<void> {
    if (!VALID_RESUME_RELATIONSHIPS.includes(relationship as ContactResumeRelationship)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid relationship: ${relationship}. Must be one of: ${VALID_RESUME_RELATIONSHIPS.join(', ')}`,
        },
      }
    }
    ContactRepo.removeResume(this.db, contactId, resumeId, relationship as ContactResumeRelationship)
    return { ok: true, data: undefined }
  }

  listResumes(contactId: string): Result<Array<{ id: string; name: string; relationship: ContactResumeRelationship }>> {
    const resumes = ContactRepo.listResumes(this.db, contactId)
    return { ok: true, data: resumes }
  }

  // ── Reverse lookups ───────────────────────────────────────────────

  listByOrganization(orgId: string): Result<ContactLink[]> {
    return { ok: true, data: ContactRepo.listByOrganization(this.db, orgId) }
  }

  listByJobDescription(jdId: string): Result<ContactLink[]> {
    return { ok: true, data: ContactRepo.listByJobDescription(this.db, jdId) }
  }

  listByResume(resumeId: string): Result<ContactLink[]> {
    return { ok: true, data: ContactRepo.listByResume(this.db, resumeId) }
  }

  // ── Private helpers ───────────────────────────────────────────────

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
