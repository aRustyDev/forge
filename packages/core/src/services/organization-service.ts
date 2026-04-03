/**
 * OrganizationService — business logic for organization entities.
 *
 * Validates input before delegating to the OrganizationRepository.
 * All methods return Result<T> (never throw).
 */

import type { Database } from 'bun:sqlite'
import type { Organization, Result, PaginatedResult } from '../types'
import * as OrgRepo from '../db/repositories/organization-repository'
import type { OrganizationFilter } from '../db/repositories/organization-repository'

const VALID_ORG_TYPES = ['company', 'nonprofit', 'government', 'military', 'education', 'volunteer', 'freelance', 'other']
const VALID_STATUSES = ['backlog', 'researching', 'exciting', 'interested', 'acceptable', 'excluded']

export class OrganizationService {
  constructor(private db: Database) {}

  create(input: OrgRepo.CreateOrganizationInput): Result<Organization> {
    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    if (input.org_type && !VALID_ORG_TYPES.includes(input.org_type)) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: `Invalid org_type: ${input.org_type}. Must be one of: ${VALID_ORG_TYPES.join(', ')}` } }
    }
    if (input.status !== undefined && input.status !== null && !VALID_STATUSES.includes(input.status)) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: `Invalid status: ${input.status}. Must be one of: ${VALID_STATUSES.join(', ')}` } }
    }
    const org = OrgRepo.create(this.db, input)
    return { ok: true, data: org }
  }

  get(id: string): Result<Organization> {
    const org = OrgRepo.get(this.db, id)
    if (!org) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Organization ${id} not found` } }
    }
    return { ok: true, data: org }
  }

  list(filter?: OrganizationFilter, offset?: number, limit?: number): PaginatedResult<Organization> {
    const result = OrgRepo.list(this.db, filter, offset, limit)
    return { ok: true, data: result.data, pagination: { total: result.total, offset: offset ?? 0, limit: limit ?? 50 } }
  }

  update(id: string, input: Partial<OrgRepo.CreateOrganizationInput>): Result<Organization> {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    if (input.org_type && !VALID_ORG_TYPES.includes(input.org_type)) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: `Invalid org_type: ${input.org_type}` } }
    }
    if (input.status !== undefined && input.status !== null && !VALID_STATUSES.includes(input.status)) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: `Invalid status: ${input.status}. Must be one of: ${VALID_STATUSES.join(', ')}` } }
    }
    const org = OrgRepo.update(this.db, id, input)
    if (!org) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Organization ${id} not found` } }
    }
    return { ok: true, data: org }
  }

  delete(id: string): Result<void> {
    const deleted = OrgRepo.del(this.db, id)
    if (!deleted) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Organization ${id} not found` } }
    }
    return { ok: true, data: undefined }
  }
}
