/**
 * ReviewService — review queue for pending bullets and perspectives.
 *
 * Returns counts and items in in_review status with
 * relevant context (source title, bullet content).
 */

import type { Database } from 'bun:sqlite'
import type { ReviewQueue, BulletReviewItem, PerspectiveReviewItem, Result } from '../types'

interface BulletReviewRow {
  id: string
  content: string
  source_content_snapshot: string
  metrics: string | null
  domain: string | null
  status: string
  rejection_reason: string | null
  prompt_log_id: string | null
  approved_at: string | null
  approved_by: string | null
  notes: string | null
  created_at: string
  source_title: string
}

interface PerspectiveReviewRow {
  id: string
  bullet_id: string
  content: string
  bullet_content_snapshot: string
  target_archetype: string | null
  domain: string | null
  framing: string
  status: string
  rejection_reason: string | null
  prompt_log_id: string | null
  approved_at: string | null
  approved_by: string | null
  created_at: string
  bullet_content: string
  source_title: string
}

export class ReviewService {
  constructor(private db: Database) {}

  getPendingReview(): Result<ReviewQueue> {
    // Pending bullets with source title via bullet_sources junction
    const bulletRows = this.db
      .query(
        `SELECT b.*, s.title AS source_title
         FROM bullets b
         JOIN bullet_sources bs ON b.id = bs.bullet_id AND bs.is_primary = 1
         JOIN sources s ON bs.source_id = s.id
         WHERE b.status = 'in_review'
         ORDER BY b.created_at DESC`,
      )
      .all() as BulletReviewRow[]

    const bullets: BulletReviewItem[] = bulletRows.map((row) => ({
      id: row.id,
      content: row.content,
      source_content_snapshot: row.source_content_snapshot,
      technologies: [],
      metrics: row.metrics,
      domain: row.domain,
      status: row.status as BulletReviewItem['status'],
      rejection_reason: row.rejection_reason,
      prompt_log_id: row.prompt_log_id,
      approved_at: row.approved_at,
      approved_by: row.approved_by,
      notes: row.notes,
      created_at: row.created_at,
      source_title: row.source_title,
    }))

    // Hydrate technologies for each bullet
    for (const bullet of bullets) {
      const techRows = this.db
        .query('SELECT technology FROM bullet_technologies WHERE bullet_id = ? ORDER BY technology')
        .all(bullet.id) as Array<{ technology: string }>
      bullet.technologies = techRows.map((r) => r.technology)
    }

    // Pending perspectives with bullet content and source title via junction
    const perspectiveRows = this.db
      .query(
        `SELECT p.*, b.content AS bullet_content, s.title AS source_title
         FROM perspectives p
         JOIN bullets b ON p.bullet_id = b.id
         JOIN bullet_sources bs ON b.id = bs.bullet_id AND bs.is_primary = 1
         JOIN sources s ON bs.source_id = s.id
         WHERE p.status = 'in_review'
         ORDER BY p.created_at DESC`,
      )
      .all() as PerspectiveReviewRow[]

    const perspectives: PerspectiveReviewItem[] = perspectiveRows.map((row) => ({
      id: row.id,
      bullet_id: row.bullet_id,
      content: row.content,
      bullet_content_snapshot: row.bullet_content_snapshot,
      target_archetype: row.target_archetype,
      domain: row.domain,
      framing: row.framing as PerspectiveReviewItem['framing'],
      status: row.status as PerspectiveReviewItem['status'],
      rejection_reason: row.rejection_reason,
      prompt_log_id: row.prompt_log_id,
      approved_at: row.approved_at,
      approved_by: row.approved_by,
      created_at: row.created_at,
      bullet_content: row.bullet_content,
      source_title: row.source_title,
    }))

    return {
      ok: true,
      data: {
        bullets: { count: bullets.length, items: bullets },
        perspectives: { count: perspectives.length, items: perspectives },
      },
    }
  }
}
