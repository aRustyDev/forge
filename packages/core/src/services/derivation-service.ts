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
 */

import type { Database } from 'bun:sqlite'
import type { Result } from '../types'
import type { Bullet } from '../db/repositories/bullet-repository'
import type { Perspective, DerivePerspectiveInput } from '../types'
import * as SourceRepo from '../db/repositories/source-repository'
import { BulletRepository } from '../db/repositories/bullet-repository'
import { PerspectiveRepository } from '../db/repositories/perspective-repository'
import * as PromptLogRepo from '../db/repositories/prompt-log-repository'
import * as ArchetypeRepo from '../db/repositories/archetype-repository'
import * as DomainRepo from '../db/repositories/domain-repository'
import * as PendingDerivationRepo from '../db/repositories/pending-derivation-repository'
import {
  renderSourceToBulletPrompt,
  renderBulletToPerspectivePrompt,
  validateBulletDerivation,
  validatePerspectiveDerivation,
  SOURCE_TO_BULLET_TEMPLATE_VERSION,
  BULLET_TO_PERSPECTIVE_TEMPLATE_VERSION,
} from '../ai'
import type { EmbeddingService } from './embedding-service'

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
  private embeddingService: EmbeddingService | null = null

  constructor(private db: Database) {}

  /**
   * Set the embedding service for fire-and-forget hooks.
   *
   * NOTE (I6): Constructor injection would be preferred but requires careful
   * ordering in createServices(). The setter pattern is used here because
   * EmbeddingService initialization is async (model loading) and may complete
   * after createServices(). This avoids circular dependency issues.
   */
  setEmbeddingService(svc: EmbeddingService): void {
    this.embeddingService = svc
  }

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
    const source = SourceRepo.get(this.db, sourceId)
    if (!source) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Source ${sourceId} not found` } }
    }

    // 2. Reject archived sources
    if (source.status === 'archived') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Cannot derive from archived source. Unarchive it first.' },
      }
    }

    // 3. Check for existing unexpired lock
    const existing = PendingDerivationRepo.findUnexpiredByEntity(this.db, 'source', sourceId)
    if (existing) {
      return {
        ok: false,
        error: { code: 'CONFLICT', message: `Source ${sourceId} is already being derived` },
      }
    }

    // 4. Capture snapshot and render prompt
    const snapshot = source.description
    const prompt = renderSourceToBulletPrompt(snapshot)
    const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString()

    // 5. Create pending derivation row (exclusive lock via UNIQUE index)
    let row: ReturnType<typeof PendingDerivationRepo.create>
    try {
      row = PendingDerivationRepo.create(this.db, {
        entity_type: 'source',
        entity_id: sourceId,
        client_id: clientId,
        prompt,
        snapshot,
        derivation_params: null,
        expires_at: expiresAt,
      })
    } catch (err: unknown) {
      // UNIQUE constraint violation — concurrent prepare
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('UNIQUE')) {
        return {
          ok: false,
          error: { code: 'CONFLICT', message: `Source ${sourceId} is already being derived` },
        }
      }
      throw err
    }

    return {
      ok: true,
      data: {
        derivation_id: row.id,
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
   * Validates the input, writes bullets + prompt log atomically, and deletes
   * the pending derivation row (releasing the lock).
   */
  async commitBulletDerivation(
    derivationId: string,
    input: BulletCommitInput,
  ): Promise<Result<Bullet[]>> {
    // 1. Look up pending row
    const pending = PendingDerivationRepo.getById(this.db, derivationId)
    if (!pending) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Derivation ${derivationId} not found` } }
    }

    // 2. Check expiry
    if (new Date(pending.expires_at) <= new Date()) {
      PendingDerivationRepo.deleteById(this.db, derivationId)
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

    const sourceId = pending.entity_id
    const snapshot = pending.snapshot
    const prompt = pending.prompt

    // 5. Transaction: write bullets + prompt logs + delete pending row
    const bullets: Bullet[] = []

    const txn = this.db.transaction(() => {
      for (const item of validation.data.bullets) {
        const bullet = BulletRepository.create(this.db, {
          content: item.content,
          source_content_snapshot: snapshot,
          technologies: item.technologies,
          metrics: item.metrics,
          status: 'in_review',
          source_ids: [{ id: sourceId, is_primary: true }],
        })

        PromptLogRepo.create(this.db, {
          entity_type: 'bullet',
          entity_id: bullet.id,
          prompt_template: SOURCE_TO_BULLET_TEMPLATE_VERSION,
          prompt_input: prompt,
          raw_response: JSON.stringify(input),
        })

        bullets.push(bullet)
      }

      // Release lock
      PendingDerivationRepo.deleteById(this.db, derivationId)

      // Mark source as derived (update last_derived_at, restore previous status)
      const source = SourceRepo.get(this.db, sourceId)
      if (source) {
        SourceRepo.releaseDerivingLock(this.db, sourceId, source.status as any, true)
      }
    })

    txn()

    // 6. Fire-and-forget embedding hooks
    if (this.embeddingService) {
      for (const bullet of bullets) {
        queueMicrotask(() =>
          this.embeddingService!.onBulletCreated(bullet).catch(err =>
            console.error(`[DerivationService] Embedding hook failed for bullet ${bullet.id}:`, err)
          )
        )
      }
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
    const bullet = BulletRepository.get(this.db, bulletId)
    if (!bullet) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Bullet ${bulletId} not found` } }
    }

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

    // 4. Validate archetype exists
    const archetypeExists = ArchetypeRepo.getByName(this.db, params.archetype)
    if (!archetypeExists) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Unknown archetype: '${params.archetype}'. Check /api/archetypes for valid values.`,
        },
      }
    }

    // 5. Validate domain exists
    const domainExists = DomainRepo.getByName(this.db, params.domain)
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
    const existing = PendingDerivationRepo.findUnexpiredByEntity(this.db, 'bullet', bulletId)
    if (existing) {
      return {
        ok: false,
        error: { code: 'CONFLICT', message: `Bullet ${bulletId} is already being derived` },
      }
    }

    // 7. Capture snapshot and render prompt
    const snapshot = bullet.content
    const prompt = renderBulletToPerspectivePrompt(
      snapshot,
      bullet.technologies,
      bullet.metrics,
      params.archetype,
      params.domain,
      params.framing,
    )
    const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString()

    // 8. Create pending derivation row
    let row: ReturnType<typeof PendingDerivationRepo.create>
    try {
      row = PendingDerivationRepo.create(this.db, {
        entity_type: 'bullet',
        entity_id: bulletId,
        client_id: clientId,
        prompt,
        snapshot,
        derivation_params: JSON.stringify(params),
        expires_at: expiresAt,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('UNIQUE')) {
        return {
          ok: false,
          error: { code: 'CONFLICT', message: `Bullet ${bulletId} is already being derived` },
        }
      }
      throw err
    }

    return {
      ok: true,
      data: {
        derivation_id: row.id,
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
   * Validates the input, writes the perspective + prompt log atomically, and
   * deletes the pending derivation row.
   */
  async commitPerspectiveDerivation(
    derivationId: string,
    input: PerspectiveCommitInput,
  ): Promise<Result<Perspective>> {
    // 1. Look up pending row
    const pending = PendingDerivationRepo.getById(this.db, derivationId)
    if (!pending) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Derivation ${derivationId} not found` } }
    }

    // 2. Check expiry
    if (new Date(pending.expires_at) <= new Date()) {
      PendingDerivationRepo.deleteById(this.db, derivationId)
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

    const bulletId = pending.entity_id
    const snapshot = pending.snapshot
    const prompt = pending.prompt

    // Parse derivation params
    const params: DerivePerspectiveInput = pending.derivation_params
      ? JSON.parse(pending.derivation_params)
      : { archetype: null, domain: null, framing: 'accomplishment' }

    // 5. Transaction: write perspective + prompt log + delete pending row
    let perspective!: Perspective

    const txn = this.db.transaction(() => {
      perspective = PerspectiveRepository.create(this.db, {
        bullet_id: bulletId,
        content: validation.data.content,
        bullet_content_snapshot: snapshot,
        target_archetype: params.archetype,
        domain: params.domain,
        framing: params.framing,
        status: 'in_review',
      })

      PromptLogRepo.create(this.db, {
        entity_type: 'perspective',
        entity_id: perspective.id,
        prompt_template: BULLET_TO_PERSPECTIVE_TEMPLATE_VERSION,
        prompt_input: prompt,
        raw_response: JSON.stringify(input),
      })

      PendingDerivationRepo.deleteById(this.db, derivationId)
    })

    txn()

    // 6. Fire-and-forget embedding hook
    if (this.embeddingService) {
      queueMicrotask(() =>
        this.embeddingService!.onPerspectiveCreated(perspective).catch(err =>
          console.error(`[DerivationService] Embedding hook failed for perspective ${perspective.id}:`, err)
        )
      )
    }

    return { ok: true, data: perspective }
  }

  // ── Stale lock recovery ───────────────────────────────────────────────────

  /**
   * Clean up expired locks and reset any sources stuck in legacy 'deriving' status.
   * Called once at server startup.
   *
   * Returns the number of expired pending_derivations rows deleted.
   */
  static recoverStaleLocks(db: Database, thresholdMs = 300_000): number {
    // Delete expired pending_derivations rows
    const deleted = PendingDerivationRepo.deleteExpired(db)

    // Also reset sources stuck in legacy 'deriving' status (backward compat)
    const threshold = new Date(Date.now() - thresholdMs).toISOString()
    db.run(
      `UPDATE sources SET status = 'draft', updated_at = ?
       WHERE status = 'deriving' AND updated_at < ?`,
      [new Date().toISOString(), threshold],
    )

    return deleted
  }
}
