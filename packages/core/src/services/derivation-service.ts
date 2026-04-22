/**
 * DerivationService — split-handshake derivation protocol.
 *
 * This service manages the prepare/commit protocol for AI-driven derivation:
 * - prepareBulletDerivation    — lock source, render prompt, return context
 * - commitBulletDerivation     — validate input, write bullets, delete lock
 * - preparePerspectiveDerivation — lock bullet, render prompt, return context
 * - commitPerspectiveDerivation  — validate input, write perspective, delete lock
 * - recoverStaleLocks          — delete expired pending_derivations rows
 *
 * The AI work (LLM call) is performed by the MCP client between prepare and
 * commit.  This service does NOT invoke any AI CLI directly.
 *
 * Phase 1.5: All repository calls replaced with EntityLifecycleManager.
 * Embedding is handled by entity-map afterCreate hooks on bullets/perspectives.
 */

import type { Database } from 'bun:sqlite'
import { buildDefaultElm } from '../storage/build-elm'
import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type { Result, Bullet, Perspective, DerivePerspectiveInput } from '../types'
import {
  renderSourceToBulletPrompt,
  renderBulletToPerspectivePrompt,
  validateBulletDerivation,
  validatePerspectiveDerivation,
  SOURCE_TO_BULLET_TEMPLATE_VERSION,
  BULLET_TO_PERSPECTIVE_TEMPLATE_VERSION,
} from '../ai'

// ── Public types ────────────────────────────────────────────────────────────

export interface PrepareResult {
  derivation_id: string
  prompt: string
  snapshot: string
  instructions: string
  expires_at: string
}

export interface BulletCommitInput {
  bullets: Array<{ content: string; technologies: string[]; metrics: string | null }>
}

export interface PerspectiveCommitInput {
  content: string
  reasoning: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const LOCK_TIMEOUT_MS = Number(
  process.env.FORGE_DERIVATION_LOCK_TIMEOUT_MS ?? 120_000,
)

const BULLET_INSTRUCTIONS = `Respond with a JSON object:
{
  "bullets": [
    {
      "content": "factual bullet text",
      "technologies": ["tech1", "tech2"],
      "metrics": "quantitative metric if present, null otherwise"
    }
  ]
}`

const PERSPECTIVE_INSTRUCTIONS = `Respond with a JSON object:
{
  "content": "reframed perspective text",
  "reasoning": "brief explanation of framing choices"
}`

// ── Service ─────────────────────────────────────────────────────────────────

export class DerivationService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  // ── Bullet derivation ─────────────────────────────────────────────────────

  /**
   * Prepare a bullet derivation for a source.
   *
   * Acquires an exclusive lock on the source (via pending_derivations), renders
   * the prompt, and returns the derivation context so the MCP client can invoke
   * the LLM and call commitBulletDerivation().
   */
  async prepareBulletDerivation(
    sourceId: string,
    clientId: string,
  ): Promise<Result<PrepareResult>> {
    // 1. Get source
    const sourceResult = await this.elm.get('sources', sourceId)
    if (!sourceResult.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Source ${sourceId} not found` } }
    }
    const source = sourceResult.value

    // 2. Reject archived sources
    if (source.status === 'archived') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Cannot derive from archived source. Unarchive it first.' },
      }
    }

    // 3. Check for existing unexpired lock
    const now = new Date().toISOString()
    const existingResult = await this.elm.list('pending_derivations', {
      where: { entity_type: 'source', entity_id: sourceId, expires_at: { $gt: now } },
      limit: 1,
    })
    if (existingResult.ok && existingResult.value.rows.length > 0) {
      return {
        ok: false,
        error: { code: 'CONFLICT', message: `Source ${sourceId} is already being derived` },
      }
    }

    // 4. Capture snapshot and render prompt
    const snapshot = source.description as string
    const prompt = renderSourceToBulletPrompt(snapshot)
    const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString()

    // 5. Create pending derivation row (UNIQUE INDEX on entity_type+entity_id
    //    prevents concurrent prepares at the SQL level)
    const createResult = await this.elm.create('pending_derivations', {
      entity_type: 'source',
      entity_id: sourceId,
      client_id: clientId,
      prompt,
      snapshot,
      derivation_params: null,
      expires_at: expiresAt,
    })

    if (!createResult.ok) {
      // UNIQUE constraint violation — concurrent prepare on same entity.
      // The entity map doesn't know about the composite UNIQUE INDEX, so
      // the adapter wraps the SQL error as ADAPTER_ERROR.
      const msg = createResult.error.message ?? ''
      if (msg.includes('UNIQUE')) {
        return {
          ok: false,
          error: { code: 'CONFLICT', message: `Source ${sourceId} is already being derived` },
        }
      }
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }

    return {
      ok: true,
      data: {
        derivation_id: createResult.value.id,
        prompt,
        snapshot,
        instructions: BULLET_INSTRUCTIONS,
        expires_at: expiresAt,
      },
    }
  }

  /**
   * Commit a bullet derivation with the LLM response.
   *
   * Validates the input, writes bullets + prompt log, and deletes
   * the pending derivation row (releasing the lock).
   *
   * Embedding fires automatically via entity-map afterCreate hooks on bullets.
   */
  async commitBulletDerivation(
    derivationId: string,
    input: BulletCommitInput,
  ): Promise<Result<Bullet[]>> {
    // 1. Look up pending row (prompt and snapshot are lazy fields)
    const pendingResult = await this.elm.get('pending_derivations', derivationId, {
      includeLazy: ['prompt', 'snapshot'],
    })
    if (!pendingResult.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Derivation ${derivationId} not found` } }
    }
    const pending = pendingResult.value

    // 2. Check expiry
    if (new Date(pending.expires_at as string) <= new Date()) {
      await this.elm.delete('pending_derivations', derivationId)
      return { ok: false, error: { code: 'GONE', message: `Derivation ${derivationId} has expired` } }
    }

    // 3. Validate entity_type
    if (pending.entity_type !== 'source') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Derivation is not for a source (use commitPerspectiveDerivation)' },
      }
    }

    // 4. Validate response shape
    const validation = validateBulletDerivation(input)
    if (!validation.ok) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: `Validation failed: ${validation.error}` } }
    }

    const sourceId = pending.entity_id as string
    const snapshot = pending.snapshot as string
    const prompt = pending.prompt as string

    // 5. Sequential writes: create bullets + junctions + prompt logs.
    //    No transaction wrapper — matches Phase 1.3 pattern. Entity-map
    //    afterCreate hooks fire embedding for each bullet automatically.
    const bullets: Bullet[] = []

    // Bulk-load skills once for technology resolution (Phase 1.2 pattern)
    const skillsResult = await this.elm.list('skills', { limit: 10000 })
    const byLowerName = new Map<string, string>()
    if (skillsResult.ok) {
      for (const s of skillsResult.value.rows) {
        if (typeof s.name === 'string' && typeof s.id === 'string') {
          byLowerName.set(s.name.toLowerCase(), s.id)
        }
      }
    }

    for (const item of validation.data.bullets) {
      // Create bullet
      const bulletResult = await this.elm.create('bullets', {
        content: item.content,
        source_content_snapshot: snapshot,
        metrics: item.metrics,
        status: 'in_review',
      })
      if (!bulletResult.ok) {
        return { ok: false, error: storageErrorToForgeError(bulletResult.error) }
      }
      const bulletId = bulletResult.value.id

      // Create bullet_sources junction (primary source link)
      await this.elm.create('bullet_sources', {
        bullet_id: bulletId,
        source_id: sourceId,
        is_primary: true,
      })

      // Technology resolution: find-or-create skills + bullet_skills junctions
      if (item.technologies && item.technologies.length > 0) {
        const seenInThisCall = new Set<string>()
        for (const tech of item.technologies) {
          const normalized = tech.toLowerCase().trim()
          if (normalized.length === 0) continue
          if (seenInThisCall.has(normalized)) continue
          seenInThisCall.add(normalized)

          let skillId = byLowerName.get(normalized)
          if (!skillId) {
            const created = await this.elm.create('skills', {
              name: normalized,
              category: 'other',
            })
            if (created.ok) {
              skillId = created.value.id
              byLowerName.set(normalized, skillId)
            }
          }
          if (skillId) {
            // Idempotent: pre-check composite PK before create
            const existing = await this.elm.count('bullet_skills', {
              bullet_id: bulletId,
              skill_id: skillId,
            })
            if (!existing.ok || existing.value === 0) {
              await this.elm.create('bullet_skills', {
                bullet_id: bulletId,
                skill_id: skillId,
              })
            }
          }
        }
      }

      // Create prompt log
      await this.elm.create('prompt_logs', {
        entity_type: 'bullet',
        entity_id: bulletId,
        prompt_template: SOURCE_TO_BULLET_TEMPLATE_VERSION,
        prompt_input: prompt,
        raw_response: JSON.stringify(input),
      })

      // Fetch hydrated bullet for return (technologies added from input
      // to match historical BulletRepository.create contract)
      const fetched = await this.elm.get('bullets', bulletId)
      if (fetched.ok) {
        const bullet = fetched.value as unknown as Bullet
        bullet.technologies = item.technologies
        bullets.push(bullet)
      }
    }

    // 6. Release lock
    await this.elm.delete('pending_derivations', derivationId)

    // 7. Mark source as derived (update last_derived_at)
    const sourceResult = await this.elm.get('sources', sourceId)
    if (sourceResult.ok) {
      await this.elm.update('sources', sourceId, {
        last_derived_at: new Date().toISOString(),
      })
    }

    return { ok: true, data: bullets }
  }

  // ── Perspective derivation ────────────────────────────────────────────────

  /**
   * Prepare a perspective derivation for a bullet.
   *
   * Validates the bullet and params, acquires a lock, renders the prompt,
   * and returns context for the MCP client to invoke the LLM.
   */
  async preparePerspectiveDerivation(
    bulletId: string,
    params: DerivePerspectiveInput,
    clientId: string,
  ): Promise<Result<PrepareResult>> {
    // 1. Get bullet
    const bulletResult = await this.elm.get('bullets', bulletId)
    if (!bulletResult.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Bullet ${bulletId} not found` } }
    }
    const bullet = bulletResult.value

    // 2. Reject archived bullets
    if (bullet.status === 'archived') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Cannot derive from archived bullet. Unarchive it first.' },
      }
    }

    // 3. Only approved bullets
    if (bullet.status !== 'approved') {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Bullet must be approved to derive perspectives (current: ${bullet.status})`,
        },
      }
    }

    // 4. Validate archetype exists (case-insensitive lookup on small table)
    const archetypesResult = await this.elm.list('archetypes', { limit: 1000 })
    const archetypeExists = archetypesResult.ok && archetypesResult.value.rows.some(
      (a) => (a.name as string).toLowerCase() === params.archetype.toLowerCase(),
    )
    if (!archetypeExists) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Unknown archetype: '${params.archetype}'. Check /api/archetypes for valid values.`,
        },
      }
    }

    // 5. Validate domain exists (case-insensitive lookup on small table)
    const domainsResult = await this.elm.list('domains', { limit: 1000 })
    const domainExists = domainsResult.ok && domainsResult.value.rows.some(
      (d) => (d.name as string).toLowerCase() === params.domain.toLowerCase(),
    )
    if (!domainExists) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Unknown domain: '${params.domain}'. Check /api/domains for valid values.`,
        },
      }
    }

    // 6. Check for existing unexpired lock
    const now = new Date().toISOString()
    const existingResult = await this.elm.list('pending_derivations', {
      where: { entity_type: 'bullet', entity_id: bulletId, expires_at: { $gt: now } },
      limit: 1,
    })
    if (existingResult.ok && existingResult.value.rows.length > 0) {
      return {
        ok: false,
        error: { code: 'CONFLICT', message: `Bullet ${bulletId} is already being derived` },
      }
    }

    // 7. Capture snapshot and render prompt
    const snapshot = bullet.content as string
    const prompt = renderBulletToPerspectivePrompt(
      snapshot,
      bullet.technologies as string[] ?? [],
      bullet.metrics as string | null,
      params.archetype,
      params.domain,
      params.framing,
    )
    const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString()

    // 8. Create pending derivation row
    const createResult = await this.elm.create('pending_derivations', {
      entity_type: 'bullet',
      entity_id: bulletId,
      client_id: clientId,
      prompt,
      snapshot,
      derivation_params: JSON.stringify(params),
      expires_at: expiresAt,
    })

    if (!createResult.ok) {
      const msg = createResult.error.message ?? ''
      if (msg.includes('UNIQUE')) {
        return {
          ok: false,
          error: { code: 'CONFLICT', message: `Bullet ${bulletId} is already being derived` },
        }
      }
      return { ok: false, error: storageErrorToForgeError(createResult.error) }
    }

    return {
      ok: true,
      data: {
        derivation_id: createResult.value.id,
        prompt,
        snapshot,
        instructions: PERSPECTIVE_INSTRUCTIONS,
        expires_at: expiresAt,
      },
    }
  }

  /**
   * Commit a perspective derivation with the LLM response.
   *
   * Validates the input, writes the perspective + prompt log, and
   * deletes the pending derivation row.
   *
   * Embedding fires automatically via entity-map afterCreate hook on perspectives.
   */
  async commitPerspectiveDerivation(
    derivationId: string,
    input: PerspectiveCommitInput,
  ): Promise<Result<Perspective>> {
    // 1. Look up pending row (prompt and snapshot are lazy fields)
    const pendingResult = await this.elm.get('pending_derivations', derivationId, {
      includeLazy: ['prompt', 'snapshot'],
    })
    if (!pendingResult.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Derivation ${derivationId} not found` } }
    }
    const pending = pendingResult.value

    // 2. Check expiry
    if (new Date(pending.expires_at as string) <= new Date()) {
      await this.elm.delete('pending_derivations', derivationId)
      return { ok: false, error: { code: 'GONE', message: `Derivation ${derivationId} has expired` } }
    }

    // 3. Validate entity_type
    if (pending.entity_type !== 'bullet') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Derivation is not for a bullet (use commitBulletDerivation)' },
      }
    }

    // 4. Validate response shape
    const validation = validatePerspectiveDerivation(input)
    if (!validation.ok) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: `Validation failed: ${validation.error}` } }
    }

    const bulletId = pending.entity_id as string
    const snapshot = pending.snapshot as string
    const prompt = pending.prompt as string

    // Parse derivation params
    const params: DerivePerspectiveInput = pending.derivation_params
      ? JSON.parse(pending.derivation_params as string)
      : { archetype: null, domain: null, framing: 'accomplishment' }

    // 5. Sequential writes: create perspective + prompt log + delete lock.
    //    Entity-map afterCreate hook fires embedding for the perspective.
    const perspectiveResult = await this.elm.create('perspectives', {
      bullet_id: bulletId,
      content: validation.data.content,
      bullet_content_snapshot: snapshot,
      target_archetype: params.archetype,
      domain: params.domain,
      framing: params.framing,
      status: 'in_review',
    })
    if (!perspectiveResult.ok) {
      return { ok: false, error: storageErrorToForgeError(perspectiveResult.error) }
    }
    const perspectiveId = perspectiveResult.value.id

    // Create prompt log
    await this.elm.create('prompt_logs', {
      entity_type: 'perspective',
      entity_id: perspectiveId,
      prompt_template: BULLET_TO_PERSPECTIVE_TEMPLATE_VERSION,
      prompt_input: prompt,
      raw_response: JSON.stringify(input),
    })

    // Release lock
    await this.elm.delete('pending_derivations', derivationId)

    // Fetch perspective to return full object
    const fetched = await this.elm.get('perspectives', perspectiveId)
    if (!fetched.ok) {
      return { ok: false, error: storageErrorToForgeError(fetched.error) }
    }
    return { ok: true, data: fetched.value as unknown as Perspective }
  }

  // ── Stale lock recovery ───────────────────────────────────────────────────

  /**
   * Clean up expired locks and reset any sources stuck in legacy 'deriving' status.
   * Called once at server startup.
   *
   * Returns the number of expired pending_derivations rows deleted.
   */
  static async recoverStaleLocks(
    db: Database,
    thresholdMs = 300_000,
    elm?: EntityLifecycleManager,
  ): Promise<number> {
    const mgr = elm ?? buildDefaultElm(db)
    const now = new Date().toISOString()

    // Delete expired pending_derivations rows
    const deleteResult = await mgr.deleteWhere('pending_derivations', {
      expires_at: { $lte: now },
    })
    const deleted = deleteResult.ok ? deleteResult.value : 0

    // Also reset sources stuck in legacy 'deriving' status (backward compat)
    const threshold = new Date(Date.now() - thresholdMs).toISOString()
    await mgr.updateWhere(
      'sources',
      { status: 'deriving', updated_at: { $lt: threshold } },
      { status: 'draft', updated_at: now },
    )

    return deleted
  }
}
