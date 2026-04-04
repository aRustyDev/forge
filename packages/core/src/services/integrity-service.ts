/**
 * IntegrityService — content drift detection for snapshot-based derivation chain.
 *
 * Scans all bullets and perspectives for stale content snapshots.
 * A "drifted" entity is one where the snapshot stored at derivation time
 * no longer matches the current content of its parent entity.
 */

import type { Database } from 'bun:sqlite'
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
  constructor(private db: Database) {}

  /**
   * Find all entities with stale snapshots.
   *
   * Bullets: source_content_snapshot != primary source's description
   * Perspectives: bullet_content_snapshot != bullet's content
   */
  getDriftedEntities(): Result<DriftedEntity[]> {
    const drifted: DriftedEntity[] = []

    // Check bullets against primary source
    const bulletDrifts = this.db
      .query(
        `SELECT b.id AS bullet_id, b.source_content_snapshot, s.description AS current_description
         FROM bullets b
         JOIN bullet_sources bs ON b.id = bs.bullet_id AND bs.is_primary = 1
         JOIN sources s ON bs.source_id = s.id
         WHERE b.source_content_snapshot != s.description`,
      )
      .all() as Array<{ bullet_id: string; source_content_snapshot: string; current_description: string }>

    for (const row of bulletDrifts) {
      drifted.push({
        entity_type: 'bullet',
        entity_id: row.bullet_id,
        snapshot_field: 'source_content_snapshot',
        snapshot_value: row.source_content_snapshot,
        current_value: row.current_description,
      })
    }

    // Check perspectives against bullet content
    const perspectiveDrifts = this.db
      .query(
        `SELECT p.id AS perspective_id, p.bullet_content_snapshot, b.content AS current_content
         FROM perspectives p
         JOIN bullets b ON p.bullet_id = b.id
         WHERE p.bullet_content_snapshot != b.content`,
      )
      .all() as Array<{ perspective_id: string; bullet_content_snapshot: string; current_content: string }>

    for (const row of perspectiveDrifts) {
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
