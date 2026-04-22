/**
 * IntegrityService — content drift detection for snapshot-based derivation chain.
 *
 * Scans all bullets and perspectives for stale content snapshots.
 * A "drifted" entity is one where the snapshot stored at derivation time
 * no longer matches the current content of its parent entity.
 *
 * Phase 1.4: uses EntityLifecycleManager named queries
 */

import { storageErrorToForgeError } from '../storage/error-mapper'
import type { EntityLifecycleManager } from '../storage/lifecycle-manager'
import type { ListDriftedBulletsResult, ListDriftedPerspectivesResult } from '../storage/named-queries'
import type { Result } from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DriftedEntity {
  entity_type: 'bullet' | 'perspective'
  entity_id: string
  snapshot_field: string
  snapshot_value: string
  current_value: string
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class IntegrityService {
  constructor(protected readonly elm: EntityLifecycleManager) {}

  /**
   * Find all entities with stale snapshots.
   *
   * Bullets: source_content_snapshot != primary source's description
   * Perspectives: bullet_content_snapshot != bullet's content
   */
  async getDriftedEntities(): Promise<Result<DriftedEntity[]>> {
    const drifted: DriftedEntity[] = []

    // Check bullets against primary source via named query
    const bulletResult = await this.elm.query<Record<string, unknown>, ListDriftedBulletsResult>(
      'listDriftedBullets',
      {},
    )
    if (!bulletResult.ok) {
      return { ok: false, error: storageErrorToForgeError(bulletResult.error) }
    }

    for (const row of bulletResult.value.rows) {
      drifted.push({
        entity_type: 'bullet',
        entity_id: row.bullet_id,
        snapshot_field: 'source_content_snapshot',
        snapshot_value: row.source_content_snapshot,
        current_value: row.current_description,
      })
    }

    // Check perspectives against bullet content via named query
    const perspResult = await this.elm.query<Record<string, unknown>, ListDriftedPerspectivesResult>(
      'listDriftedPerspectives',
      {},
    )
    if (!perspResult.ok) {
      return { ok: false, error: storageErrorToForgeError(perspResult.error) }
    }

    for (const row of perspResult.value.rows) {
      drifted.push({
        entity_type: 'perspective',
        entity_id: row.perspective_id,
        snapshot_field: 'bullet_content_snapshot',
        snapshot_value: row.bullet_content_snapshot,
        current_value: row.current_content,
      })
    }

    return { ok: true, data: drifted }
  }
}
