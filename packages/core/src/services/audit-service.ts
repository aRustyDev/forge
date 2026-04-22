/**
 * AuditService — chain tracing and integrity checking.
 *
 * Provides full derivation chain traversal (perspective → bullet → source)
 * and snapshot integrity comparison.
 *
 * Phase 1.4: uses EntityLifecycleManager
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type { ChainTrace, IntegrityReport, Perspective, Bullet, Source, Result } from '../types'

export class AuditService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  async traceChain(perspectiveId: string): Promise<Result<ChainTrace>> {
    const perspResult = await this.elm.get('perspectives', perspectiveId)
    if (!perspResult.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Perspective ${perspectiveId} not found` } }
    }
    const perspective = perspResult.value as unknown as Perspective

    const bulletResult = await this.elm.get('bullets', perspective.bullet_id)
    if (!bulletResult.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Bullet ${perspective.bullet_id} not found (chain broken)` } }
    }
    const bullet = bulletResult.value as unknown as Bullet

    // Get primary source via bullet_sources junction table
    const bsResult = await this.elm.list('bullet_sources', {
      where: { bullet_id: bullet.id, is_primary: 1 },
      limit: 1,
    })
    if (!bsResult.ok || bsResult.value.rows.length === 0) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `No primary source for bullet ${bullet.id} (chain broken)` } }
    }
    const primarySourceId = bsResult.value.rows[0].source_id as string

    const sourceResult = await this.elm.get('sources', primarySourceId)
    if (!sourceResult.ok) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Source ${primarySourceId} not found (chain broken)` } }
    }
    const source = sourceResult.value as unknown as Source

    return { ok: true, data: { perspective, bullet, source } }
  }

  async checkIntegrity(perspectiveId: string): Promise<Result<IntegrityReport>> {
    const chain = await this.traceChain(perspectiveId)
    if (!chain.ok) return chain as Result<IntegrityReport>

    const { perspective, bullet, source } = chain.data

    const bulletSnapshotMatches = perspective.bullet_content_snapshot === bullet.content
    const sourceSnapshotMatches = bullet.source_content_snapshot === source.description

    const report: IntegrityReport = {
      perspective_id: perspectiveId,
      bullet_snapshot_matches: bulletSnapshotMatches,
      source_snapshot_matches: sourceSnapshotMatches,
    }

    if (!bulletSnapshotMatches) {
      report.bullet_diff = {
        snapshot: perspective.bullet_content_snapshot,
        current: bullet.content,
      }
    }

    if (!sourceSnapshotMatches) {
      report.source_diff = {
        snapshot: bullet.source_content_snapshot,
        current: source.description,
      }
    }

    return { ok: true, data: report }
  }
}
