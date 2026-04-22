/**
 * OrgLocationService — CRUD for org_locations (formerly org_campuses).
 *
 * Migration 047 renamed org_campuses → org_locations and replaced flat
 * address fields with address_id FK to shared addresses table.
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type { OrgLocation, LocationModality, Result } from '../types'

const VALID_MODALITIES: readonly LocationModality[] = ['in_person', 'remote', 'hybrid'] as const

function isValidModality(v: unknown): v is LocationModality {
  return typeof v === 'string' && (VALID_MODALITIES as readonly string[]).includes(v)
}

export interface CreateOrgLocationInput {
  organization_id: string
  name: string
  modality?: LocationModality
  address_id?: string | null
  is_headquarters?: boolean
}

export interface UpdateOrgLocationInput {
  name?: string
  modality?: LocationModality
  address_id?: string | null
  is_headquarters?: boolean
}

export class OrgLocationService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  async create(input: CreateOrgLocationInput): Promise<Result<OrgLocation>> {
    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    if (input.modality !== undefined && !isValidModality(input.modality)) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: `Invalid modality '${input.modality}'. Valid: ${VALID_MODALITIES.join(', ')}` },
      }
    }

    const createResult = await this.elm.create('org_locations', {
      organization_id: input.organization_id,
      name: input.name.trim(),
      modality: input.modality ?? 'in_person',
      address_id: input.address_id ?? null,
      is_headquarters: input.is_headquarters ? 1 : 0,
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }
    return this.fetchLocation(createResult.value.id)
  }

  async get(id: string): Promise<Result<OrgLocation>> {
    return this.fetchLocation(id)
  }

  async listByOrg(organizationId: string): Promise<Result<OrgLocation[]>> {
    const result = await this.elm.list('org_locations', {
      where: { organization_id: organizationId },
      orderBy: [{ field: 'name', direction: 'asc' }],
      limit: 10000,
    })
    if (!result.ok) {
      return { ok: false, error: storageErrorToForgeError(result.error) }
    }
    return { ok: true, data: result.value.rows.map((r) => this.toLocation(r as unknown as OrgLocation)) }
  }

  async update(id: string, input: UpdateOrgLocationInput): Promise<Result<OrgLocation>> {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    if (input.modality !== undefined && !isValidModality(input.modality)) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: `Invalid modality '${input.modality}'. Valid: ${VALID_MODALITIES.join(', ')}` },
      }
    }

    const patch: Record<string, unknown> = {}
    if (input.name !== undefined) patch.name = input.name.trim()
    if (input.modality !== undefined) patch.modality = input.modality
    if (input.address_id !== undefined) patch.address_id = input.address_id
    if (input.is_headquarters !== undefined) patch.is_headquarters = input.is_headquarters ? 1 : 0

    if (Object.keys(patch).length === 0) {
      return this.fetchLocation(id)
    }

    const updateResult = await this.elm.update('org_locations', id, patch)
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }
    return this.fetchLocation(id)
  }

  async delete(id: string): Promise<Result<void>> {
    const delResult = await this.elm.delete('org_locations', id)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  private toLocation(row: OrgLocation & { created_at?: string }): OrgLocation {
    return {
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      modality: row.modality,
      address_id: row.address_id ?? null,
      is_headquarters: row.is_headquarters,
      created_at: row.created_at ?? '',
    }
  }

  private async fetchLocation(id: string): Promise<Result<OrgLocation>> {
    const result = await this.elm.get('org_locations', id)
    if (!result.ok) {
      return { ok: false, error: storageErrorToForgeError(result.error) }
    }
    return { ok: true, data: this.toLocation(result.value as unknown as OrgLocation) }
  }
}
