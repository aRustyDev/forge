/**
 * DerivationService — orchestrates the AI derivation chain.
 *
 * This is the most critical service. It manages:
 * - Source → Bullet derivation (via Claude CLI)
 * - Bullet → Perspective derivation (via Claude CLI)
 * - Concurrency locking (DB-level for sources, in-memory Set for bullets)
 * - Content snapshot capture
 * - Prompt log creation
 * - Transaction management for atomic writes
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
import {
  invokeClaude,
  renderSourceToBulletPrompt,
  renderBulletToPerspectivePrompt,
  validateBulletDerivation,
  validatePerspectiveDerivation,
  SOURCE_TO_BULLET_TEMPLATE_VERSION,
  BULLET_TO_PERSPECTIVE_TEMPLATE_VERSION,
} from '../ai'

export class DerivationService {
  constructor(
    private db: Database,
    private derivingBullets: Set<string>,
  ) {}

  /**
   * Derive bullets from a source using AI.
   *
   * Flow: get source → lock → snapshot → prompt → AI → validate → write → unlock
   */
  async deriveBulletsFromSource(sourceId: string): Promise<Result<Bullet[]>> {
    // 1. Get source
    const source = SourceRepo.get(this.db, sourceId)
    if (!source) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Source ${sourceId} not found` } }
    }

    // 1b. Reject archived sources
    if (source.status === 'archived') {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Cannot derive from archived source. Unarchive it first.' } }
    }

    // 2. Acquire deriving lock
    const locked = SourceRepo.acquireDerivingLock(this.db, sourceId)
    if (!locked) {
      return { ok: false, error: { code: 'CONFLICT', message: `Source ${sourceId} is already being derived` } }
    }

    const previousStatus = source.status

    try {
      // 3. Capture snapshot
      const snapshot = source.description

      // 4. Render prompt
      const prompt = renderSourceToBulletPrompt(snapshot)

      // 5. Invoke Claude CLI
      const aiResult = await invokeClaude({ prompt })
      if (!aiResult.ok) {
        SourceRepo.releaseDerivingLock(this.db, sourceId, previousStatus, false)
        const errorCode = aiResult.error === 'TIMEOUT' ? 'GATEWAY_TIMEOUT' : 'AI_ERROR'
        return { ok: false, error: { code: errorCode, message: `AI invocation failed: ${aiResult.error}`, details: aiResult.raw } }
      }

      // 6. Validate response
      const validation = validateBulletDerivation(aiResult.data)
      if (!validation.ok) {
        SourceRepo.releaseDerivingLock(this.db, sourceId, previousStatus, false)
        return { ok: false, error: { code: 'AI_ERROR', message: `AI response validation failed: ${validation.error}` } }
      }

      // 7. Atomic write: prompt log + bullets + technologies + unlock
      const bullets: Bullet[] = []

      const txn = this.db.transaction(() => {
        for (const item of validation.data.bullets) {
          // Create bullet (prompt_log_id linked after)
          const bullet = BulletRepository.create(this.db, {
            content: item.content,
            source_content_snapshot: snapshot,
            technologies: item.technologies,
            metrics: item.metrics,
            status: 'in_review',
            source_ids: [{ id: sourceId, is_primary: true }],
          })

          // Create prompt log entry for this bullet
          PromptLogRepo.create(this.db, {
            entity_type: 'bullet',
            entity_id: bullet.id,
            prompt_template: SOURCE_TO_BULLET_TEMPLATE_VERSION,
            prompt_input: prompt,
            raw_response: JSON.stringify(aiResult.data),
          })

          bullets.push(bullet)
        }

        // Release lock with success
        SourceRepo.releaseDerivingLock(this.db, sourceId, previousStatus, true)
      })

      txn()

      return { ok: true, data: bullets }
    } catch (err) {
      // Ensure lock is released on any error
      SourceRepo.releaseDerivingLock(this.db, sourceId, previousStatus, false)
      throw err
    }
  }

  /**
   * Derive a perspective from a bullet using AI.
   *
   * Uses in-memory lock (Set of bullet IDs) since bullets don't have a 'deriving' status.
   * Only approved bullets can have perspectives derived.
   */
  async derivePerspectivesFromBullet(
    bulletId: string,
    params: DerivePerspectiveInput,
  ): Promise<Result<Perspective>> {
    // 1. Get bullet
    const bullet = BulletRepository.get(this.db, bulletId)
    if (!bullet) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Bullet ${bulletId} not found` } }
    }

    // Reject archived bullets with a specific message
    if (bullet.status === 'archived') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Cannot derive from archived bullet. Unarchive it first.' },
      }
    }

    // Only approved bullets
    if (bullet.status !== 'approved') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: `Bullet must be approved to derive perspectives (current: ${bullet.status})` },
      }
    }

    // Validate archetype exists in DB
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

    // Validate domain exists in DB
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

    // 2. Acquire in-memory lock
    if (this.derivingBullets.has(bulletId)) {
      return { ok: false, error: { code: 'CONFLICT', message: `Bullet ${bulletId} is already being derived` } }
    }
    this.derivingBullets.add(bulletId)

    try {
      // 3. Capture snapshot
      const snapshot = bullet.content

      // 4. Render prompt
      const prompt = renderBulletToPerspectivePrompt(
        snapshot,
        bullet.technologies,
        bullet.metrics,
        params.archetype,
        params.domain,
        params.framing,
      )

      // 5. Invoke Claude CLI
      const aiResult = await invokeClaude({ prompt })
      if (!aiResult.ok) {
        this.derivingBullets.delete(bulletId)
        const errorCode = aiResult.error === 'TIMEOUT' ? 'GATEWAY_TIMEOUT' : 'AI_ERROR'
        return { ok: false, error: { code: errorCode, message: `AI invocation failed: ${aiResult.error}`, details: aiResult.raw } }
      }

      // 6. Validate response
      const validation = validatePerspectiveDerivation(aiResult.data)
      if (!validation.ok) {
        this.derivingBullets.delete(bulletId)
        return { ok: false, error: { code: 'AI_ERROR', message: `AI response validation failed: ${validation.error}` } }
      }

      // 7. Atomic write
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
          raw_response: JSON.stringify(aiResult.data),
        })
      })

      txn()
      this.derivingBullets.delete(bulletId)

      return { ok: true, data: perspective }
    } catch (err) {
      this.derivingBullets.delete(bulletId)
      throw err
    }
  }

  /**
   * Reset sources stuck in 'deriving' status (crashed during derivation).
   * Called once at server startup.
   */
  static recoverStaleLocks(db: Database, thresholdMs = 300_000): number {
    const threshold = new Date(Date.now() - thresholdMs).toISOString()
    const result = db.run(
      `UPDATE sources SET status = 'draft', updated_at = ?
       WHERE status = 'deriving' AND updated_at < ?`,
      [new Date().toISOString(), threshold],
    )
    return result.changes
  }
}
