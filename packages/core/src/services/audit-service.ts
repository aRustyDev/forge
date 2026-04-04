/**
 * AuditService — chain tracing and integrity checking.
 *
 * Provides full derivation chain traversal (perspective → bullet → source)
 * and snapshot integrity comparison.
 */

import type { Database } from 'bun:sqlite'
import type { ChainTrace, IntegrityReport, Result } from '../types'
import { PerspectiveRepository } from '../db/repositories/perspective-repository'
import { BulletRepository } from '../db/repositories/bullet-repository'
import * as SourceRepo from '../db/repositories/source-repository'

export class AuditService {
  constructor(private db: Database) {}

  traceChain(perspectiveId: string): Result<ChainTrace> {
    const perspective = PerspectiveRepository.get(this.db, perspectiveId)
    if (!perspective) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Perspective ${perspectiveId} not found` } }
    }

    const bullet = BulletRepository.get(this.db, perspective.bullet_id)
    if (!bullet) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Bullet ${perspective.bullet_id} not found (chain broken)` } }
    }

    // Get primary source via bullet_sources junction table
    const primarySource = BulletRepository.getPrimarySource(this.db, bullet.id)
    if (!primarySource) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `No primary source for bullet ${bullet.id} (chain broken)` } }
    }

    const source = SourceRepo.get(this.db, primarySource.id)
    if (!source) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `Source ${primarySource.id} not found (chain broken)` } }
    }

    return { ok: true, data: { perspective, bullet, source } }
  }

  checkIntegrity(perspectiveId: string): Result<IntegrityReport> {
    const chain = this.traceChain(perspectiveId)
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
