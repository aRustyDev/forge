/**
 * ArchetypeService — business logic for archetype entities.
 *
 * Phase 1.2: uses EntityLifecycleManager instead of ArchetypeRepository.
 *
 * Manages CRUD, domain association management (via the archetype_domains
 * junction table), and delete-protection when the archetype is referenced
 * by resumes or perspectives. The integrity layer handles uniqueness and
 * basic type checks; this service keeps the regex format check, the
 * resume/perspective delete pre-check (both reference archetype by NAME
 * as a text column, not an FK), and the junction-row enrichment for
 * getWithDomains / listDomains.
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type {
  Archetype,
  Domain,
  Result,
  PaginatedResult,
  CreateArchetypeInput,
  ArchetypeWithDomains,
  ArchetypeWithCounts,
} from '../types'

export class ArchetypeService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  async create(input: CreateArchetypeInput): Promise<Result<Archetype>> {
    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    // Validate name format: lowercase, hyphens allowed (e.g., "agentic-ai")
    if (!/^[a-z][a-z0-9-]*$/.test(input.name)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'Archetype name must be lowercase, start with a letter, and contain only letters, digits, and hyphens',
        },
      }
    }

    const createResult = await this.elm.create('archetypes', { ...input })
    if (!createResult.ok) {
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }

    const fetched = await this.elm.get('archetypes', createResult.value.id)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: fetched.value as unknown as Archetype }
  }

  async get(id: string): Promise<Result<Archetype>> {
    const result = await this.elm.get('archetypes', id)
    if (!result.ok) {
      return { ok: false, error: storageErrorToForgeError(result.error) }
    }
    return { ok: true, data: result.value as unknown as Archetype }
  }

  async getWithDomains(id: string): Promise<Result<ArchetypeWithDomains>> {
    const archetypeResult = await this.elm.get('archetypes', id)
    if (!archetypeResult.ok) {
      return { ok: false, error: storageErrorToForgeError(archetypeResult.error) }
    }
    const archetype = archetypeResult.value as unknown as Archetype

    const domains = await this.fetchDomainsFor(id)
    return { ok: true, data: { ...archetype, domains } }
  }

  async list(offset?: number, limit?: number): Promise<PaginatedResult<ArchetypeWithCounts>> {
    const listResult = await this.elm.list('archetypes', {
      offset,
      limit,
      orderBy: [{ field: 'name', direction: 'asc' }],
    })
    if (!listResult.ok) {
      return { ok: false, error: storageErrorToForgeError(listResult.error) }
    }

    // Enrich each row with resume_count, perspective_count, domain_count.
    // The old repository used a correlated-subquery JOIN; here we trade
    // per-row COUNT queries for backend independence. Archetype tables
    // are tiny (< 20 rows), so the extra round-trips are acceptable.
    const enriched: ArchetypeWithCounts[] = []
    for (const row of listResult.value.rows) {
      const a = row as unknown as Archetype
      const resumeCount = await this.elm.count('resumes', { archetype: a.name })
      const perspCount = await this.elm.count('perspectives', { target_archetype: a.name })
      const domainCount = await this.elm.count('archetype_domains', { archetype_id: a.id })
      enriched.push({
        ...a,
        resume_count: resumeCount.ok ? resumeCount.value : 0,
        perspective_count: perspCount.ok ? perspCount.value : 0,
        domain_count: domainCount.ok ? domainCount.value : 0,
      })
    }

    return {
      ok: true,
      data: enriched,
      pagination: { total: listResult.value.total, offset: offset ?? 0, limit: limit ?? 50 },
    }
  }

  async update(
    id: string,
    input: Partial<CreateArchetypeInput>,
  ): Promise<Result<Archetype>> {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name must not be empty' } }
    }
    if (input.name !== undefined && !/^[a-z][a-z0-9-]*$/.test(input.name)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Archetype name must be lowercase with hyphens only',
        },
      }
    }

    const updateResult = await this.elm.update('archetypes', id, { ...input })
    if (!updateResult.ok) {
      return { ok: false, error: storageErrorToForgeError(updateResult.error) }
    }

    const fetched = await this.elm.get('archetypes', id)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: fetched.value as unknown as Archetype }
  }

  async delete(id: string): Promise<Result<void>> {
    // Fetch to surface NOT_FOUND and to get the archetype's name (needed
    // for the reference checks below).
    const archetypeResult = await this.elm.get('archetypes', id)
    if (!archetypeResult.ok) {
      return { ok: false, error: storageErrorToForgeError(archetypeResult.error) }
    }
    const archetype = archetypeResult.value as unknown as Archetype

    // resumes.archetype and perspectives.target_archetype are text columns
    // (not FKs), so the integrity layer cannot enforce them. Keep the
    // manual pre-checks to preserve historical "block delete when any
    // resume or perspective references this archetype" semantics.
    const resumeCount = await this.elm.count('resumes', { archetype: archetype.name })
    if (resumeCount.ok && resumeCount.value > 0) {
      return {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: `Cannot delete archetype '${archetype.name}': referenced by ${resumeCount.value} resume(s)`,
        },
      }
    }

    const perspCount = await this.elm.count('perspectives', {
      target_archetype: archetype.name,
    })
    if (perspCount.ok && perspCount.value > 0) {
      return {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: `Cannot delete archetype '${archetype.name}': referenced by ${perspCount.value} perspective(s)`,
        },
      }
    }

    // archetype_domains is a cascade child — the integrity layer will
    // tear down the junction rows automatically.
    const delResult = await this.elm.delete('archetypes', id)
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  // ── Domain association management ────────────────────────────────

  async addDomain(archetypeId: string, domainId: string): Promise<Result<void>> {
    // Pre-validate both sides exist so we can return the more
    // user-friendly "Archetype ..." / "Domain ..." messages that the
    // existing tests assert on. Without this, the ELM would surface a
    // generic FK_VIOLATION message mapped to VALIDATION_ERROR.
    const archetypeResult = await this.elm.get('archetypes', archetypeId)
    if (!archetypeResult.ok) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Archetype ${archetypeId} not found` },
      }
    }

    const domainResult = await this.elm.get('domains', domainId)
    if (!domainResult.ok) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Domain ${domainId} not found` },
      }
    }

    const createResult = await this.elm.create('archetype_domains', {
      archetype_id: archetypeId,
      domain_id: domainId,
    })
    if (!createResult.ok) {
      const mapped = storageErrorToForgeError(createResult.error)
      // Preserve the historical "Domain already associated with this
      // archetype" wording on composite-PK collisions. The underlying
      // error is a UNIQUE_VIOLATION, which the mapper translates to
      // CONFLICT.
      if (mapped.code === 'CONFLICT') {
        return {
          ok: false,
          error: { code: 'CONFLICT', message: 'Domain already associated with this archetype' },
        }
      }
      return { ok: false, error: mapped }
    }
    return { ok: true, data: undefined }
  }

  async removeDomain(
    archetypeId: string,
    domainId: string,
  ): Promise<Result<void>> {
    // Use deleteWhere with the composite key. The row may not exist; we
    // need to report NOT_FOUND in that case to match historical behavior.
    const beforeCount = await this.elm.count('archetype_domains', {
      archetype_id: archetypeId,
      domain_id: domainId,
    })
    if (!beforeCount.ok) {
      return { ok: false, error: storageErrorToForgeError(beforeCount.error) }
    }
    if (beforeCount.value === 0) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Domain association not found' },
      }
    }

    const delResult = await this.elm.deleteWhere('archetype_domains', {
      archetype_id: archetypeId,
      domain_id: domainId,
    })
    if (!delResult.ok) {
      return { ok: false, error: storageErrorToForgeError(delResult.error) }
    }
    return { ok: true, data: undefined }
  }

  async listDomains(archetypeId: string): Promise<Result<Domain[]>> {
    const archetypeResult = await this.elm.get('archetypes', archetypeId)
    if (!archetypeResult.ok) {
      return { ok: false, error: storageErrorToForgeError(archetypeResult.error) }
    }

    const domains = await this.fetchDomainsFor(archetypeId)
    return { ok: true, data: domains }
  }

  // ── Internal helpers ─────────────────────────────────────────────

  /**
   * List the domains linked to an archetype. The old repository used a
   * JOIN; here we walk the junction and fetch each domain row. For
   * taxonomy-size tables this is cheap. The old behavior sorted by
   * domain name ascending, which we reproduce with a final in-memory
   * sort.
   */
  private async fetchDomainsFor(archetypeId: string): Promise<Domain[]> {
    const junctionResult = await this.elm.list('archetype_domains', {
      where: { archetype_id: archetypeId },
      limit: 1000,
    })
    if (!junctionResult.ok) return []

    const domains: Domain[] = []
    for (const row of junctionResult.value.rows) {
      const j = row as unknown as { archetype_id: string; domain_id: string }
      const d = await this.elm.get('domains', j.domain_id)
      if (d.ok) {
        domains.push(d.value as unknown as Domain)
      }
    }

    domains.sort((a, b) => a.name.localeCompare(b.name))
    return domains
  }
}
