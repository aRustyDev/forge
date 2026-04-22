/**
 * OrganizationService — business logic for organization entities.
 *
 * Phase 1.2: uses EntityLifecycleManager instead of OrganizationRepository.
 *
 * Validates input before delegating to the ELM. All methods return
 * Result<T> (never throw).
 *
 * Organization has the widest cascade breadth of any entity in Phase
 * 1.2: its `cascade` list includes `org_tags`, `org_locations`,
 * `org_aliases`, `contact_organizations`; and its `setNull` list
 * includes `source_roles`, `source_projects`, `source_education`,
 * `contacts`, `job_descriptions`, `credentials`, `certifications`.
 * The ELM handles all of that automatically — delete just works.
 *
 * Boolean quirk: `worked` is `boolean: true` in the entity map, so
 * the ELM returns it as `true/false`, but the Organization type
 * declares it as `number` (0/1). The service normalizes on every
 * read path via `toOrganization`.
 *
 * Tag management: `organizations.tags` is a computed field populated
 * from the `org_tags` junction table. The service walks the junction
 * on every read and uses delete-then-insert (replace-all) semantics
 * on write.
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type {
  Organization,
  OrgTag,
  Result,
  PaginatedResult,
  CreateOrganizationInput,
  OrganizationFilter,
} from '../types'

const VALID_ORG_TYPES = [
  'company',
  'nonprofit',
  'government',
  'military',
  'education',
  'volunteer',
  'freelance',
  'other',
]
const VALID_STATUSES = [
  'backlog',
  'researching',
  'exciting',
  'interested',
  'acceptable',
  'excluded',
]

/** Row shape that the ELM returns from the `organizations` entity. */
type OrgRow = Omit<Organization, 'worked' | 'tags'> & { worked: number | boolean }

export class OrganizationService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  async create(input: CreateOrganizationInput): Promise<Result<Organization>> {
    if (!input.name || input.name.trim().length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' },
      }
    }
    if (input.org_type && !VALID_ORG_TYPES.includes(input.org_type)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid org_type: ${input.org_type}. Must be one of: ${VALID_ORG_TYPES.join(', ')}`,
        },
      }
    }
    if (
      input.status !== undefined &&
      input.status !== null &&
      !VALID_STATUSES.includes(input.status)
    ) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid status: ${input.status}. Must be one of: ${VALID_STATUSES.join(', ')}`,
        },
      }
    }

    const createResult = await this.elm.create('organizations', {
      name: input.name,
      org_type: input.org_type ?? 'company',
      industry: input.industry ?? null,
      size: input.size ?? null,
      worked: input.worked ?? 0,
      employment_type: input.employment_type ?? null,
      website: input.website ?? null,
      linkedin_url: input.linkedin_url ?? null,
      glassdoor_url: input.glassdoor_url ?? null,
      glassdoor_rating: input.glassdoor_rating ?? null,
      status: input.status ?? null,
    })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }

    // Set tags: default to [org_type] if no tags provided. Matches the
    // historical repo.create which seeds the tag list from the
    // org_type primary classification.
    const orgType = input.org_type ?? 'company'
    const tags = input.tags ?? [orgType]
    await this.replaceTags(createResult.value.id, tags)

    return this.fetchOrg(createResult.value.id)
  }

  async get(id: string): Promise<Result<Organization>> {
    return this.fetchOrg(id)
  }

  async list(
    filter?: OrganizationFilter,
    offset?: number,
    limit?: number,
  ): Promise<PaginatedResult<Organization>> {
    // tag filter: walk the org_tags junction to find org_ids that
    // have the requested tag. Everything else can be pushed into the
    // generic where clause on the organizations table.
    let idFilter: string[] | null = null

    if (filter?.tag !== undefined) {
      const junctionResult = await this.elm.list('org_tags', {
        where: { tag: filter.tag },
        limit: 100000,
      })
      if (!junctionResult.ok) {
        return { ok: false, error: storageErrorToForgeError(junctionResult.error) }
      }
      idFilter = junctionResult.value.rows.map(
        (r) => (r as unknown as { organization_id: string }).organization_id,
      )
    }

    // search filter: name LIKE and/or alias LIKE. Historical repo did
    // `o.name LIKE ? OR o.id IN (SELECT organization_id FROM
    // org_aliases WHERE alias LIKE ?)`. We reproduce with two queries:
    // (1) gather alias matches into a set of org_ids, then (2) use a
    // combined where clause with `$or: [{ name LIKE }, { id IN {...}
    // }]`. If both tag and search are set, we intersect at the end.
    let searchIds: string[] | null = null
    if (filter?.search !== undefined) {
      const aliasPattern = `%${filter.search}%`
      const aliasResult = await this.elm.list('org_aliases', {
        where: { alias: { $like: aliasPattern } },
        limit: 100000,
      })
      if (aliasResult.ok) {
        searchIds = aliasResult.value.rows.map(
          (r) => (r as unknown as { organization_id: string }).organization_id,
        )
      } else {
        searchIds = []
      }
    }

    // Build the where clause for organizations
    const where: Record<string, unknown> = {}
    if (filter?.org_type !== undefined) where.org_type = filter.org_type
    if (filter?.worked !== undefined) where.worked = filter.worked
    if (filter?.status !== undefined) where.status = filter.status

    let finalWhere: Record<string, unknown> | undefined
    if (Object.keys(where).length > 0) finalWhere = where

    // Combine search (name OR alias ids) via $or
    if (filter?.search !== undefined) {
      const searchClause: Record<string, unknown> = {
        $or: [
          { name: { $like: `%${filter.search}%` } },
          ...((searchIds && searchIds.length > 0)
            ? [{ id: { $in: searchIds } }]
            : []),
        ],
      }
      finalWhere = finalWhere
        ? { $and: [finalWhere, searchClause] }
        : searchClause
    }

    // Combine tag filter (intersect via $in)
    if (idFilter !== null) {
      const idClause = { id: { $in: idFilter } }
      finalWhere = finalWhere ? { $and: [finalWhere, idClause] } : idClause
      if (idFilter.length === 0) {
        // No orgs match — short-circuit to empty result
        return {
          ok: true,
          data: [],
          pagination: { total: 0, offset: offset ?? 0, limit: limit ?? 50 },
        }
      }
    }

    const listResult = await this.elm.list('organizations', {
      where: finalWhere,
      orderBy: [{ field: 'name', direction: 'asc' }],
      offset,
      limit,
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }

    const data: Organization[] = []
    for (const row of listResult.value.rows) {
      data.push(await this.toOrganization(row as unknown as OrgRow))
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

  async update(
    id: string,
    input: Partial<CreateOrganizationInput>,
  ): Promise<Result<Organization>> {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' },
      }
    }
    if (input.org_type && !VALID_ORG_TYPES.includes(input.org_type)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid org_type: ${input.org_type}`,
        },
      }
    }
    if (
      input.status !== undefined &&
      input.status !== null &&
      !VALID_STATUSES.includes(input.status)
    ) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid status: ${input.status}. Must be one of: ${VALID_STATUSES.join(', ')}`,
        },
      }
    }

    const patch: Record<string, unknown> = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.org_type !== undefined) patch.org_type = input.org_type
    if (input.industry !== undefined) patch.industry = input.industry
    if (input.size !== undefined) patch.size = input.size
    if (input.worked !== undefined) patch.worked = input.worked
    if (input.employment_type !== undefined) patch.employment_type = input.employment_type
    if (input.website !== undefined) patch.website = input.website
    if (input.linkedin_url !== undefined) patch.linkedin_url = input.linkedin_url
    if (input.glassdoor_url !== undefined) patch.glassdoor_url = input.glassdoor_url
    if (input.glassdoor_rating !== undefined) patch.glassdoor_rating = input.glassdoor_rating
    if (input.status !== undefined) patch.status = input.status

    const updateResult = await this.elm.update('organizations', id, patch)
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }

    // Update tags if provided (replace-all semantics)
    if (input.tags !== undefined) {
      await this.replaceTags(id, input.tags)
    }

    return this.fetchOrg(id)
  }

  async delete(id: string): Promise<Result<void>> {
    const delResult = await this.elm.delete('organizations', id)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  // ── Internal helpers ─────────────────────────────────────────────

  private async fetchOrg(id: string): Promise<Result<Organization>> {
    const result = await this.elm.get('organizations', id)
    if (!result.ok) {
      return { ok: false, error: storageErrorToForgeError(result.error) }
    }
    const org = await this.toOrganization(result.value as unknown as OrgRow)
    return { ok: true, data: org }
  }

  /**
   * Normalize an ELM row into the legacy Organization shape. Converts
   * the `worked` boolean back to `0/1` and populates the computed
   * `tags` array from the `org_tags` junction.
   */
  private async toOrganization(row: OrgRow): Promise<Organization> {
    const worked =
      typeof row.worked === 'boolean' ? (row.worked ? 1 : 0) : row.worked
    const tags = await this.fetchTagsFor(row.id)
    return {
      ...row,
      worked,
      tags,
    } as unknown as Organization
  }

  private async fetchTagsFor(orgId: string): Promise<OrgTag[]> {
    const junctionResult = await this.elm.list('org_tags', {
      where: { organization_id: orgId },
      orderBy: [{ field: 'tag', direction: 'asc' }],
      limit: 1000,
    })
    if (!junctionResult.ok) return []
    return junctionResult.value.rows.map(
      (r) => (r as unknown as { tag: string }).tag as OrgTag,
    )
  }

  /**
   * Replace the tag list for an organization. Delete all existing
   * org_tags rows for the org, then insert one row per tag. Matches
   * the old `setTags` helper. Skipped tags that violate the enum
   * constraint will be reported as CONFLICT / VALIDATION_ERROR by the
   * ELM's validator, but we don't currently surface those — the old
   * code used INSERT OR IGNORE so tag errors were silently swallowed.
   */
  private async replaceTags(orgId: string, tags: string[]): Promise<void> {
    await this.elm.deleteWhere('org_tags', { organization_id: orgId })
    for (const tag of tags) {
      // Ignore create errors so invalid tags are silently dropped,
      // matching the INSERT OR IGNORE semantics of the old repo.
      await this.elm.create('org_tags', { organization_id: orgId, tag })
    }
  }
}
