/**
 * CredentialService — business logic + validation over the integrity
 * layer for credential entities.
 *
 * Phase 1.2: uses EntityLifecycleManager instead of CredentialRepository.
 *
 * Responsibilities:
 *   - Validate credential_type-specific required fields in details JSON
 *     (ELM has no schema for polymorphic JSON payloads)
 *   - Validate status + credential_type enums (duplicated for richer
 *     error messages that name the valid values)
 *   - Validate organization_id references an existing organization
 *     (ELM's FK check handles this, but the service keeps the friendly
 *     "Organization X not found" wording that tests assert on)
 *   - Merge partial details updates with the existing JSON payload
 *
 * Lazy field gotcha: the entity map declares `details` as
 * `{ type: 'json', lazy: true }`. Every read MUST pass
 * `{ includeLazy: ['details'] }` or the returned row will be missing
 * the JSON payload entirely.
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
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

/** Every credential read must include the lazy `details` JSON column. */
const READ_OPTS = { includeLazy: ['details'] as string[] }

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
      if (
        !d.jurisdiction ||
        typeof d.jurisdiction !== 'string' ||
        d.jurisdiction.trim().length === 0
      ) {
        return 'bar_admission details.jurisdiction is required'
      }
      return null
    }

    case 'medical_license': {
      const d = details as Partial<MedicalLicenseDetails>
      if (
        !d.license_type ||
        typeof d.license_type !== 'string' ||
        d.license_type.trim().length === 0
      ) {
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
  constructor(protected readonly elm: EntityLifecycleManager) {}

  async create(input: CreateCredential): Promise<Result<Credential>> {
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

    // Organization FK validation (if provided). The ELM would already
    // catch this as a FK_VIOLATION, but the historical test suite
    // asserts the exact "Organization X not found" wording.
    if (input.organization_id) {
      const orgResult = await this.elm.get('organizations', input.organization_id)
      if (!orgResult.ok) {
        return {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: `Organization ${input.organization_id} not found`,
          },
        }
      }
    }

    const createResult = await this.elm.create('credentials', {
      credential_type: input.credential_type,
      label: input.label.trim(),
      status: input.status ?? 'active',
      organization_id: input.organization_id ?? null,
      details: input.details,
      issued_date: input.issued_date ?? null,
      expiry_date: input.expiry_date ?? null,
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }
    return this.fetchCredential(createResult.value.id)
  }

  async get(id: string): Promise<Result<Credential>> {
    return this.fetchCredential(id)
  }

  async list(): Promise<Result<Credential[]>> {
    const listResult = await this.elm.list('credentials', {
      orderBy: [
        { field: 'credential_type', direction: 'asc' },
        { field: 'label', direction: 'asc' },
      ],
      limit: 10000,
      ...READ_OPTS,
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }
    return {
      ok: true,
      data: listResult.value.rows.map((r) => r as unknown as Credential),
    }
  }

  async findByType(type: string): Promise<Result<Credential[]>> {
    if (!isValidType(type)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid credential_type '${type}'. Valid: ${VALID_TYPES.join(', ')}`,
        },
      }
    }
    const listResult = await this.elm.list('credentials', {
      where: { credential_type: type },
      orderBy: [{ field: 'label', direction: 'asc' }],
      limit: 10000,
      ...READ_OPTS,
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }
    return {
      ok: true,
      data: listResult.value.rows.map((r) => r as unknown as Credential),
    }
  }

  async update(id: string, input: UpdateCredential): Promise<Result<Credential>> {
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
      const orgResult = await this.elm.get('organizations', input.organization_id)
      if (!orgResult.ok) {
        return {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: `Organization ${input.organization_id} not found`,
          },
        }
      }
    }

    // Fetch the existing credential so we can (a) surface NOT_FOUND,
    // (b) look up credential_type for details validation, and (c)
    // merge partial `details` updates with the existing JSON.
    const existingResult = await this.elm.get('credentials', id, READ_OPTS)
    if (!existingResult.ok) {
      return { ok: false, error: storageErrorToForgeError(existingResult.error) }
    }
    const existing = existingResult.value as unknown as Credential

    const patch: Record<string, unknown> = {}
    if (input.label !== undefined) patch.label = input.label.trim()
    if (input.status !== undefined) patch.status = input.status
    if (input.organization_id !== undefined) patch.organization_id = input.organization_id
    if (input.issued_date !== undefined) patch.issued_date = input.issued_date
    if (input.expiry_date !== undefined) patch.expiry_date = input.expiry_date

    if (input.details !== undefined) {
      const merged = {
        ...(existing.details as object),
        ...(input.details as object),
      } as CredentialDetails
      const detailsError = validateDetails(existing.credential_type, merged)
      if (detailsError) {
        return { ok: false, error: { code: 'VALIDATION_ERROR', message: detailsError } }
      }
      patch.details = merged
    }

    const updateResult = await this.elm.update('credentials', id, patch)
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }
    return this.fetchCredential(id)
  }

  async delete(id: string): Promise<Result<void>> {
    const delResult = await this.elm.delete('credentials', id)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  // ── Internal helpers ─────────────────────────────────────────────

  private async fetchCredential(id: string): Promise<Result<Credential>> {
    const result = await this.elm.get('credentials', id, READ_OPTS)
    if (!result.ok) {
      return { ok: false, error: storageErrorToForgeError(result.error) }
    }
    return { ok: true, data: result.value as unknown as Credential }
  }
}
