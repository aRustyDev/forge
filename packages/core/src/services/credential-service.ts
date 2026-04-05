/**
 * CredentialService — business logic + validation over CredentialRepository.
 *
 * Introduced by Phase 85 T85.4 as part of the Qualifications track.
 * Responsibilities:
 *   - Validate credential_type-specific required fields in details JSON
 *   - Validate status + credential_type enums
 *   - Validate organization_id references an existing organization
 *   - Map repository results into the standard Result<T> envelope
 *
 * The service is intentionally thin — all SQL lives in the repository, and
 * the service layer adds validation plus error mapping.
 */

import type { Database } from 'bun:sqlite'
import type {
  Credential,
  CreateCredential,
  UpdateCredential,
  CredentialType,
  CredentialStatus,
  CredentialDetails,
  ClearanceDetails,
  DriversLicenseDetails,
  BarAdmissionDetails,
  MedicalLicenseDetails,
  Result,
} from '../types'
import * as CredentialRepo from '../db/repositories/credential-repository'
import * as OrganizationRepo from '../db/repositories/organization-repository'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_TYPES: readonly CredentialType[] = [
  'clearance',
  'drivers_license',
  'bar_admission',
  'medical_license',
] as const

const VALID_STATUSES: readonly CredentialStatus[] = [
  'active',
  'inactive',
  'expired',
] as const

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isValidType(value: unknown): value is CredentialType {
  return typeof value === 'string' && (VALID_TYPES as readonly string[]).includes(value)
}

function isValidStatus(value: unknown): value is CredentialStatus {
  return typeof value === 'string' && (VALID_STATUSES as readonly string[]).includes(value)
}

/**
 * Validate the type-specific details payload. Returns null on success, or
 * an error message describing the first missing/invalid field.
 *
 * Each credential_type enforces its own required fields — for instance,
 * clearance must always have `level` and `clearance_type`, while a bar
 * admission only requires `jurisdiction`.
 */
function validateDetails(
  type: CredentialType,
  details: CredentialDetails | Partial<CredentialDetails>,
): string | null {
  switch (type) {
    case 'clearance': {
      const d = details as Partial<ClearanceDetails>
      if (!d.level || typeof d.level !== 'string' || d.level.trim().length === 0) {
        return 'clearance details.level is required'
      }
      if (!d.clearance_type || typeof d.clearance_type !== 'string') {
        return 'clearance details.clearance_type is required'
      }
      // polygraph and access_programs are optional
      return null
    }

    case 'drivers_license': {
      const d = details as Partial<DriversLicenseDetails>
      if (!d.class || typeof d.class !== 'string' || d.class.trim().length === 0) {
        return "drivers_license details.class is required"
      }
      if (!d.state || typeof d.state !== 'string' || d.state.trim().length === 0) {
        return "drivers_license details.state is required"
      }
      return null
    }

    case 'bar_admission': {
      const d = details as Partial<BarAdmissionDetails>
      if (!d.jurisdiction || typeof d.jurisdiction !== 'string' || d.jurisdiction.trim().length === 0) {
        return 'bar_admission details.jurisdiction is required'
      }
      return null
    }

    case 'medical_license': {
      const d = details as Partial<MedicalLicenseDetails>
      if (!d.license_type || typeof d.license_type !== 'string' || d.license_type.trim().length === 0) {
        return 'medical_license details.license_type is required'
      }
      if (!d.state || typeof d.state !== 'string' || d.state.trim().length === 0) {
        return 'medical_license details.state is required'
      }
      return null
    }
  }
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class CredentialService {
  constructor(private db: Database) {}

  create(input: CreateCredential): Result<Credential> {
    // Basic field validation
    if (!input.label || input.label.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'label is required' } }
    }

    if (!isValidType(input.credential_type)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid credential_type '${input.credential_type}'. Valid: ${VALID_TYPES.join(', ')}`,
        },
      }
    }

    if (input.status !== undefined && !isValidStatus(input.status)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid status '${input.status}'. Valid: ${VALID_STATUSES.join(', ')}`,
        },
      }
    }

    // Type-specific details validation
    if (!input.details) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'details is required' },
      }
    }
    const detailsError = validateDetails(input.credential_type, input.details)
    if (detailsError) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: detailsError } }
    }

    // Organization FK validation (if provided)
    if (input.organization_id) {
      const org = OrganizationRepo.get(this.db, input.organization_id)
      if (!org) {
        return {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: `Organization ${input.organization_id} not found`,
          },
        }
      }
    }

    const credential = CredentialRepo.create(this.db, {
      ...input,
      label: input.label.trim(),
    })
    return { ok: true, data: credential }
  }

  get(id: string): Result<Credential> {
    const credential = CredentialRepo.findById(this.db, id)
    if (!credential) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Credential ${id} not found` } }
    }
    return { ok: true, data: credential }
  }

  list(): Result<Credential[]> {
    return { ok: true, data: CredentialRepo.findAll(this.db) }
  }

  findByType(type: string): Result<Credential[]> {
    if (!isValidType(type)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid credential_type '${type}'. Valid: ${VALID_TYPES.join(', ')}`,
        },
      }
    }
    return { ok: true, data: CredentialRepo.findByType(this.db, type) }
  }

  update(id: string, input: UpdateCredential): Result<Credential> {
    // Empty label rejected (if provided)
    if (input.label !== undefined && input.label.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'label must not be empty' } }
    }

    if (input.status !== undefined && !isValidStatus(input.status)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid status '${input.status}'. Valid: ${VALID_STATUSES.join(', ')}`,
        },
      }
    }

    // Organization FK validation (if provided and non-null)
    if (input.organization_id) {
      const org = OrganizationRepo.get(this.db, input.organization_id)
      if (!org) {
        return {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: `Organization ${input.organization_id} not found`,
          },
        }
      }
    }

    // Details validation: only run it for the fields being updated.
    // We need the credential's type to know which schema to check, so
    // fetch first. Partial merges are validated against the merged result.
    if (input.details !== undefined) {
      const existing = CredentialRepo.findById(this.db, id)
      if (!existing) {
        return { ok: false, error: { code: 'NOT_FOUND', message: `Credential ${id} not found` } }
      }
      const mergedDetails = { ...(existing.details as object), ...(input.details as object) } as CredentialDetails
      const detailsError = validateDetails(existing.credential_type, mergedDetails)
      if (detailsError) {
        return { ok: false, error: { code: 'VALIDATION_ERROR', message: detailsError } }
      }
    }

    const updated = CredentialRepo.update(this.db, id, {
      ...input,
      ...(input.label !== undefined ? { label: input.label.trim() } : {}),
    })
    if (!updated) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Credential ${id} not found` } }
    }
    return { ok: true, data: updated }
  }

  delete(id: string): Result<void> {
    const existing = CredentialRepo.findById(this.db, id)
    if (!existing) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Credential ${id} not found` } }
    }
    CredentialRepo.del(this.db, id)
    return { ok: true, data: undefined }
  }
}
